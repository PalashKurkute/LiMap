import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { SceneId, TelemetryData, CameraViewMode, ColorMapMode } from '../types/telemetry';
import { Camera, Eye, Layers, Gauge, Compass } from 'lucide-react';

interface ThreeViewportProps {
  sceneId: SceneId;
  telemetry: TelemetryData | null;
}

export const ThreeViewport: React.FC<ThreeViewportProps> = ({ sceneId, telemetry }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Viewport Control States
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('orbit');
  const [colorMode, setColorMode] = useState<ColorMapMode>('elevation');
  const [showRings, setShowRings] = useState<boolean>(true);
  const [showTrajectory, setShowTrajectory] = useState<boolean>(true);
  const [showTrackers, setShowTrackers] = useState<boolean>(true);
  const [showSlice, setShowSlice] = useState<boolean>(true);

  // References for live updates without full scene re-init
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const targetCameraPos = useRef<THREE.Vector3>(new THREE.Vector3(-14, -14, 11));
  const targetLookAt = useRef<THREE.Vector3>(new THREE.Vector3(16, 0, -1.0));
  const currentLookAt = useRef<THREE.Vector3>(new THREE.Vector3(16, 0, -1.0));

  const ringsGroupRef = useRef<THREE.Group | null>(null);
  const trajectoryGroupRef = useRef<THREE.Group | null>(null);
  const trackersGroupRef = useRef<THREE.Group | null>(null);
  const sliceLineRef = useRef<THREE.Line | null>(null);
  const pointsMeshRef = useRef<THREE.Points | null>(null);

  // Handle Camera Mode Transitions
  const handleCameraChange = (mode: CameraViewMode) => {
    setCameraMode(mode);
    if (!cameraRef.current) return;

    if (mode === 'orbit') {
      cameraRef.current.up.set(0, 0, 1);
      targetCameraPos.current.set(-14, -14, 11);
      targetLookAt.current.set(16, 0, -1.0);
    } else if (mode === 'bev') {
      // Top-Down Bird's Eye View: X-forward is up on screen
      cameraRef.current.up.set(1, 0, 0);
      targetCameraPos.current.set(22, 0, 48);
      targetLookAt.current.set(22, 0, 0);
    } else if (mode === 'cockpit') {
      // Ego Cockpit POV looking straight ahead down lane (+X)
      cameraRef.current.up.set(0, 0, 1);
      targetCameraPos.current.set(-0.2, 0.0, -0.6);
      targetLookAt.current.set(32.0, 0.0, -1.2);
    } else if (mode === 'cross_cut') {
      // Direct Side Cross-Section Elevation View
      cameraRef.current.up.set(0, 0, 1);
      targetCameraPos.current.set(18.0, -28.0, 0.0);
      targetLookAt.current.set(18.0, 0.0, 0.0);
    }
  };

  // Toggle Visibility of Groups
  useEffect(() => {
    if (ringsGroupRef.current) ringsGroupRef.current.visible = showRings;
  }, [showRings]);

  useEffect(() => {
    if (trajectoryGroupRef.current) trajectoryGroupRef.current.visible = showTrajectory;
  }, [showTrajectory]);

  useEffect(() => {
    if (trackersGroupRef.current) trackersGroupRef.current.visible = showTrackers;
  }, [showTrackers]);

  useEffect(() => {
    if (sliceLineRef.current) sliceLineRef.current.visible = showSlice;
  }, [showSlice]);

  // Main Three.js Scene Setup & Render Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      600
    );
    camera.up.set(0, 0, 1);
    camera.position.set(-14, -14, 11);
    camera.lookAt(16, 0, -1.0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Subtle Ground Reference Grid
    const gridHelper = new THREE.GridHelper(100, 50, 0x00f0ff, 0x141a29);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = -1.73;
    scene.add(gridHelper);

    // 1. Concentric Fovea Ring Boundaries
    const ringsGroup = new THREE.Group();
    ringsGroupRef.current = ringsGroup;
    scene.add(ringsGroup);

    const ringConfigs = [
      { radius: 10.0, color: 0x00f0ff, opacity: 0.85, name: 'Ring 0 (5cm)' },
      { radius: 25.0, color: 0x00e676, opacity: 0.65, name: 'Ring 1 (10cm)' },
      { radius: 50.0, color: 0x7e8b9f, opacity: 0.45, name: 'Ring 2 (25cm)' },
    ];

    ringConfigs.forEach((cfg) => {
      const ringGeo = new THREE.RingGeometry(cfg.radius - 0.1, cfg.radius + 0.1, 96);
      const ringMat = new THREE.MeshBasicMaterial({
        color: cfg.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: cfg.opacity,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.z = -1.72;
      ringsGroup.add(ringMesh);
    });

    // 2. Ego Vehicle Body (3D Wireframe + Chassis Glow)
    const egoGroup = new THREE.Group();
    const egoBoxGeo = new THREE.BoxGeometry(2.4, 1.4, 0.8);
    const egoBoxMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true });
    const egoMesh = new THREE.Mesh(egoBoxGeo, egoBoxMat);
    egoMesh.position.set(0, 0, -1.33);
    egoGroup.add(egoMesh);

    // Forward Direction Arrow on Ego
    const egoArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, -1.33),
      2.5,
      0x00f0ff,
      0.6,
      0.3
    );
    egoGroup.add(egoArrow);
    scene.add(egoGroup);

    // 3. Point Cloud Generation with Multi-Color Mapping
    const count = 5200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const x = Math.random() * 52 + 1;
      const y = Math.random() * 24 - 12;
      let z = -1.73 + (Math.random() * 0.04 - 0.02);
      let r = 0, g = 0.9, b = 0.46; // Default road green

      // Scene-specific elevations and semantic classes
      let semId = 40; // Road
      let isBridgeDeck = false;

      if (sceneId === 'scene_a_bridge' && x >= 15 && x <= 25) {
        if (Math.abs(y) >= 7.0 && Math.abs(y) <= 9.0) {
          z = Math.random() * 2.5 - 1.73;
          semId = 50; // Pillar / Building
        } else if (Math.random() > 0.42) {
          z = 0.77 + Math.random() * 0.15;
          semId = 15; // Overhang Deck
          isBridgeDeck = true;
        }
      } else if (sceneId === 'scene_b_potholes' && Math.hypot(x - 8, y) < 0.8) {
        z = -1.98;
        semId = 99; // Pothole
      } else if (sceneId === 'scene_c_moving' && x >= 11 && x <= 15.5 && Math.abs(y - 1.8) < 1.0) {
        z = Math.random() * 1.5 - 1.73;
        semId = 10; // Dynamic Vehicle
      } else if (sceneId === 'scene_d_poles') {
        for (const px of [5, 20, 40]) {
          if (Math.hypot(x - px, y - 2.0) < 0.25) {
            z = Math.random() * 3.5 - 1.73;
            semId = 80; // Pole
            break;
          }
        }
      }

      // Color mapping according to active colorMode
      if (colorMode === 'elevation') {
        // Turbo / Height Palette
        const normZ = Math.min(Math.max((z + 2.0) / 3.0, 0), 1);
        if (normZ < 0.2) {
          r = 0.1; g = 0.4; b = 1.0; // Deep blue (pothole)
        } else if (normZ < 0.5) {
          r = 0.0; g = 0.9; b = 0.46; // Emerald road
        } else if (normZ < 0.75) {
          r = 0.0; g = 0.94; b = 1.0; // Cyan overhang
        } else {
          r = 1.0; g = 0.2; b = 0.4; // High obstacle / pillars
        }
      } else if (colorMode === 'semantics') {
        if (semId === 40) { r = 0.0; g = 0.85; b = 0.45; } // Road
        else if (semId === 15) { r = 0.0; g = 0.94; b = 1.0; } // Overhang
        else if (semId === 10) { r = 0.7; g = 0.53; b = 1.0; } // Dynamic Car
        else if (semId === 99) { r = 1.0; g = 0.67; b = 0.0; } // Pothole
        else { r = 1.0; g = 0.1; b = 0.25; } // Obstacle / Pillar
      } else if (colorMode === 'traversability') {
        if (isBridgeDeck) { r = 0.0; g = 0.94; b = 1.0; } // Traversable underpass
        else if (semId === 99) { r = 1.0; g = 0.67; b = 0.0; } // Caution
        else if (semId === 50 || semId === 80) { r = 1.0; g = 0.09; b = 0.27; } // Impassable
        else { r = 0.0; g = 0.9; b = 0.46; } // Traversable
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({ size: 0.20, vertexColors: true });
    const pointsMesh = new THREE.Points(geometry, material);
    pointsMeshRef.current = pointsMesh;
    scene.add(pointsMesh);

    // 4. Planned Hybrid-A* 3D Trajectory Spline
    const trajectoryGroup = new THREE.Group();
    trajectoryGroupRef.current = trajectoryGroup;
    scene.add(trajectoryGroup);

    const trajCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, -1.68),
      new THREE.Vector3(8, -0.4, -1.68),
      new THREE.Vector3(16, 0.2, -1.68),
      new THREE.Vector3(24, 0.0, -1.68),
      new THREE.Vector3(34, 0.5, -1.68),
      new THREE.Vector3(45, 0.0, -1.68),
    ]);

    const trajGeo = new THREE.TubeGeometry(trajCurve, 48, 0.12, 8, false);
    const trajMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
      wireframe: false,
    });
    const trajMesh = new THREE.Mesh(trajGeo, trajMat);
    trajectoryGroup.add(trajMesh);

    // 5. Dynamic Obstacle 3D Bounding Box + Kalman Velocity Vector (Scene C)
    const trackersGroup = new THREE.Group();
    trackersGroupRef.current = trackersGroup;
    scene.add(trackersGroup);

    if (sceneId === 'scene_c_moving') {
      const boxGeo = new THREE.BoxGeometry(4.2, 1.8, 1.4);
      const boxMat = new THREE.MeshBasicMaterial({ color: 0xb388ff, wireframe: true });
      const boxMesh = new THREE.Mesh(boxGeo, boxMat);
      boxMesh.position.set(13.2, 1.8, -0.98);
      trackersGroup.add(boxMesh);

      // Velocity Arrow Vector (8.0 m/s forward)
      const velArrow = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(13.2, 1.8, -0.98),
        3.5,
        0xb388ff,
        0.8,
        0.4
      );
      trackersGroup.add(velArrow);
    }

    // 6. Cross-Section Slice Guide Line (x: 5.0m -> 28.0m at y=0)
    const sliceGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(5.0, 0, -1.70),
      new THREE.Vector3(28.0, 0, -1.70),
    ]);
    const sliceMat = new THREE.LineDashedMaterial({
      color: 0xffab00,
      dashSize: 0.8,
      gapSize: 0.4,
      linewidth: 2,
    });
    const sliceLine = new THREE.Line(sliceGeo, sliceMat);
    sliceLine.computeLineDistances();
    sliceLineRef.current = sliceLine;
    scene.add(sliceLine);

    // Orbit Controls Setup (Mouse Drag, Zoom, Pan)
    let isDragging = false;
    let isPanning = false;
    let prevMouse = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        isPanning = true;
      } else {
        isDragging = true;
      }
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging && !isPanning) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      prevMouse = { x: e.clientX, y: e.clientY };

      if (isDragging) {
        // Orbit around lookAt center
        const offset = camera.position.clone().sub(targetLookAt.current);
        const radius = offset.length();
        let theta = Math.atan2(offset.y, offset.x);
        let phi = Math.acos(Math.min(Math.max(offset.z / radius, -1), 1));

        theta -= dx * 0.006;
        phi = Math.min(Math.max(phi - dy * 0.006, 0.08), Math.PI / 2 - 0.04);

        targetCameraPos.current.x = targetLookAt.current.x + radius * Math.sin(phi) * Math.cos(theta);
        targetCameraPos.current.y = targetLookAt.current.y + radius * Math.sin(phi) * Math.sin(theta);
        targetCameraPos.current.z = targetLookAt.current.z + radius * Math.cos(phi);
      } else if (isPanning) {
        // Pan camera and target
        const panSpeed = 0.04;
        targetCameraPos.current.x -= dx * panSpeed;
        targetLookAt.current.x -= dx * panSpeed;
        targetCameraPos.current.y += dy * panSpeed;
        targetLookAt.current.y += dy * panSpeed;
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
      isPanning = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      const offset = targetCameraPos.current.clone().sub(targetLookAt.current);
      if (offset.length() * zoomFactor > 3 && offset.length() * zoomFactor < 200) {
        offset.multiplyScalar(zoomFactor);
        targetCameraPos.current.copy(targetLookAt.current).add(offset);
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', handleMouseDown);
    domElement.addEventListener('wheel', handleWheel, { passive: false });
    domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Smooth Camera Lerp & Animation Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      // Smooth camera interpolation
      camera.position.lerp(targetCameraPos.current, 0.08);
      currentLookAt.current.lerp(targetLookAt.current, 0.08);
      camera.lookAt(currentLookAt.current);

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      domElement.removeEventListener('mousedown', handleMouseDown);
      domElement.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (domElement.parentElement) {
        domElement.parentElement.removeChild(domElement);
      }
    };
  }, [sceneId, colorMode]);

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }} ref={mountRef}>
      {/* Top-Left Floating HUD Chips */}
      <div
        style={{
          position: 'absolute',
          top: '14px',
          left: '14px',
          display: 'flex',
          gap: '8px',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <div
          className="glass-panel"
          style={{
            padding: '5px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
          }}
        >
          <div className="pulsing-dot" />
          <span>WEBGL 60 FPS</span>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: '5px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>HEAP:</span>
          <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>
            {telemetry ? `${telemetry.total_heap_mb.toFixed(2)} MB` : '3.26 MB'}
          </span>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: '5px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>ACTIVE CELLS:</span>
          <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
            {telemetry ? `${telemetry.active_cells.toLocaleString()}` : '47,307'}
          </span>
        </div>
      </div>

      {/* Top-Right Interactive Viewport Control Console */}
      <div
        style={{
          position: 'absolute',
          top: '14px',
          right: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 10,
        }}
      >
        {/* Camera Preset Selector */}
        <div
          className="glass-panel"
          style={{
            padding: '6px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <Camera size={13} style={{ color: 'var(--accent-cyan)', marginRight: '3px' }} />
          {(['orbit', 'bev', 'cockpit', 'cross_cut'] as CameraViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => handleCameraChange(mode)}
              style={{
                background: cameraMode === mode ? 'rgba(0, 240, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${cameraMode === mode ? 'var(--accent-cyan)' : 'transparent'}`,
                color: cameraMode === mode ? 'var(--accent-cyan)' : 'var(--text-muted)',
                borderRadius: '4px',
                padding: '3px 7px',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'uppercase',
                transition: 'all 0.15s ease',
              }}
            >
              {mode === 'bev' ? 'Top BEV' : mode === 'cross_cut' ? 'Side Cut' : mode}
            </button>
          ))}
        </div>

        {/* Color Palette Selector */}
        <div
          className="glass-panel"
          style={{
            padding: '6px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <Eye size={13} style={{ color: 'var(--accent-emerald)', marginRight: '3px' }} />
          {(['elevation', 'semantics', 'traversability'] as ColorMapMode[]).map((col) => (
            <button
              key={col}
              onClick={() => setColorMode(col)}
              style={{
                background: colorMode === col ? 'rgba(0, 230, 118, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${colorMode === col ? 'var(--accent-emerald)' : 'transparent'}`,
                color: colorMode === col ? 'var(--accent-emerald)' : 'var(--text-muted)',
                borderRadius: '4px',
                padding: '3px 7px',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s ease',
              }}
            >
              {col === 'traversability' ? 'Costmap' : col}
            </button>
          ))}
        </div>

        {/* Layer Toggles */}
        <div
          className="glass-panel"
          style={{
            padding: '6px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <Layers size={13} style={{ color: 'var(--accent-amber)', marginRight: '3px' }} />
          {[
            { label: 'Rings', state: showRings, toggle: () => setShowRings(!showRings) },
            { label: 'Traj', state: showTrajectory, toggle: () => setShowTrajectory(!showTrajectory) },
            { label: 'Slice', state: showSlice, toggle: () => setShowSlice(!showSlice) },
            { label: 'Trackers', state: showTrackers, toggle: () => setShowTrackers(!showTrackers) },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.toggle}
              style={{
                background: item.state ? 'rgba(255, 171, 0, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${item.state ? 'var(--accent-amber)' : 'transparent'}`,
                color: item.state ? 'var(--accent-amber)' : 'var(--text-muted)',
                borderRadius: '4px',
                padding: '3px 6px',
                fontSize: '9.5px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom-Left UGV Dynamics & Speedometer Overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: '14px',
          left: '14px',
          display: 'flex',
          gap: '10px',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <div
          className="glass-panel"
          style={{
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <Gauge size={18} style={{ color: 'var(--accent-cyan)' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>UGV VELOCITY</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
              15.0 m/s <small style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-muted)' }}>(54 km/h)</small>
            </span>
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <Compass size={18} style={{ color: 'var(--accent-emerald)' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>DYNAMIC FOVEA REACH</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-emerald)' }}>
              14.80 m <small style={{ fontSize: '10px', fontWeight: 400, color: 'var(--accent-emerald)' }}>(+48% Lookahead)</small>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
