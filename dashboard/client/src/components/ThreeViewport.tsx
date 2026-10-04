import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type {
  SceneId,
  TelemetryData,
  CameraViewMode,
  ColorMapMode,
  DEMDisplayMode,
  LayerVisibility,
  StressModeId,
} from '../types/telemetry';
import { getTurboColor, getTraversabilityColor, pointColorForClass, gradientCss } from '../theme/colormaps';
import { readSceneTokens, type SceneTokens } from '../theme/sceneTheme';
import { useTheme } from '../theme/theme';
import { disposeObject } from '../lib/disposeObject';

interface ThreeViewportProps {
  sceneId: SceneId;
  telemetry: TelemetryData | null;
  layerVisibility?: LayerVisibility;
  stressMode?: StressModeId;
  onLayerVisibilityChange?: (layers: LayerVisibility) => void;
  onStressModeChange?: (mode: StressModeId) => void;
  cameraMode?: CameraViewMode;
  onCameraModeChange?: (mode: CameraViewMode) => void;
  displayMode?: DEMDisplayMode;
  onDisplayModeChange?: (mode: DEMDisplayMode) => void;
  colorMode?: ColorMapMode;
  onColorModeChange?: (mode: ColorMapMode) => void;
  isWireframe?: boolean;
  onWireframeChange?: (val: boolean) => void;
  controlMode?: 'wasd' | 'playback';
  onControlModeChange?: (mode: 'wasd' | 'playback') => void;
  isPlaying?: boolean;
  onIsPlayingChange?: (playing: boolean) => void;
  currentFrame?: number;
  onFrameSeek?: (frame: number) => void;
  onCurrentFrameChange?: (frame: number) => void;
  playbackSpeed?: number;
  onPlaybackSpeedChange?: (speed: number) => void;
  onTelemetryUpdate?: (telem: { speed: number; heading: number; x: number; y: number; z: number }) => void;
  resetSignal?: number;
  showScaleBar?: boolean;
}



export const ThreeViewport: React.FC<ThreeViewportProps> = ({
  sceneId,
  telemetry: _telemetry,
  layerVisibility,
  stressMode = 'nominal',
  onLayerVisibilityChange: _onLayerVisibilityChange,
  cameraMode: propCameraMode,
  displayMode: propDisplayMode,
  onDisplayModeChange: _onDisplayModeChange,
  colorMode: propColorMode,
  isWireframe: propIsWireframe,
  controlMode: propControlMode,
  isPlaying: propIsPlaying,
  currentFrame: propCurrentFrame,
  onFrameSeek: _onFrameSeek,
  onCurrentFrameChange,
  playbackSpeed: propPlaybackSpeed,
  onTelemetryUpdate,
  resetSignal,
  showScaleBar = true,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;
  // Closures registered while building the scene; re-run on theme change so colours update in place.
  const themablesRef = useRef<((t: SceneTokens) => void)[]>([]);
  const realSemsRef = useRef<number[] | null>(null);
  const lastReportedFrameRef = useRef<number>(propCurrentFrame ?? 0);

  const activeLayers: LayerVisibility = layerVisibility ?? {
    demSurface: true,
    demVoxels: false,
    rawPoints: false,
    bridgeDeck: true,
    trajectory: true,
    trackers: true,
    foveaRings: true,
    sweepWave: false,
    headlights: true,
  };

  // FastDEM Viewport & Generation Controls
  const [cameraMode, setCameraMode] = useState<CameraViewMode>(propCameraMode ?? 'orbit');
  const [displayMode, setDisplayMode] = useState<DEMDisplayMode>(propDisplayMode ?? 'voxels');
  const [colorMode, setColorMode] = useState<ColorMapMode>(propColorMode ?? 'elevation');
  const [isWireframe, setIsWireframe] = useState<boolean>(propIsWireframe ?? false);
  const [showSweepWave] = useState<boolean>(false);
  const [showCloudOverlay] = useState<boolean>(false);

  // Foxglove / Rerun-inspired Replay & Timeline State
  const [controlMode, setControlMode] = useState<'wasd' | 'playback'>(propControlMode ?? 'wasd');
  const [isPlaying, setIsPlaying] = useState<boolean>(propIsPlaying ?? true);
  const [, setCurrentFrame] = useState<number>(propCurrentFrame ?? 0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(propPlaybackSpeed ?? 1);

  const controlModeRef = useRef<'wasd' | 'playback'>(controlMode);
  controlModeRef.current = controlMode;
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;
  const playbackSpeedRef = useRef<number>(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;
  const playbackProgressRef = useRef<number>(0);
  const trajCurveRef = useRef<THREE.CatmullRomCurve3 | null>(null);





  // Scene References for Dynamic Updates
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cameraModeRef = useRef<CameraViewMode>(cameraMode);
  cameraModeRef.current = cameraMode;

  const targetCameraPos = useRef<THREE.Vector3>(new THREE.Vector3(-9, 0, 4.2));
  const targetLookAt = useRef<THREE.Vector3>(new THREE.Vector3(3.5, 0, -1.0));
  const currentLookAt = useRef<THREE.Vector3>(new THREE.Vector3(3.5, 0, -1.0));
  const chaseZoomRef = useRef<number>(1.0);
  const bevHeightRef = useRef<number>(32.0);
  const cockpitFovRef = useRef<number>(45.0);

  const ringsGroupRef = useRef<THREE.Group | null>(null);
  const trajectoryGroupRef = useRef<THREE.Group | null>(null);
  const trackersGroupRef = useRef<THREE.Group | null>(null);
  const demSurfaceMeshRef = useRef<THREE.Mesh | null>(null);
  const demVoxelsMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const cloudPointsRef = useRef<THREE.Points | null>(null);
  const bridgeDeckMeshRef = useRef<THREE.Mesh | null>(null);
  const sweepRingMeshRef = useRef<THREE.Mesh | null>(null);
  const hoverCrosshairRef = useRef<THREE.Mesh | null>(null);
  const headlightsRef = useRef<THREE.SpotLight | null>(null);

  // UGV Vehicle Object References & Kinematic State
  const carGroupRef = useRef<THREE.Group | null>(null);
  const frontLeftWheelRef = useRef<THREE.Group | null>(null);
  const frontRightWheelRef = useRef<THREE.Group | null>(null);
  const wheelsMeshListRef = useRef<THREE.Mesh[]>([]);
  const lidarTurretRef = useRef<THREE.Mesh | null>(null);
  const carPhysicsRef = useRef({
    x: 0,
    y: 0,
    z: -1.41,
    heading: 0, // yaw in radians (0 = pointing +X)
    speed: 0, // forward velocity in m/s
    steerAngle: 0, // front wheel steering in radians
    pitch: 0,
    roll: 0,
    wheelRot: 0,
  });

  // Cached geometry and elevation matrices for in-place color updates
  const demGeometryRef = useRef<THREE.PlaneGeometry | null>(null);
  const zMatrixRef = useRef<number[][] | null>(null);
  const varMatrixRef = useRef<number[][] | null>(null);
  const semMatrixRef = useRef<number[][] | null>(null);
  const showSweepWaveRef = useRef<boolean>(showSweepWave);
  showSweepWaveRef.current = showSweepWave;

  // Handle Camera Mode Transitions
  const handleCameraChange = (mode: CameraViewMode) => {
    setCameraMode(mode);
    cameraModeRef.current = mode;
    if (!cameraRef.current) return;

    if (mode !== 'cockpit' && cameraRef.current.fov !== 45) {
      cameraRef.current.fov = 45;
      cameraRef.current.updateProjectionMatrix();
    }

    const car = carPhysicsRef.current;
    if (mode === 'chase') {
      cameraRef.current.up.set(0, 0, 1);
      const backDist = 9.0 * chaseZoomRef.current;
      const upDist = 4.2 * chaseZoomRef.current;
      targetCameraPos.current.set(
        car.x - Math.cos(car.heading) * backDist,
        car.y - Math.sin(car.heading) * backDist,
        car.z + upDist
      );
      targetLookAt.current.set(
        car.x + Math.cos(car.heading) * 3.5,
        car.y + Math.sin(car.heading) * 3.5,
        car.z + 0.5
      );
    } else if (mode === 'orbit') {
      cameraRef.current.up.set(0, 0, 1);
      targetCameraPos.current.set(car.x - 14, car.y - 14, car.z + 11);
      targetLookAt.current.set(car.x + 8, car.y, car.z);
    } else if (mode === 'bev') {
      cameraRef.current.up.set(1, 0, 0);
      targetCameraPos.current.set(car.x, car.y, car.z + bevHeightRef.current);
      targetLookAt.current.set(car.x, car.y, car.z);
    } else if (mode === 'cockpit') {
      cameraRef.current.up.set(0, 0, 1);
      targetCameraPos.current.set(car.x + 0.2, car.y, car.z + 0.6);
      targetLookAt.current.set(car.x + 25.0, car.y, car.z);
    }
  };

  // Lightweight Display Mode & ROS 2 Layer Toggles Effect
  useEffect(() => {
    if (demSurfaceMeshRef.current) {
      demSurfaceMeshRef.current.visible = activeLayers.demSurface && displayMode === 'surface';
      if (demSurfaceMeshRef.current.material instanceof THREE.MeshStandardMaterial) {
        demSurfaceMeshRef.current.material.wireframe = isWireframe;
      }
    }
    if (demVoxelsMeshRef.current) {
      demVoxelsMeshRef.current.visible = activeLayers.demVoxels || displayMode === 'voxels';
    }
    if (cloudPointsRef.current) {
      cloudPointsRef.current.visible = activeLayers.rawPoints || displayMode === 'points' || showCloudOverlay;
    }
    if (bridgeDeckMeshRef.current) {
      bridgeDeckMeshRef.current.visible = activeLayers.bridgeDeck;
    }
    if (trajectoryGroupRef.current) {
      trajectoryGroupRef.current.visible = activeLayers.trajectory;
    }
    if (trackersGroupRef.current) {
      trackersGroupRef.current.visible = activeLayers.trackers;
    }
    if (sweepRingMeshRef.current) {
      sweepRingMeshRef.current.visible = activeLayers.sweepWave && showSweepWave;
    }
    if (ringsGroupRef.current) {
      ringsGroupRef.current.visible = activeLayers.foveaRings;
    }
    if (headlightsRef.current) {
      headlightsRef.current.visible = activeLayers.headlights;
    }
  }, [displayMode, isWireframe, showCloudOverlay, showSweepWave, activeLayers]);

  // Re-colour the existing scene when the theme changes (no rebuild, camera and playback preserved).
  useEffect(() => {
    const T = readSceneTokens(theme);
    themablesRef.current.forEach((fn) => fn(T));
    const pts = cloudPointsRef.current;
    const sems = realSemsRef.current;
    if (pts && sems && pts.geometry.attributes.color && pts.geometry.attributes.position) {
      const pos = pts.geometry.attributes.position.array as Float32Array;
      const col = pts.geometry.attributes.color.array as Float32Array;
      for (let i = 0; i < sems.length; i++) {
        const c = pointColorForClass(sems[i], pos[i * 3 + 2], theme);
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
      }
      pts.geometry.attributes.color.needsUpdate = true;
    }
  }, [theme]);

  // Sensor dropout preview (visual only): hides half of the drawn points.
  useEffect(() => {
    if (!cloudPointsRef.current) return;
    const geom = cloudPointsRef.current.geometry;
    if (stressMode === 'dropout_50') {
      geom.setDrawRange(0, 2400); // 50% beam occlusion
    } else {
      geom.setDrawRange(0, 4800);
    }
  }, [stressMode]);

  // Seamless In-Place Vertex Colormap Updating (Preserves Camera & Mesh)
  useEffect(() => {
    if (!demGeometryRef.current || !zMatrixRef.current || !varMatrixRef.current || !semMatrixRef.current) return;
    const demGeo = demGeometryRef.current;
    const demColors = demGeo.attributes.color.array as Float32Array;
    const demNormals = demGeo.attributes.normal.array as Float32Array;
    const zMin = -2.25;
    const zMax = 2.0;

    for (let iy = 0; iy < 70; iy++) {
      for (let ix = 0; ix < 110; ix++) {
        const vIdx = iy * 110 + ix;
        const z = zMatrixRef.current[iy][ix];
        const variance = varMatrixRef.current[iy][ix];
        const semId = semMatrixRef.current[iy][ix];

        const nz = Math.max(Math.min(demNormals[vIdx * 3 + 2], 1.0), 0.0);
        const slopeDeg = Math.acos(nz) * (180.0 / Math.PI);

        let r = 0, g = 0.9, b = 0.46;

        if (colorMode === 'elevation') {
          const normZ = (z - zMin) / (zMax - zMin);
          const col = getTurboColor(normZ);
          r = col.r; g = col.g; b = col.b;
        } else if (colorMode === 'traversability') {
          const col = getTraversabilityColor(slopeDeg);
          r = col.r; g = col.g; b = col.b;
        } else if (colorMode === 'uncertainty') {
          const normV = Math.min(variance / 0.06, 1.0);
          r = 0.05 * (1 - normV) + 1.0 * normV;
          g = 0.7 * (1 - normV) + 0.1 * normV;
          b = 0.9 * (1 - normV) + 0.3 * normV;
        } else if (colorMode === 'semantics') {
          if (semId === 40) { r = 0.0; g = 0.85; b = 0.45; }
          else if (semId === 15) { r = 0.0; g = 0.94; b = 1.0; }
          else if (semId === 10) { r = 0.7; g = 0.53; b = 1.0; }
          else if (semId === 99) { r = 1.0; g = 0.67; b = 0.0; }
          else { r = 1.0; g = 0.1; b = 0.25; }
        }

        demColors[vIdx * 3] = r;
        demColors[vIdx * 3 + 1] = g;
        demColors[vIdx * 3 + 2] = b;
      }
    }
    demGeo.attributes.color.needsUpdate = true;

    // In-place colormap updating for Foveated LiDAR laser points
    if (cloudPointsRef.current && cloudPointsRef.current.geometry) {
      const ptGeo = cloudPointsRef.current.geometry;
      const posAttr = ptGeo.attributes.position;
      const colAttr = ptGeo.attributes.color;
      if (posAttr && colAttr) {
        const pos = posAttr.array as Float32Array;
        const col = colAttr.array as Float32Array;
        const count = posAttr.count;
        const elevZMin = -2.35;
        const elevZMax = 1.00;

        for (let i = 0; i < count; i++) {
          const py = pos[i * 3 + 1];
          const pz = pos[i * 3 + 2];
          const isOverhang = pz > 0.3;
          const isCrater = pz < -1.85;

          let cr = 0.2, cg = 0.7, cb = 0.9;
          if (colorMode === 'traversability') {
            // Slope hazard: Green for flat traversable road, Yellow for medium gradient, Red for steep drop/obstacle
            if (isOverhang) {
              cr = 1.0; cg = 0.2; cb = 0.2; // Red ceiling limit
            } else if (isCrater) {
              cr = 0.95; cg = 0.15; cb = 0.15; // Red crater hazard
            } else {
              const dev = Math.abs(pz - (-1.73));
              if (dev < 0.05) {
                cr = 0.0; cg = 0.88; cb = 0.45; // Safe flat road
              } else if (dev < 0.2) {
                cr = 0.95; cg = 0.75; cb = 0.1; // Warning slope
              } else {
                cr = 0.95; cg = 0.15; cb = 0.2; // Untraversable
              }
            }
          } else if (colorMode === 'uncertainty') {
            // Lateral distance (illustrative): Emerald green in core path, Cyan in transition, Purple in outer fringe
            const distFromCenter = Math.abs(py);
            if (distFromCenter < 3.5) { cr = 0.05; cg = 0.92; cb = 0.52; }
            else if (distFromCenter < 7.5) { cr = 0.15; cg = 0.72; cb = 0.95; }
            else { cr = 0.65; cg = 0.35; cb = 0.92; }
          } else {
            // Height Elevation: Turbo Jet spectrum (Blue -> Cyan -> Green -> Yellow -> Red)
            const normZ = Math.min(Math.max((pz - elevZMin) / (elevZMax - elevZMin), 0.0), 1.0);
            const tc = getTurboColor(normZ);
            cr = tc.r; cg = tc.g; cb = tc.b;
          }

          col[i * 3] = cr;
          col[i * 3 + 1] = cg;
          col[i * 3 + 2] = cb;
        }
        colAttr.needsUpdate = true;
      }
    }

    // In-place colormap updating for 2.5D Instanced Voxel Columns
    if (demVoxelsMeshRef.current && demVoxelsMeshRef.current.instanceColor) {
      const voxelMesh = demVoxelsMeshRef.current;
      const count = voxelMesh.count;
      const instColor = new THREE.Color();
      const voxStep = 1.6;
      const voxMinX = -2.0;
      const voxMinY = -10.0;
      const countY = Math.floor((10.0 - voxMinY) / voxStep);

      for (let idx = 0; idx < count; idx++) {
        const ix = Math.floor(idx / countY);
        const iy = idx % countY;
        const vx = voxMinX + ix * voxStep;
        const vy = voxMinY + iy * voxStep;
        // Sample height & variance
        const devY = Math.abs(vy);
        if (colorMode === 'traversability') {
          if (devY > 7.0 && sceneId === 'scene_a_bridge' && vx >= 15.0 && vx <= 25.0) {
            instColor.setRGB(0.95, 0.15, 0.2); // Red obstacle
          } else {
            instColor.setRGB(0.0, 0.88, 0.45); // Drivable green
          }
        } else if (colorMode === 'uncertainty') {
          if (devY < 3.5) instColor.setRGB(0.05, 0.92, 0.52);
          else if (devY < 7.5) instColor.setRGB(0.15, 0.72, 0.95);
          else instColor.setRGB(0.65, 0.35, 0.92);
        } else {
          instColor.setRGB(0.1, 0.7, 0.9);
        }
        voxelMesh.setColorAt(idx, instColor);
      }
      if (voxelMesh.instanceColor) voxelMesh.instanceColor.needsUpdate = true;
    }
  }, [colorMode, sceneId]);

  // Main Three.js Scene Setup & 60 FPS Render Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    playbackProgressRef.current = 0;
    setCurrentFrame(0);
    const carInit = carPhysicsRef.current;
    carInit.x = -2.0;
    carInit.y = 0.0;
    carInit.heading = 0.0;
    carInit.speed = 0.0;
    carInit.steerAngle = 0.0;

    const T0 = readSceneTokens(themeRef.current);
    themablesRef.current = [];
    const reg = (fn: (t: SceneTokens) => void) => {
      fn(T0);
      themablesRef.current.push(fn);
    };
    const shade = (c: string, k: number) => new THREE.Color(c).multiplyScalar(k);

    const scene = new THREE.Scene();
    const bgColor = new THREE.Color();
    scene.background = bgColor;
    reg((T) => bgColor.set(T.bg));

    // Directional & Ambient Lighting for FastDEM Relief Shading
    const dirLight1 = new THREE.DirectionalLight('white', 1.2);
    reg((T) => {
      dirLight1.intensity = T.key;
    });
    dirLight1.position.set(-20, -30, 40);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight('lightgray', 0.4);
    dirLight2.position.set(30, 20, 20);
    scene.add(dirLight2);

    const ambLight = new THREE.AmbientLight('white', 0.9);
    reg((T) => {
      ambLight.intensity = T.ambient;
    });
    scene.add(ambLight);

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
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Absolutely positioned and CSS-sized so the canvas never forces the layout wider than its container.
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    container.appendChild(renderer.domElement);

    // Subtle Ground Reference Grid (Clean light mode slate)
    // GridHelper bakes its colours into vertex colours, so it is rebuilt when the theme changes.
    let gridHelper: THREE.GridHelper | null = null;
    reg((T) => {
      if (gridHelper) {
        scene.remove(gridHelper);
        disposeObject(gridHelper);
      }
      gridHelper = new THREE.GridHelper(100, 50, T.gridMajor, T.gridMinor);
      gridHelper.rotation.x = Math.PI / 2;
      gridHelper.position.z = -1.73;
      scene.add(gridHelper);
    });

    // 1. Fovea Nested Lattice Ring Boundaries
    const ringsGroup = new THREE.Group();
    ringsGroupRef.current = ringsGroup;
    scene.add(ringsGroup);

    // Range rings follow the four lattice rings (10 / 25 / 50 / 100 m); colours come from --scene-ring-N.
    const ringRadii = [10.0, 25.0, 50.0, 100.0];
    ringRadii.forEach((radius, idx) => {
      const ringGeo = new THREE.RingGeometry(radius - 0.05, radius + 0.05, 160);
      const ringMat = new THREE.MeshBasicMaterial({
        color: T0.ring[idx],
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      });
      reg((T) => ringMat.color.set(T.ring[idx]));
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.z = -1.72;
      ringsGroup.add(ringMesh);
    });

    // 2. Autonomous UGV Vehicle Model (Tactical Cyber-Chassis + Spinning LiDAR + Active Steering)
    const carGroup = new THREE.Group();
    carGroupRef.current = carGroup;
    scene.add(carGroup);

    // Chassis Lower Hull (Clean slate finish)
    const chassisGeo = new THREE.BoxGeometry(2.3, 1.25, 0.42);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: T0.ugv,
      metalness: 0.6,
      roughness: 0.35,
    });
    reg((T) => chassisMat.color.set(T.ugv));
    const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
    chassisMesh.position.z = 0.0;
    carGroup.add(chassisMesh);

    // Cabin / Sensor Enclosure (Tinted dark glass)
    const cabinGeo = new THREE.BoxGeometry(1.2, 0.95, 0.36);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: shade(T0.ugv, 0.55),
      metalness: 0.7,
      roughness: 0.2,
      transparent: true,
      opacity: 0.85,
    });
    reg((T) => cabinMat.color.copy(shade(T.ugv, 0.55)));
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.set(-0.2, 0, 0.35);
    carGroup.add(cabinMesh);

    // Cabin Subtle Trim
    const trimGeo = new THREE.BoxGeometry(1.22, 0.97, 0.04);
    const trimMat = new THREE.MeshStandardMaterial({ color: T0.ugvTrim, metalness: 0.5, roughness: 0.4 });
    reg((T) => trimMat.color.set(T.ugvTrim));
    const trimMesh = new THREE.Mesh(trimGeo, trimMat);
    trimMesh.position.set(-0.2, 0, 0.52);
    carGroup.add(trimMesh);

    // Four Wheels with Rubber Treads & Matte Silver Rims
    const wheelTireGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16);
    const wheelRimGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.24, 16);
    const tireMat = new THREE.MeshStandardMaterial({ color: shade(T0.ugv, 0.45), roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: T0.ugvTrim, metalness: 0.6, roughness: 0.3 });
    reg((T) => {
      tireMat.color.copy(shade(T.ugv, 0.45));
      rimMat.color.set(T.ugvTrim);
    });

    const makeWheel = () => {
      const wGroup = new THREE.Group();
      const tire = new THREE.Mesh(wheelTireGeo, tireMat);
      tire.rotation.x = Math.PI / 2;
      const rim = new THREE.Mesh(wheelRimGeo, rimMat);
      rim.rotation.x = Math.PI / 2;
      wGroup.add(tire);
      wGroup.add(rim);
      return { group: wGroup, tire, rim };
    };

    // Front Left & Right (pivot with steerAngle)
    const fl = makeWheel();
    fl.group.position.set(0.75, 0.72, -0.12);
    carGroup.add(fl.group);
    frontLeftWheelRef.current = fl.group;

    const fr = makeWheel();
    fr.group.position.set(0.75, -0.72, -0.12);
    carGroup.add(fr.group);
    frontRightWheelRef.current = fr.group;

    // Rear Left & Right (fixed steer, roll only)
    const rl = makeWheel();
    rl.group.position.set(-0.75, 0.72, -0.12);
    carGroup.add(rl.group);

    const rr = makeWheel();
    rr.group.position.set(-0.75, -0.72, -0.12);
    carGroup.add(rr.group);

    wheelsMeshListRef.current = [fl.tire, fl.rim, fr.tire, fr.rim, rl.tire, rl.rim, rr.tire, rr.rim];

    // Front Twin Headlights + Neutral Spotlight Cones
    const hlGeo = new THREE.BoxGeometry(0.08, 0.18, 0.1);
    const hlMat = new THREE.MeshBasicMaterial({ color: 'white' });
    const hlLeft = new THREE.Mesh(hlGeo, hlMat);
    hlLeft.position.set(1.15, 0.42, 0.05);
    carGroup.add(hlLeft);

    const hlRight = new THREE.Mesh(hlGeo, hlMat);
    hlRight.position.set(1.15, -0.42, 0.05);
    carGroup.add(hlRight);

    const spotLight1 = new THREE.SpotLight('white', 2.0, 30, Math.PI / 5, 0.4, 1.2);
    spotLight1.position.set(1.2, 0.42, 0.1);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(12, 0.42, -1.0);
    carGroup.add(spotTarget);
    spotLight1.target = spotTarget;
    spotLight1.visible = activeLayers.headlights;
    headlightsRef.current = spotLight1;
    carGroup.add(spotLight1);

    // Rear Taillights (Muted Crimson)
    const tlGeo = new THREE.BoxGeometry(0.08, 0.18, 0.08);
    const tlMat = new THREE.MeshBasicMaterial({ color: 'crimson' });
    const tlLeft = new THREE.Mesh(tlGeo, tlMat);
    tlLeft.position.set(-1.15, 0.42, 0.05);
    carGroup.add(tlLeft);

    const tlRight = new THREE.Mesh(tlGeo, tlMat);
    tlRight.position.set(-1.15, -0.42, 0.05);
    carGroup.add(tlRight);

    // Roof Spinning LiDAR Sensor Turret Puck
    const lidarBaseGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.18, 16);
    const lidarBaseMat = new THREE.MeshStandardMaterial({ color: shade(T0.ugvTrim, 0.8), metalness: 0.7, roughness: 0.3 });
    reg((T) => lidarBaseMat.color.copy(shade(T.ugvTrim, 0.8)));
    const lidarBase = new THREE.Mesh(lidarBaseGeo, lidarBaseMat);
    lidarBase.position.set(-0.2, 0, 0.62);
    carGroup.add(lidarBase);

    const lidarPuckGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.14, 16);
    const lidarPuckMat = new THREE.MeshStandardMaterial({ color: T0.ugvAccent, metalness: 0.6, roughness: 0.3 });
    reg((T) => lidarPuckMat.color.set(T.ugvAccent));
    const lidarPuck = new THREE.Mesh(lidarPuckGeo, lidarPuckMat);
    lidarPuck.position.set(-0.2, 0, 0.76);
    carGroup.add(lidarPuck);
    lidarTurretRef.current = lidarPuck;

    const laserStripGeo = new THREE.BoxGeometry(0.04, 0.25, 0.04);
    const laserStripMat = new THREE.MeshBasicMaterial({ color: 'cyan' });
    const laserStrip = new THREE.Mesh(laserStripGeo, laserStripMat);
    laserStrip.position.set(0.08, 0, 0);
    lidarPuck.add(laserStrip);

    // ROS REP-103 Axes: Red = +X Forward, Green = +Y Left, Blue = +Z Up
    const axesHelper = new THREE.AxesHelper(1.8);
    axesHelper.position.set(0, 0, 0.2);
    carGroup.add(axesHelper);

    // ==========================================
    // 3. FastDEM Continuous Elevation Heightfield Mesh
    // ==========================================
    const demGridX = 110;
    const demGridY = 70;
    const demMinX = -5.0;
    const demMaxX = 45.0;
    const demMinY = -15.0;
    const demMaxY = 15.0;
    const dx = (demMaxX - demMinX) / (demGridX - 1);
    const dy = (demMaxY - demMinY) / (demGridY - 1);

    // Height function returning (elevation Z, roughness/variance, semantic ID)
    const evalElevation = (x: number, y: number): { z: number; variance: number; semId: number; isBridgeDeck: boolean } => {
      // Gentle natural road grade rolling undulation
      let z = -1.73 + 0.035 * Math.sin(0.15 * x) * Math.cos(0.2 * y);
      let variance = 0.002;
      let semId = 40; // Road
      let isBridgeDeck = false;

      // Scene A: Bridge Underpass & Pillars
      if (sceneId === 'scene_a_bridge') {
        if (x >= 15.0 && x <= 25.0) {
          if (Math.abs(y) >= 7.0 && Math.abs(y) <= 9.0) {
            z = 1.6; // Bridge Pillar
            semId = 50;
            variance = 0.015;
          } else {
            // Underpass ground road level
            z = -1.73;
            isBridgeDeck = true;
          }
        }
      }

      // Scene B: Potholes / Negative Obstacles
      if (sceneId === 'scene_b_potholes') {
        const craters = [
          { cx: 8.0, cy: 0.0, rad: 1.2, depth: -0.38 },
          { cx: 16.0, cy: 2.2, rad: 0.9, depth: -0.32 },
          { cx: 23.0, cy: -1.8, rad: 1.4, depth: -0.44 },
        ];
        for (const crater of craters) {
          const dist = Math.hypot(x - crater.cx, y - crater.cy);
          if (dist < crater.rad) {
            const bell = Math.cos((dist / crater.rad) * (Math.PI / 2));
            z += crater.depth * bell;
            variance = 0.08 * bell;
            semId = 99; // Pothole
            break;
          }
        }
      }

      // Scene C: Moving Traffic (Clean road surface; the dynamic vehicle and anti-ghost tracking are rendered via 3D meshes)
      // No static hump baked into the heightfield so vehicles drive cleanly on the road!

      // Scene D: Thin Pole Array (Slalom obstacles staggered directly in the driving corridor)
      if (sceneId === 'scene_d_poles') {
        const poles = [
          { x: 8.0, y: 0.0 },    // Directly in front of the vehicle
          { x: 18.0, y: -1.3 },  // Off-center left
          { x: 28.0, y: 1.1 },   // Off-center right
          { x: 38.0, y: -0.4 },  // Near corridor exit
        ];
        for (const p of poles) {
          if (Math.hypot(x - p.x, y - p.y) < 0.35) {
            z = 0.6; // Base footprint
            semId = 80;
            variance = 0.02;
            break;
          }
        }
      }

      return { z, variance, semId, isBridgeDeck };
    };

    // Construct Heightfield Mesh Buffer Geometry
    const demGeo = new THREE.PlaneGeometry(
      demMaxX - demMinX,
      demMaxY - demMinY,
      demGridX - 1,
      demGridY - 1
    );

    // PlaneGeometry creates vertices in XY plane; we reposition so X, Y map to road grid, Z to elevation
    const demPositions = demGeo.attributes.position.array as Float32Array;
    const demColors = new Float32Array(demGridX * demGridY * 3);

    // Normal estimation scratchpad
    const zMatrix: number[][] = Array.from({ length: demGridY }, () => new Array(demGridX).fill(0));
    const varMatrix: number[][] = Array.from({ length: demGridY }, () => new Array(demGridX).fill(0));
    const semMatrix: number[][] = Array.from({ length: demGridY }, () => new Array(demGridX).fill(0));

    // Pass 1: Fill elevations and matrices
    for (let iy = 0; iy < demGridY; iy++) {
      for (let ix = 0; ix < demGridX; ix++) {
        const x = demMinX + ix * dx;
        const y = demMaxY - iy * dy;
        const { z, variance, semId } = evalElevation(x, y);
        zMatrix[iy][ix] = z;
        varMatrix[iy][ix] = variance;
        semMatrix[iy][ix] = semId;

        const vIdx = iy * demGridX + ix;
        demPositions[vIdx * 3] = x;
        demPositions[vIdx * 3 + 1] = y;
        demPositions[vIdx * 3 + 2] = z;
      }
    }
    demGeo.computeVertexNormals();

    // Pass 2: Assign FastDEM vertex colors according to active colorMode
    const demNormals = demGeo.attributes.normal.array as Float32Array;
    const zMin = -2.25;
    const zMax = 2.0;

    for (let iy = 0; iy < demGridY; iy++) {
      for (let ix = 0; ix < demGridX; ix++) {
        const vIdx = iy * demGridX + ix;
        const z = zMatrix[iy][ix];
        const variance = varMatrix[iy][ix];
        const semId = semMatrix[iy][ix];

        // Normal slope angle: nz is normal dot (0, 0, 1)
        const nz = Math.max(Math.min(demNormals[vIdx * 3 + 2], 1.0), 0.0);
        const slopeDeg = Math.acos(nz) * (180.0 / Math.PI);

        let r = 0, g = 0.9, b = 0.46;

        if (colorMode === 'elevation') {
          const normZ = (z - zMin) / (zMax - zMin);
          const col = getTurboColor(normZ);
          r = col.r; g = col.g; b = col.b;
        } else if (colorMode === 'traversability') {
          const col = getTraversabilityColor(slopeDeg);
          r = col.r; g = col.g; b = col.b;
        } else if (colorMode === 'uncertainty') {
          // Welford variance heatmap: 0.001 (cool teal) to 0.08 (hot magenta/orange)
          const normV = Math.min(variance / 0.06, 1.0);
          r = 0.05 * (1 - normV) + 1.0 * normV;
          g = 0.7 * (1 - normV) + 0.1 * normV;
          b = 0.9 * (1 - normV) + 0.3 * normV;
        } else if (colorMode === 'semantics') {
          if (semId === 40) { r = 0.0; g = 0.85; b = 0.45; } // Road
          else if (semId === 15) { r = 0.0; g = 0.94; b = 1.0; } // Overhang
          else if (semId === 10) { r = 0.7; g = 0.53; b = 1.0; } // Dynamic Car
          else if (semId === 99) { r = 1.0; g = 0.67; b = 0.0; } // Pothole
          else { r = 1.0; g = 0.1; b = 0.25; } // Obstacle / Pillar
        }

        demColors[vIdx * 3] = r;
        demColors[vIdx * 3 + 1] = g;
        demColors[vIdx * 3 + 2] = b;
      }
    }

    demGeo.setAttribute('color', new THREE.BufferAttribute(demColors, 3));
    demGeo.attributes.position.needsUpdate = true;

    const demMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.4,
      metalness: 0.15,
      wireframe: isWireframe,
      flatShading: false,
    });
    const demMesh = new THREE.Mesh(demGeo, demMaterial);
    demSurfaceMeshRef.current = demMesh;
    demGeometryRef.current = demGeo;
    zMatrixRef.current = zMatrix;
    varMatrixRef.current = varMatrix;
    semMatrixRef.current = semMatrix;
    demMesh.visible = displayMode === 'surface' && sceneId !== 'real_seq08_f00';
    scene.add(demMesh);

    // ==========================================
    // 4. FastDEM Overhang Upper Deck (Scene A Dual Elevation)
    // ==========================================
    if (sceneId === 'scene_a_bridge') {
      const bridgeGeo = new THREE.BoxGeometry(10.0, 18.0, 0.45);
      const bridgeMat = new THREE.MeshStandardMaterial({
        color: T0.prop,
        roughness: 0.7,
        metalness: 0.2,
      });
      reg((T) => bridgeMat.color.set(T.prop));
      const bridgeMesh = new THREE.Mesh(bridgeGeo, bridgeMat);
      bridgeMesh.position.set(20.0, 0.0, 0.8);
      bridgeDeckMeshRef.current = bridgeMesh;
      scene.add(bridgeMesh);

      // Support columns on left and right sides
      const colGeo = new THREE.BoxGeometry(0.8, 0.8, 2.5);
      const colMat = new THREE.MeshStandardMaterial({ color: T0.prop2, roughness: 0.8 });
      reg((T) => colMat.color.set(T.prop2));
      const leftCol = new THREE.Mesh(colGeo, colMat);
      leftCol.position.set(20.0, 7.5, -0.45);
      scene.add(leftCol);
      const rightCol = new THREE.Mesh(colGeo, colMat);
      rightCol.position.set(20.0, -7.5, -0.45);
      scene.add(rightCol);
    }

    // 4b. 3D Obstacle Bollards & Posts (Scene D: Slalom Obstacles)
    if (sceneId === 'scene_d_poles') {
      const obstaclePoles = [
        { x: 8.0, y: 0.0 },
        { x: 18.0, y: -1.3 },
        { x: 28.0, y: 1.1 },
        { x: 38.0, y: -0.4 },
      ];
      const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.2, 16);
      const poleMat = new THREE.MeshStandardMaterial({ color: T0.pole, roughness: 0.35, metalness: 0.2 });
      reg((T) => poleMat.color.set(T.pole));
      const stripeGeo = new THREE.CylinderGeometry(0.125, 0.125, 0.35, 16);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 'white' });

      obstaclePoles.forEach((p) => {
        const pm = new THREE.Mesh(poleGeo, poleMat);
        pm.position.set(p.x, p.y, -0.6); // Base on ground at -1.7, top at +0.5
        scene.add(pm);

        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.set(p.x, p.y, 0.0);
        scene.add(stripe);
      });
    }

    // ==========================================
    // 5. FastDEM 2.5D Elevation Column Voxels (InstancedMesh)
    // ==========================================
    const voxStep = 1.6;
    const voxMinX = -2.0, voxMaxX = 42.0;
    const voxMinY = -10.0, voxMaxY = 10.0;
    const countX = Math.floor((voxMaxX - voxMinX) / voxStep);
    const countY = Math.floor((voxMaxY - voxMinY) / voxStep);
    const voxelCount = countX * countY;
    const boxGeo = new THREE.BoxGeometry(0.5, 0.5, 1.0);
    const voxelMat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1 });
    const voxelMesh = new THREE.InstancedMesh(boxGeo, voxelMat, voxelCount);
    voxelMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    demVoxelsMeshRef.current = voxelMesh;
    voxelMesh.visible = displayMode === 'voxels' && sceneId !== 'real_seq08_f00';

    const dummy = new THREE.Object3D();
    const instColor = new THREE.Color();
    let vIdx = 0;
    for (let ix = 0; ix < countX; ix++) {
      for (let iy = 0; iy < countY; iy++) {
        const vx = voxMinX + ix * voxStep;
        const vy = voxMinY + iy * voxStep;
        const { z } = evalElevation(vx, vy);

        const h = Math.max(z - (-1.85), 0.1);
        dummy.position.set(vx, vy, -1.85 + h / 2);
        dummy.scale.set(0.65, 0.65, h);
        dummy.updateMatrix();
        voxelMesh.setMatrixAt(vIdx, dummy.matrix);

        const normZ = Math.min(Math.max((z - zMin) / (zMax - zMin), 0), 1);
        const col = getTurboColor(normZ);
        instColor.setRGB(col.r, col.g, col.b);
        voxelMesh.setColorAt(vIdx, instColor);
        vIdx++;
      }
    }
    voxelMesh.instanceMatrix.needsUpdate = true;
    if (voxelMesh.instanceColor) voxelMesh.instanceColor.needsUpdate = true;
    scene.add(voxelMesh);

    // ==========================================
    // 6. FastDEM Authentic 2.5D Foveated LiDAR Elevation Grid (~18,000 Points)
    // ==========================================
    const ptsList: number[] = [];
    const colsList: number[] = [];

    // Elevation colormap scale for rich 2.5D visual contrast
    const elevZMin = -2.35;
    const elevZMax = 1.00;

    const getColorForPoint = (_x: number, y: number, z: number, variance: number, isOverhang: boolean = false): [number, number, number] => {
      if (colorMode === 'traversability') {
        const slope = isOverhang ? 0.95 : Math.min(variance * 18.0, 1.0);
        return [
          0.05 * (1 - slope) + 0.95 * slope,
          0.85 * (1 - slope) + 0.10 * slope,
          0.30 * (1 - slope) + 0.10 * slope,
        ];
      }
      if (colorMode === 'uncertainty') {
        // High confidence (emerald) in driving corridor, lower (purple) at edges
        const distFromCenter = Math.abs(y);
        if (distFromCenter < 3.5) return [0.10, 0.95, 0.55]; // Core fovea (Ring 0)
        if (distFromCenter < 7.5) return [0.15, 0.70, 0.95]; // Corridor (Ring 1)
        return [0.55, 0.35, 0.90];                          // Periphery (Ring 2)
      }
      // Default: 2.5D Height Elevation Turbo Spectrum
      const normZ = Math.min(Math.max((z - elevZMin) / (elevZMax - elevZMin), 0.0), 1.0);
      const tc = getTurboColor(normZ);
      return [tc.r, tc.g, tc.b];
    };

    // --- TIER 1: Core Navigation Corridor (|y| <= 3.5m) -> 5cm to 15cm Dense Fovea Grid ---
    for (let x = -4.0; x <= 44.0; x += 0.28) {
      for (let y = -3.5; y <= 3.5; y += 0.28) {
        const { z, variance } = evalElevation(x, y);
        ptsList.push(x, y, z);
        const [r, g, b] = getColorForPoint(x, y, z, variance);
        colsList.push(r, g, b);
      }
    }

    // --- TIER 2: Transition Corridor (3.5m < |y| <= 7.5m) -> 35cm Variable Resolution ---
    for (let x = -4.0; x <= 44.0; x += 0.55) {
      for (let y = -7.5; y <= 7.5; y += 0.55) {
        if (Math.abs(y) <= 3.5) continue; // Already covered by Tier 1
        const { z, variance } = evalElevation(x, y);
        ptsList.push(x, y, z);
        const [r, g, b] = getColorForPoint(x, y, z, variance);
        colsList.push(r, g, b);
      }
    }

    // --- TIER 3: Outer Periphery (7.5m < |y| <= 14.0m) -> 85cm Coarse Horizon ---
    for (let x = -4.0; x <= 44.0; x += 0.95) {
      for (let y = -14.0; y <= 14.0; y += 0.95) {
        if (Math.abs(y) <= 7.5) continue; // Already covered by Tier 1 & 2
        const { z, variance } = evalElevation(x, y);
        ptsList.push(x, y, z);
        const [r, g, b] = getColorForPoint(x, y, z, variance);
        colsList.push(r, g, b);
      }
    }

    // --- SCENARIO A: Bridge Underpass DUAL-ELEVATION 2.5D LAYERS ---
    if (sceneId === 'scene_a_bridge') {
      // 1. Overhead Canopy Ceiling Layer (Z = +0.80m)
      for (let bx = 15.0; bx <= 25.0; bx += 0.35) {
        for (let by = -7.5; by <= 7.5; by += 0.35) {
          const bz = 0.80 + (Math.random() * 0.02 - 0.01);
          ptsList.push(bx, by, bz);
          const [r, g, b] = getColorForPoint(bx, by, bz, 0.08, true);
          colsList.push(r, g, b);
        }
      }
      // 2. Vertical Bridge Pillar Columns (Left & Right)
      const colYPositions = [-7.5, 7.5];
      colYPositions.forEach((cy) => {
        for (let bx = 19.5; bx <= 20.5; bx += 0.25) {
          for (let pz = -1.73; pz <= 0.85; pz += 0.12) {
            ptsList.push(bx, cy, pz);
            const [r, g, b] = getColorForPoint(bx, cy, pz, 0.05);
            colsList.push(r, g, b);
          }
        }
      });
    }

    // --- SCENARIO B: Potholes / Negative Obstacle Dense Elevation Depth Profile ---
    if (sceneId === 'scene_b_potholes') {
      const craters = [
        { cx: 8.0, cy: 0.0, rad: 1.3, depth: -0.55 },
        { cx: 16.0, cy: 2.2, rad: 1.0, depth: -0.45 },
        { cx: 23.0, cy: -1.8, rad: 1.5, depth: -0.60 },
      ];
      craters.forEach((crater) => {
        // High density concentric rings inside each pothole to showcase negative 2.5D crater depth
        for (let r = 0.1; r <= crater.rad; r += 0.12) {
          const numP = Math.max(Math.floor(r * 28), 8);
          for (let a = 0; a < numP; a++) {
            const th = (a / numP) * Math.PI * 2;
            const px = crater.cx + r * Math.cos(th);
            const py = crater.cy + r * Math.sin(th);
            const bell = Math.cos((r / crater.rad) * (Math.PI / 2));
            const pz = -1.73 + crater.depth * bell;
            ptsList.push(px, py, pz);
            const [cr, cg, cb] = getColorForPoint(px, py, pz, 0.09 * bell);
            colsList.push(cr, cg, cb);
          }
        }
      });
    }

    // --- SCENARIO D: Slalom Obstacle Bollards (Vertical 2.5D Return Columns) ---
    if (sceneId === 'scene_d_poles') {
      const obstaclePoles = [
        { x: 8.0, y: 0.0 },
        { x: 18.0, y: -1.3 },
        { x: 28.0, y: 1.1 },
        { x: 38.0, y: -0.4 },
      ];
      obstaclePoles.forEach((p) => {
        for (let pz = -1.73; pz <= 0.60; pz += 0.07) {
          for (let ang = 0; ang < 10; ang++) {
            const rad = 0.14;
            const th = (ang / 10) * Math.PI * 2;
            const px = p.x + rad * Math.cos(th);
            const py = p.y + rad * Math.sin(th);
            ptsList.push(px, py, pz);
            const [cr, cg, cb] = getColorForPoint(px, py, pz, 0.04);
            colsList.push(cr, cg, cb);
          }
        }
      });
    }

    const ptGeo = new THREE.BufferGeometry();
    ptGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ptsList), 3));
    ptGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colsList), 3));
    const ptMat = new THREE.PointsMaterial({ size: 0.17, vertexColors: true, transparent: true, opacity: 0.95 });
    const cloudPoints = new THREE.Points(ptGeo, ptMat);
    cloudPointsRef.current = cloudPoints;
    cloudPoints.visible = displayMode === 'points' || showCloudOverlay || sceneId === 'real_seq08_f00';
    scene.add(cloudPoints);

    // If Real City Driving scene, load genuine SemanticKITTI Velodyne scans
    realSemsRef.current = null;
    if (sceneId === 'real_seq08_f00') {
      fetch('/kitti_sample_08.json')
        .then((res) => res.json())
        .then((data: { points: [number, number, number][]; semantics?: number[] }) => {
          if (!data?.points || data.points.length === 0) return;
          const n = data.points.length;
          const posArr = new Float32Array(n * 3);
          const colArr = new Float32Array(n * 3);
          const semList = data.semantics || [];

          for (let i = 0; i < n; i++) {
            const [kx, ky, kz] = data.points[i];
            posArr[i * 3] = kx;
            posArr[i * 3 + 1] = ky;
            posArr[i * 3 + 2] = kz;

            const sem = semList[i] ?? 0;
            const c = pointColorForClass(sem, kz, themeRef.current);
            const r = c.r, g = c.g, b = c.b;
            colArr[i * 3] = r;
            colArr[i * 3 + 1] = g;
            colArr[i * 3 + 2] = b;
          }

          ptGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
          ptGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
          ptGeo.computeBoundingSphere();
          realSemsRef.current = Array.from({ length: n }, (_, i) => semList[i] ?? 0);
        })
        .catch((err) => console.warn('Failed loading KITTI sample pointcloud', err));
    }

    // ==========================================
    // 7. Dynamic LiDAR Scan Sweep Pulse (FastDEM 100+ Hz Engine Animation)
    // ==========================================
    const sweepRingGeo = new THREE.RingGeometry(0.1, 1.8, 64);
    const sweepRingMat = new THREE.MeshBasicMaterial({
      color: T0.path,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.22,
    });
    reg((T) => sweepRingMat.color.set(T.path));
    const sweepRingMesh = new THREE.Mesh(sweepRingGeo, sweepRingMat);
    sweepRingMesh.position.z = -1.70;
    sweepRingMeshRef.current = sweepRingMesh;
    scene.add(sweepRingMesh);

    // ==========================================
    // 8. Scenario-Specific Autonomous Trajectories
    // ==========================================
    const trajectoryGroup = new THREE.Group();
    trajectoryGroupRef.current = trajectoryGroup;
    scene.add(trajectoryGroup);

    let trajWaypoints: THREE.Vector3[];
    if (sceneId === 'scene_a_bridge') {
      // Underpass Centerline Path (Clearance: 2.30m)
      trajWaypoints = [
        new THREE.Vector3(-2.0, 0.0, -1.68),
        new THREE.Vector3(10.0, 0.0, -1.68),
        new THREE.Vector3(20.0, 0.0, -1.68),
        new THREE.Vector3(30.0, 0.0, -1.68),
        new THREE.Vector3(44.0, 0.0, -1.68),
      ];
    } else if (sceneId === 'scene_b_potholes') {
      // Collision-free avoidance path steering smoothly around crater rims:
      // Crater 1 at (8.0, 0.0, r=1.2), Crater 2 at (16.0, 2.2, r=0.9), Crater 3 at (23.0, -1.8, r=1.4)
      trajWaypoints = [
        new THREE.Vector3(-2.0, 0.0, -1.68),
        new THREE.Vector3(4.0, -0.8, -1.68),
        new THREE.Vector3(8.0, -2.2, -1.68),
        new THREE.Vector3(13.0, -0.5, -1.68),
        new THREE.Vector3(17.0, 0.5, -1.68),
        new THREE.Vector3(23.0, 1.8, -1.68),
        new THREE.Vector3(30.0, 0.6, -1.68),
        new THREE.Vector3(38.0, 0.0, -1.68),
        new THREE.Vector3(44.0, 0.0, -1.68),
      ];
    } else if (sceneId === 'scene_c_moving') {
      // Travel lane path (y = -1.5) while overtaking vehicle passes at y = 1.8
      trajWaypoints = [
        new THREE.Vector3(-2.0, -1.5, -1.68),
        new THREE.Vector3(10.0, -1.5, -1.68),
        new THREE.Vector3(22.0, -1.5, -1.68),
        new THREE.Vector3(34.0, -1.5, -1.68),
        new THREE.Vector3(44.0, -1.5, -1.68),
      ];
    } else if (sceneId === 'scene_d_poles') {
      // Slalom evasion trajectory weaving cleanly between the 4 staggered bollards
      trajWaypoints = [
        new THREE.Vector3(-2.0, 0.0, -1.68),
        new THREE.Vector3(3.0, 0.0, -1.68),
        new THREE.Vector3(8.0, -1.5, -1.68),   // Swerves right to dodge Pole 1 at (8.0, 0.0)
        new THREE.Vector3(13.0, -1.3, -1.68),
        new THREE.Vector3(18.0, 0.6, -1.68),   // Swerves left to dodge Pole 2 at (18.0, -1.3)
        new THREE.Vector3(23.0, 0.5, -1.68),
        new THREE.Vector3(28.0, -1.1, -1.68),  // Swerves right to dodge Pole 3 at (28.0, 1.1)
        new THREE.Vector3(33.0, -0.9, -1.68),
        new THREE.Vector3(38.0, 0.7, -1.68),   // Swerves left to dodge Pole 4 at (38.0, -0.4)
        new THREE.Vector3(44.0, 0.0, -1.68),
      ];
    } else {
      // Real City Driving (SemanticKITTI Sequence 08 road centerline)
      trajWaypoints = [
        new THREE.Vector3(-2.0, 0.0, -1.68),
        new THREE.Vector3(8.0, 0.1, -1.68),
        new THREE.Vector3(18.0, 0.35, -1.68),
        new THREE.Vector3(28.0, 0.7, -1.68),
        new THREE.Vector3(38.0, 1.1, -1.68),
        new THREE.Vector3(44.0, 1.4, -1.68),
      ];
    }

    const trajCurve = new THREE.CatmullRomCurve3(trajWaypoints);
    trajCurveRef.current = trajCurve;

    const trajGeo = new THREE.TubeGeometry(trajCurve, 64, 0.09, 8, false);
    const trajMat = new THREE.MeshBasicMaterial({
      color: T0.path,
      transparent: true,
      opacity: 0.9,
    });
    reg((T) => trajMat.color.set(T.path));
    const trajMesh = new THREE.Mesh(trajGeo, trajMat);
    trajectoryGroup.add(trajMesh);

    // ==========================================
    // 9. Dynamic Tracked Vehicle & Anti-Ghosting Filter (Scene C)
    // ==========================================
    const trackersGroup = new THREE.Group();
    trackersGroupRef.current = trackersGroup;
    scene.add(trackersGroup);

    let movingObstacleGroup: THREE.Group | null = null;
    if (sceneId === 'scene_c_moving') {
      const otherCar = new THREE.Group();
      trackersGroup.add(otherCar);
      movingObstacleGroup = otherCar;

      // Solid aerodynamic car body
      const bodyGeo = new THREE.BoxGeometry(3.8, 1.8, 0.75);
      const bodyMat = new THREE.MeshStandardMaterial({ color: T0.prop, roughness: 0.35, metalness: 0.4 });
      reg((T) => bodyMat.color.set(T.prop));
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.z = 0.55;
      otherCar.add(body);

      // Cabin / windshield
      const cabinGeo = new THREE.BoxGeometry(2.1, 1.5, 0.6);
      const cabinMat = new THREE.MeshStandardMaterial({ color: shade(T0.prop, 0.6), roughness: 0.2, metalness: 0.8 });
      reg((T) => cabinMat.color.copy(shade(T.prop, 0.6)));
      const cabin = new THREE.Mesh(cabinGeo, cabinMat);
      cabin.position.set(-0.2, 0, 1.15);
      otherCar.add(cabin);

      // 4 Solid Wheels
      const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.2, 16);
      const wheelMat = new THREE.MeshStandardMaterial({ color: shade(T0.prop, 0.4), roughness: 0.8 });
      reg((T) => wheelMat.color.copy(shade(T.prop, 0.4)));
      const wheelOffsets = [
        [-1.1, 0.95],
        [-1.1, -0.95],
        [1.1, 0.95],
        [1.1, -0.95],
      ];
      wheelOffsets.forEach(([wx, wy]) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(wx, wy, 0.34);
        otherCar.add(wheel);
      });

      // Headlights & Taillights
      const hlGeo = new THREE.BoxGeometry(0.08, 0.35, 0.1);
      const hlMat = new THREE.MeshBasicMaterial({ color: T0.path });
      reg((T) => hlMat.color.set(T.path));
      const hlLeft = new THREE.Mesh(hlGeo, hlMat);
      hlLeft.position.set(1.9, 0.55, 0.55);
      otherCar.add(hlLeft);
      const hlRight = new THREE.Mesh(hlGeo, hlMat);
      hlRight.position.set(1.9, -0.55, 0.55);
      otherCar.add(hlRight);

      // Taillights
      const tlMat2 = new THREE.MeshBasicMaterial({ color: 'crimson' });
      const tl1 = new THREE.Mesh(hlGeo, tlMat2);
      tl1.position.set(-1.9, 0.55, 0.55);
      otherCar.add(tl1);
      const tl2 = new THREE.Mesh(hlGeo, tlMat2);
      tl2.position.set(-1.9, -0.55, 0.55);
      otherCar.add(tl2);

      // Crisp 2.5D Tracking Outline (Green / Cyan telemetry bounding bracket)
      const trackBoxGeo = new THREE.BoxGeometry(4.2, 2.1, 1.4);
      const trackBoxMat = new THREE.MeshBasicMaterial({ color: T0.track, wireframe: true, transparent: true, opacity: 0.45 });
      reg((T) => trackBoxMat.color.set(T.track));
      const trackBox = new THREE.Mesh(trackBoxGeo, trackBoxMat);
      trackBox.position.z = 0.85;
      otherCar.add(trackBox);

      // Velocity Vector Arrow
      const velArrow = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 0, 1.5),
        3.2,
        T0.track,
        0.7,
        0.35
      );
      reg((T) => velArrow.setColor(T.track));
      otherCar.add(velArrow);

      // Dynamic "MOS: ERASE GHOST TRAIL" Ground Decal
      const decalGeo = new THREE.PlaneGeometry(4.4, 2.4);
      const decalMat = new THREE.MeshBasicMaterial({
        color: T0.track,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
      });
      reg((T) => decalMat.color.set(T.track));
      const decal = new THREE.Mesh(decalGeo, decalMat);
      decal.position.z = 0.04;
      otherCar.add(decal);

      otherCar.position.set(-6.0, 2.2, -1.72);
    }

    // ==========================================
    // 10. Interactive 3D Cursor Reticle
    // ==========================================
    const reticleGeo = new THREE.RingGeometry(0.35, 0.45, 32);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: T0.reticle,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    reg((T) => reticleMat.color.set(T.reticle));
    const hoverReticle = new THREE.Mesh(reticleGeo, reticleMat);
    hoverReticle.visible = false;
    hoverCrosshairRef.current = hoverReticle;
    scene.add(hoverReticle);

    // ==========================================
    // Mouse Controls (Orbit Drag, Zoom, Pan) + Raycaster
    // ==========================================
    let isDragging = false;
    let isPanning = false;
    let prevMouse = { x: 0, y: 0 };
    const raycaster = new THREE.Raycaster();
    const mouseNDC = new THREE.Vector2();

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        isPanning = true;
      } else {
        isDragging = true;
      }
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Raycast against DEM terrain surface or ground plane (Works in both Points & Surface modes)
      if (cameraRef.current) {
        raycaster.setFromCamera(mouseNDC, cameraRef.current);
        let hx = 0, hy = 0, hz = -1.73;
        let hasHit = false;

        if (demSurfaceMeshRef.current && demSurfaceMeshRef.current.visible) {
          const intersects = raycaster.intersectObject(demSurfaceMeshRef.current);
          if (intersects.length > 0) {
            hx = intersects[0].point.x;
            hy = intersects[0].point.y;
            hz = intersects[0].point.z;
            hasHit = true;
          }
        }

        if (!hasHit) {
          const groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 1.73);
          const hitPoint = new THREE.Vector3();
          if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
            hx = hitPoint.x;
            hy = hitPoint.y;
            const evalH = evalElevation(hx, hy);
            hz = evalH.z;
            hasHit = hx >= -5 && hx <= 45 && hy >= -15 && hy <= 15;
          }
        }

        if (hasHit) {
          if (hoverCrosshairRef.current) {
            hoverCrosshairRef.current.position.set(hx, hy, hz + 0.04);
            hoverCrosshairRef.current.visible = true;
          }
        } else {
          if (hoverCrosshairRef.current) hoverCrosshairRef.current.visible = false;
        }
      }

      if (!isDragging && !isPanning) return;
      const dxMove = e.clientX - prevMouse.x;
      const dyMove = e.clientY - prevMouse.y;
      prevMouse = { x: e.clientX, y: e.clientY };

      if (isDragging) {
        const offset = targetCameraPos.current.clone().sub(targetLookAt.current);
        const radius = offset.length();
        let theta = Math.atan2(offset.y, offset.x);
        let phi = Math.acos(Math.min(Math.max(offset.z / radius, -1), 1));

        theta -= dxMove * 0.006;
        phi = Math.min(Math.max(phi - dyMove * 0.006, 0.08), Math.PI / 2 - 0.04);

        targetCameraPos.current.x = targetLookAt.current.x + radius * Math.sin(phi) * Math.cos(theta);
        targetCameraPos.current.y = targetLookAt.current.y + radius * Math.sin(phi) * Math.sin(theta);
        targetCameraPos.current.z = targetLookAt.current.z + radius * Math.cos(phi);
      } else if (isPanning) {
        const panSpeed = 0.04;
        targetCameraPos.current.x -= dxMove * panSpeed;
        targetLookAt.current.x -= dxMove * panSpeed;
        targetCameraPos.current.y += dyMove * panSpeed;
        targetLookAt.current.y += dyMove * panSpeed;
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
      isPanning = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const zoomDelta = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY) * 0.0015, 0.25);
      const zoomFactor = 1.0 + zoomDelta;

      if (cameraModeRef.current === 'chase') {
        chaseZoomRef.current = THREE.MathUtils.clamp(chaseZoomRef.current * zoomFactor, 0.25, 4.5);
      } else if (cameraModeRef.current === 'bev') {
        bevHeightRef.current = THREE.MathUtils.clamp(bevHeightRef.current * zoomFactor, 6.0, 160.0);
      } else if (cameraModeRef.current === 'cockpit') {
        cockpitFovRef.current = THREE.MathUtils.clamp(cockpitFovRef.current * (zoomFactor > 1 ? 1.06 : 0.94), 18.0, 80.0);
        if (cameraRef.current) {
          cameraRef.current.fov = cockpitFovRef.current;
          cameraRef.current.updateProjectionMatrix();
        }
      } else {
        const offset = targetCameraPos.current.clone().sub(targetLookAt.current);
        const dist = offset.length();
        const newDist = THREE.MathUtils.clamp(dist * zoomFactor, 3.0, 220.0);
        offset.setLength(newDist);
        targetCameraPos.current.copy(targetLookAt.current).add(offset);
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('wheel', handleWheel, { passive: false });
    domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // ==========================================
    // FastDEM Smooth Animation Loop (60 FPS WebGL)
    // ==========================================
    let animationId: number;
    let sweepRadius = 0.5;
    let frameCount = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const car = carPhysicsRef.current;
      const dt = 0.016;

      // Autonomous Trajectory Tracking along scenario spline
      if (trajCurveRef.current) {
        if (isPlayingRef.current) {
          playbackProgressRef.current = (playbackProgressRef.current + (dt * 0.065 * playbackSpeedRef.current)) % 1.0;
        }
        const pt = trajCurveRef.current.getPointAt(playbackProgressRef.current);
        const tangent = trajCurveRef.current.getTangentAt(playbackProgressRef.current);
        car.x = pt.x;
        car.y = pt.y;
        const targetHeading = Math.atan2(tangent.y, tangent.x);
        car.heading += (targetHeading - car.heading) * Math.min(12.0 * dt, 1.0);
        car.speed = 8.5 * playbackSpeedRef.current;
        car.steerAngle = Math.max(-0.52, Math.min(0.52, targetHeading - car.heading));
        if (frontLeftWheelRef.current) frontLeftWheelRef.current.rotation.z = car.steerAngle;
        if (frontRightWheelRef.current) frontRightWheelRef.current.rotation.z = car.steerAngle;
      }

      // Dynamic obstacle tracking in Scene C (Overtaking passing vehicle)
      if (movingObstacleGroup) {
        const obsProgress = (playbackProgressRef.current * 1.5 + 0.15) % 1.0;
        movingObstacleGroup.position.x = -6.0 + obsProgress * 54.0;
        movingObstacleGroup.position.y = 2.4;
        movingObstacleGroup.position.z = -1.72;
      }

      // Wheel spinning rotation
      car.wheelRot += (car.speed * dt) / 0.32;
      for (const w of wheelsMeshListRef.current) {
        w.rotation.y = car.wheelRot;
      }

      // Roof LiDAR Turret spinning (600 RPM)
      if (lidarTurretRef.current) {
        lidarTurretRef.current.rotation.z += 0.22;
      }

      // 4. Conformance to Terrain Elevation & Slope Tilt
      const zCenter = evalElevation(car.x, car.y).z;
      const zFront = evalElevation(car.x + Math.cos(car.heading) * 0.9, car.y + Math.sin(car.heading) * 0.9).z;
      const zRear = evalElevation(car.x - Math.cos(car.heading) * 0.9, car.y - Math.sin(car.heading) * 0.9).z;
      const zLeft = evalElevation(car.x - Math.sin(car.heading) * 0.6, car.y + Math.cos(car.heading) * 0.6).z;
      const zRight = evalElevation(car.x + Math.sin(car.heading) * 0.6, car.y - Math.cos(car.heading) * 0.6).z;

      car.pitch = Math.atan2(zFront - zRear, 1.8);
      car.roll = Math.atan2(zLeft - zRight, 1.2);
      car.z = zCenter + 0.32;

      if (carGroupRef.current) {
        carGroupRef.current.position.set(car.x, car.y, car.z);
        carGroupRef.current.rotation.set(car.pitch, car.roll, car.heading, 'ZYX');
      }

      // 5. Dynamic Concentric Ring Lattice & Scan Sweep follows Ego UGV
      if (ringsGroupRef.current) {
        ringsGroupRef.current.position.set(car.x, car.y, -1.72);
      }
      if (sweepRingMeshRef.current) {
        sweepRingMeshRef.current.position.set(car.x, car.y, -1.70);
      }

      // 6. Camera Follow Controller
      if (cameraModeRef.current === 'chase') {
        const backDist = 9.0 * chaseZoomRef.current;
        const upDist = 4.2 * chaseZoomRef.current;
        targetLookAt.current.set(
          car.x + Math.cos(car.heading) * 3.5,
          car.y + Math.sin(car.heading) * 3.5,
          car.z + 0.5
        );
        targetCameraPos.current.set(
          car.x - Math.cos(car.heading) * backDist,
          car.y - Math.sin(car.heading) * backDist,
          car.z + upDist
        );
      } else if (cameraModeRef.current === 'bev') {
        targetLookAt.current.set(car.x, car.y, car.z);
        targetCameraPos.current.set(car.x, car.y, car.z + bevHeightRef.current);
      } else if (cameraModeRef.current === 'cockpit') {
        targetCameraPos.current.set(
          car.x + Math.cos(car.heading) * 0.2,
          car.y + Math.sin(car.heading) * 0.2,
          car.z + 0.6
        );
        targetLookAt.current.set(
          car.x + Math.cos(car.heading) * 25.0,
          car.y + Math.sin(car.heading) * 25.0,
          car.z + 0.2
        );
      }

      // Camera smooth interpolation
      camera.position.lerp(targetCameraPos.current, 0.08);
      currentLookAt.current.lerp(targetLookAt.current, 0.08);
      camera.lookAt(currentLookAt.current);

      // FastDEM Scan Sweep Wave Animation (Simulating 100+ Hz Laser Ingestion)
      if (showSweepWave && sweepRingMeshRef.current) {
        sweepRadius += 0.35;
        if (sweepRadius > 45.0) sweepRadius = 0.5;

        sweepRingMeshRef.current.scale.set(sweepRadius, sweepRadius, 1.0);
        const sweepMat = sweepRingMeshRef.current.material as THREE.MeshBasicMaterial;
        sweepMat.opacity = Math.max(0.75 * (1.0 - sweepRadius / 45.0), 0.05);
      }

      // Throttled UI Telemetry & Frame Sync (~15 Hz)
      frameCount++;
      if (frameCount % 4 === 0) {
        const calculatedFrame = Math.floor(playbackProgressRef.current * 120);
        lastReportedFrameRef.current = calculatedFrame;
        onCurrentFrameChange?.(calculatedFrame);

        const telem = {
          speed: Math.abs(car.speed * 3.6),
          heading: ((car.heading * (180 / Math.PI)) % 360 + 360) % 360,
          x: car.x,
          y: car.y,
          z: car.z,
        };
        onTelemetryUpdate?.(telem);
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || container.clientWidth === 0 || container.clientHeight === 0) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight, false);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationId);
      domElement.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      resizeObserver.disconnect();
      disposeObject(scene);
      renderer.dispose();
      if (domElement.parentElement) {
        domElement.parentElement.removeChild(domElement);
      }
    };
  }, [sceneId]);



  const handleResetCar = () => {
    const car = carPhysicsRef.current;
    car.x = 0;
    car.y = 0;
    car.heading = 0;
    car.speed = 0;
    car.steerAngle = 0;
  };

  const handleFrameSeek = (frame: number) => {
    setCurrentFrame(frame);
    lastReportedFrameRef.current = frame;
    const progress = Math.max(0, Math.min(1.0, frame / 120));
    playbackProgressRef.current = progress;
    if (trajCurveRef.current) {
      const pt = trajCurveRef.current.getPointAt(progress);
      const tangent = trajCurveRef.current.getTangentAt(progress);
      const car = carPhysicsRef.current;
      car.x = pt.x;
      car.y = pt.y;
      car.heading = Math.atan2(tangent.y, tangent.x);
      car.speed = 0;
    }
  };

  // Prop Synchronization Effects
  useEffect(() => {
    if (propCameraMode) {
      setCameraMode(propCameraMode);
      handleCameraChange(propCameraMode);
    }
  }, [propCameraMode]);

  useEffect(() => {
    if (propDisplayMode) setDisplayMode(propDisplayMode);
  }, [propDisplayMode]);

  useEffect(() => {
    if (propColorMode) setColorMode(propColorMode);
  }, [propColorMode]);

  useEffect(() => {
    if (propIsWireframe !== undefined) setIsWireframe(propIsWireframe);
  }, [propIsWireframe]);

  useEffect(() => {
    if (propControlMode) setControlMode(propControlMode);
  }, [propControlMode]);

  useEffect(() => {
    if (propIsPlaying !== undefined) setIsPlaying(propIsPlaying);
  }, [propIsPlaying]);

  useEffect(() => {
    if (propPlaybackSpeed) setPlaybackSpeed(propPlaybackSpeed);
  }, [propPlaybackSpeed]);

  useEffect(() => {
    if (propCurrentFrame !== undefined) {
      if (Math.abs(propCurrentFrame - lastReportedFrameRef.current) > 1) {
        handleFrameSeek(propCurrentFrame);
      }
    }
  }, [propCurrentFrame]);

  useEffect(() => {
    if (resetSignal) {
      handleResetCar();
    }
  }, [resetSignal]);

  return (
    <div data-region="viewport-canvas" style={{ flex: 1, position: 'relative', overflow: 'hidden' }} ref={mountRef}>


      {/* Optional elevation scale bar (turbo ramp matches the Height colour mode) */}
      {showScaleBar && (
        <div className="absolute bottom-6 left-6 z-10 pointer-events-none flex flex-col gap-1.5 px-3 py-2 rounded-lg border border-line bg-panel/95 shadow-md">
          <div className="flex justify-between w-32 text-[10px] font-mono text-fg-muted">
            <span>-2.0m</span>
            <span>0.0m</span>
            <span>+3.0m</span>
          </div>
          <div className="w-32 h-1.5 rounded-full" style={{ background: gradientCss(getTurboColor) }} />
        </div>
      )}
    </div>
  );
};
