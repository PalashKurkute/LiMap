// components/CityDrivingViewport.tsx
// Top-down urban traffic simulation for the "Real City Driving" scene.
// All data is SIMULATED — not real sensor data.

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { initSimState, tickSimulation } from "../traffic/trafficSimulation";
import { UrbanNetwork } from "../traffic/UrbanNetwork";
import { VehicleRenderer, TRAFFIC_LIGHT_INTERSECTIONS } from "../traffic/VehicleRenderer";
import { TrafficControls } from "../traffic/TrafficControls";
import type { TrafficSimState, SimVehicle, EventFeedItem } from "../traffic/types";

interface CityDrivingViewportProps {
  isPlaying: boolean;
  onIsPlayingChange: (v: boolean) => void;
  playbackSpeed: number;
  onPlaybackSpeedChange: (v: number) => void;
  onTelemetryUpdate?: (t: { speed: number; heading: number; x: number; y: number; z: number }) => void;
}

const EGO_SPEED_MS = 8.0;
const EGO_ROUTE: [number, number][] = [
  [-120, 1.75], [-60, 1.75], [0, 1.75], [60, 1.75], [120, 1.75],
  [120, -1.75], [60, -1.75], [0, -1.75], [-60, -1.75], [-120, -1.75],
];
const INITIAL_DENSITY = 0.5;

export const CityDrivingViewport: React.FC<CityDrivingViewportProps> = ({
  isPlaying, onIsPlayingChange, playbackSpeed, onPlaybackSpeedChange, onTelemetryUpdate,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const simRef   = useRef<TrafficSimState>(initSimState(Math.round(30 + INITIAL_DENSITY * 70)));
  const [simState, setSimState]       = useState<TrafficSimState>(simRef.current);
  const [density, setDensity]         = useState(INITIAL_DENSITY);
  const [simSpeed, setSimSpeed]       = useState(playbackSpeed);
  const [playing, setPlaying]         = useState(isPlaying);
  const [selectedVeh, setSelectedVeh] = useState<SimVehicle | null>(null);
  const [eventFeed, setEventFeed]     = useState<EventFeedItem[]>([]);
  const [showBBoxes, setShowBBoxes]   = useState(true);
  const [showVels, setShowVels]       = useState(true);
  const [showTrails, setShowTrails]   = useState(true);
  const [showModels, setShowModels]   = useState(true);
  const [showLabels, setShowLabels]   = useState(false);
  const [followEgo, setFollowEgo]     = useState(true);
  const [camMode, setCamMode]         = useState<"topdown"|"tilted">("topdown");

  // Keep refs in sync
  const playingRef    = useRef(isPlaying);
  const simSpeedRef   = useRef(playbackSpeed);
  const densityRef    = useRef(INITIAL_DENSITY);
  const followEgoRef  = useRef(true);
  const camModeRef    = useRef<"topdown"|"tilted">("topdown");
  const showBBoxesRef = useRef(true);
  const showVelsRef   = useRef(true);
  const showTrailsRef = useRef(true);
  const showModelsRef = useRef(true);

  useEffect(() => { playingRef.current  = playing;   }, [playing]);
  useEffect(() => { simSpeedRef.current = simSpeed;  }, [simSpeed]);
  useEffect(() => { densityRef.current  = density;   }, [density]);
  useEffect(() => { followEgoRef.current = followEgo; }, [followEgo]);
  useEffect(() => { camModeRef.current   = camMode;  }, [camMode]);
  useEffect(() => { showBBoxesRef.current = showBBoxes; }, [showBBoxes]);
  useEffect(() => { showVelsRef.current   = showVels;   }, [showVels]);
  useEffect(() => { showTrailsRef.current = showTrails; }, [showTrails]);
  useEffect(() => { showModelsRef.current = showModels; }, [showModels]);
  useEffect(() => { playingRef.current  = isPlaying; setPlaying(isPlaying); }, [isPlaying]);
  useEffect(() => { simSpeedRef.current = playbackSpeed; setSimSpeed(playbackSpeed); }, [playbackSpeed]);

  const egoRef = useRef({ x: -120, y: 1.75, heading: 0, routeIdx: 0, progress: 0 });
  const raycaster = useRef(new THREE.Raycaster());
  const mouse     = useRef(new THREE.Vector2());

  const addEvent = useCallback((ev: EventFeedItem) => {
    setEventFeed(prev => [...prev.slice(-30), ev]);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f17);
    scene.fog = new THREE.FogExp2(0x0b0f17, 0.0025);

    const W = container.clientWidth, H = container.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(50, W / H, 0.5, 800);
    camera.up.set(0, 1, 0);
    camera.position.set(0, 80, 0.001);
    camera.lookAt(0, 0, 0);

    const camTarget = new THREE.Vector3(0, 80, 0.001);
    const lookTarget = new THREE.Vector3(0, 0, 0);
    const curLook    = new THREE.Vector3(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dl = new THREE.DirectionalLight(0xffffff, 1.0);
    dl.position.set(40, 80, 60); scene.add(dl);
    const dl2 = new THREE.DirectionalLight(0x8899ff, 0.3);
    dl2.position.set(-40, 60, -40); scene.add(dl2);

    const urban = new UrbanNetwork();
    scene.add(urban.group);

    const vr = new VehicleRenderer(scene);

    const grid = new THREE.GridHelper(300, 60, 0x1e293b, 0x1e293b);
    grid.position.y = 0.004;
    scene.add(grid);

    // Orbit state
    let dragging = false;
    let lastMX = 0, lastMY = 0;
    let orbitTheta = 0, orbitPhi = Math.PI / 2, orbitDist = 80;
    const orbitCenter = new THREE.Vector3(0, 0, 0);

    let animId: number;
    let lastT = performance.now();
    let frame = 0;

    const loop = () => {
      animId = requestAnimationFrame(loop);
      const now = performance.now();
      const dt  = Math.min((now - lastT) / 1000, 0.05);
      lastT = now; frame++;

      vr.showBBoxes    = showBBoxesRef.current;
      vr.showVelVectors = showVelsRef.current;
      vr.showTrails    = showTrailsRef.current;
      vr.showModels    = showModelsRef.current;

      // Ego movement
      const ego = egoRef.current;
      const spd = playingRef.current ? EGO_SPEED_MS * simSpeedRef.current : 0;
      if (spd > 0) {
        const from = EGO_ROUTE[ego.routeIdx];
        const to   = EGO_ROUTE[(ego.routeIdx + 1) % EGO_ROUTE.length];
        const seg  = Math.hypot(to[0]-from[0], to[1]-from[1]);
        ego.progress += (spd * dt) / Math.max(seg, 1);
        if (ego.progress >= 1) {
          ego.progress -= 1;
          ego.routeIdx = (ego.routeIdx + 1) % EGO_ROUTE.length;
        }
        const f = EGO_ROUTE[ego.routeIdx];
        const t2 = EGO_ROUTE[(ego.routeIdx + 1) % EGO_ROUTE.length];
        ego.x = f[0] + (t2[0]-f[0]) * ego.progress;
        ego.y = f[1] + (t2[1]-f[1]) * ego.progress;
        ego.heading = Math.atan2(t2[1]-f[1], t2[0]-f[0]);
      }

      simRef.current = { ...simRef.current, egoX: ego.x, egoY: ego.y };
      simRef.current = tickSimulation(
        simRef.current, dt, simSpeedRef.current, densityRef.current,
        playingRef.current, addEvent,
      );

      setSelectedVeh(prev => prev
        ? (simRef.current.vehicles.find(v => v.id === prev.id) ?? null)
        : null
      );

      vr.update(simRef.current);
      vr.updateTrafficLights(simRef.current.lights, TRAFFIC_LIGHT_INTERSECTIONS);

      // Camera
      if (!dragging) {
        const pivot = followEgoRef.current
          ? new THREE.Vector3(ego.x, 0, ego.y)
          : orbitCenter;

        if (camModeRef.current === "topdown") {
          camTarget.set(pivot.x, 80, pivot.z + 0.001);
          lookTarget.set(pivot.x, 0, pivot.z);
        } else {
          const back = 45;
          camTarget.set(
            pivot.x - Math.cos(ego.heading)*back,
            55,
            pivot.z - Math.sin(ego.heading)*back,
          );
          lookTarget.set(pivot.x, 0, pivot.z);
        }
        camera.position.lerp(camTarget, 0.05);
        curLook.lerp(lookTarget, 0.05);
        camera.lookAt(curLook);
      } else {
        const px = orbitCenter.x + orbitDist*Math.sin(orbitPhi)*Math.cos(orbitTheta);
        const py = orbitDist*Math.cos(orbitPhi);
        const pz = orbitCenter.z + orbitDist*Math.sin(orbitPhi)*Math.sin(orbitTheta);
        camera.position.set(px, py, pz);
        camera.lookAt(orbitCenter);
      }

      if (frame % 4 === 0) {
        setSimState({ ...simRef.current });
        onTelemetryUpdate?.({
          speed: spd * 3.6,
          heading: ((ego.heading * 180/Math.PI) + 360) % 360,
          x: ego.x, y: ego.y, z: 0,
        });
      }

      renderer.render(scene, camera);
    };
    loop();

    // Mouse handlers
    let mouseDownX = 0, mouseDownY = 0;
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      mouseDownX = e.clientX; mouseDownY = e.clientY;
      lastMX = e.clientX; lastMY = e.clientY;
    };
    const onMove = (e: MouseEvent) => {
      if (!(e.buttons & 1)) return;
      const dx = e.clientX - lastMX, dy = e.clientY - lastMY;
      lastMX = e.clientX; lastMY = e.clientY;
      if (Math.abs(dx)+Math.abs(dy) > 2) dragging = true;
      orbitTheta -= dx*0.006;
      orbitPhi = THREE.MathUtils.clamp(orbitPhi - dy*0.005, 0.1, Math.PI/2-0.05);
      followEgoRef.current = false; setFollowEgo(false);
    };
    const onUp = (e: MouseEvent) => {
      const movedX = Math.abs(e.clientX - mouseDownX);
      const movedY = Math.abs(e.clientY - mouseDownY);
      if (movedX + movedY > 5) { dragging = false; return; }
      dragging = false;
      const rect = container.getBoundingClientRect();
      mouse.current.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(mouse.current, camera);
      let best: SimVehicle | null = null, bestD = 4.0;
      for (const v of simRef.current.vehicles) {
        const d = raycaster.current.ray.distanceToPoint(new THREE.Vector3(v.x, 0.5, v.y));
        if (d < bestD) { bestD = d; best = v; }
      }
      setSelectedVeh(prev => (prev?.id === best?.id ? null : best));
      simRef.current = {
        ...simRef.current,
        vehicles: simRef.current.vehicles.map(v => ({ ...v, isSelected: v.id === (best?.id ?? "") })),
      };
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbitDist = THREE.MathUtils.clamp(orbitDist * (1 + e.deltaY*0.001), 20, 250);
    };
    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    renderer.domElement.addEventListener("mousedown", onDown);
    renderer.domElement.addEventListener("mouseup",   onUp);
    window.addEventListener("mousemove", onMove);
    container.addEventListener("wheel",  onWheel, { passive: false });
    window.addEventListener("resize",    onResize);

    return () => {
      cancelAnimationFrame(animId);
      renderer.domElement.removeEventListener("mousedown", onDown);
      renderer.domElement.removeEventListener("mouseup",   onUp);
      window.removeEventListener("mousemove", onMove);
      container.removeEventListener("wheel",  onWheel);
      window.removeEventListener("resize",    onResize);
      vr.dispose();
      renderer.dispose();
      renderer.domElement.parentElement?.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRestart = () => {
    simRef.current = initSimState(Math.round(30 + densityRef.current * 70));
    egoRef.current = { x: -120, y: 1.75, heading: 0, routeIdx: 0, progress: 0 };
    setEventFeed([]); setSelectedVeh(null);
  };

  void showLabels;

  return (
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }} ref={mountRef}>


      <TrafficControls
        density={density}
        onDensityChange={v => { setDensity(v); densityRef.current = v; }}
        simSpeed={simSpeed}
        onSimSpeedChange={v => { setSimSpeed(v); simSpeedRef.current = v; onPlaybackSpeedChange(v); }}
        isPlaying={playing}
        onPlayPause={() => {
          const n = !playing;
          setPlaying(n); playingRef.current = n; onIsPlayingChange(n);
        }}
        onRestart={handleRestart}
        showModels={showModels}         onShowModelsChange={setShowModels}
        showBBoxes={showBBoxes}         onShowBBoxesChange={setShowBBoxes}
        showVelocityVectors={showVels}  onShowVelocityVectorsChange={setShowVels}
        showTrails={showTrails}         onShowTrailsChange={setShowTrails}
        showRoadLabels={showLabels}     onShowRoadLabelsChange={setShowLabels}
        followEgo={followEgo}           onFollowEgoChange={setFollowEgo}
        cameraMode={camMode}            onCameraModeChange={setCamMode}
        selectedVehicle={selectedVeh}
        onClearSelection={() => {
          setSelectedVeh(null);
          simRef.current = {
            ...simRef.current,
            vehicles: simRef.current.vehicles.map(v => ({ ...v, isSelected: false })),
          };
        }}
        eventFeed={eventFeed}
        simState={simState}
      />
    </div>
  );
};
