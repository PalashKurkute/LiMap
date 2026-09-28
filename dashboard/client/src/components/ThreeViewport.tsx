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
  playbackSpeed?: number;
  onPlaybackSpeedChange?: (speed: number) => void;
  onTelemetryUpdate?: (telem: { speed: number; heading: number; x: number; y: number; z: number }) => void;
  resetSignal?: number;
  showScaleBar?: boolean;
}

interface HoverInspection {
  x: number;
  y: number;
  z: number;
  slopeDeg: number;
  variance: number;
  clearance: number | null;
  ringId: number;
  normZ: number; // 0 (min) to 1 (max)
}

// FastDEM Turbo/Jet Elevation Colormap: maps normalized z in [0, 1] to RGB
function getTurboColor(normZ: number): { r: number; g: number; b: number } {
  const t = Math.min(Math.max(normZ, 0.0), 1.0);
  if (t < 0.15) {
    // Deep Blue to Indigo (-2.2m Pothole to -1.9m)
    const f = t / 0.15;
    return { r: 0.15 * (1 - f) + 0.1 * f, g: 0.1 * (1 - f) + 0.35 * f, b: 0.75 * (1 - f) + 1.0 * f };
  } else if (t < 0.35) {
    // Blue to Cyan (-1.9m to -1.73m Road Surface)
    const f = (t - 0.15) / 0.20;
    return { r: 0.1 * (1 - f) + 0.0 * f, g: 0.35 * (1 - f) + 0.9 * f, b: 1.0 * (1 - f) + 0.95 * f };
  } else if (t < 0.60) {
    // Cyan to Emerald (-1.73m to -1.0m Traversable Ground)
    const f = (t - 0.35) / 0.25;
    return { r: 0.0, g: 0.9 * (1 - f) + 0.92 * f, b: 0.95 * (1 - f) + 0.3 * f };
  } else if (t < 0.82) {
    // Emerald to Amber/Yellow (-1.0m to +0.8m Incline / Moderate Obstacle)
    const f = (t - 0.60) / 0.22;
    return { r: 0.0 * (1 - f) + 1.0 * f, g: 0.92 * (1 - f) + 0.75 * f, b: 0.3 * (1 - f) + 0.0 * f };
  } else {
    // Yellow to Crimson (+0.8m to +2.5m High Obstacle / Vehicle / Bridge Deck)
    const f = (t - 0.82) / 0.18;
    return { r: 1.0, g: 0.75 * (1 - f) + 0.09 * f, b: 0.0 * (1 - f) + 0.27 * f };
  }
}

// Traversability Colormap based on local terrain slope (degrees)
function getTraversabilityColor(slopeDeg: number): { r: number; g: number; b: number } {
  if (slopeDeg < 5.0) {
    // Safe Flat Road (Emerald)
    return { r: 0.0, g: 0.9, b: 0.46 };
  } else if (slopeDeg < 12.0) {
    // Moderate Incline / Caution (Amber Yellow)
    const f = (slopeDeg - 5.0) / 7.0;
    return { r: 0.0 * (1 - f) + 1.0 * f, g: 0.9 * (1 - f) + 0.75 * f, b: 0.46 * (1 - f) + 0.0 * f };
  } else {
    // Untraversable / Lethal Step (Crimson)
    return { r: 1.0, g: 0.09, b: 0.27 };
  }
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
  playbackSpeed: propPlaybackSpeed,
  onTelemetryUpdate,
  resetSignal,
  showScaleBar = true,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

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



  // Interactive Real-Time Height Inspector State
  const [hoverData, setHoverData] = useState<HoverInspection | null>(null);

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
  const keysRef = useRef<{ [key: string]: boolean }>({});
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

  // Adversarial Sensor Stress Mode Reaction (SIH26053 §9.2)
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
  }, [colorMode]);

  // Main Three.js Scene Setup & 60 FPS Render Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);

    // Directional & Ambient Lighting for FastDEM Relief Shading
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight1.position.set(-20, -30, 40);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x00f0ff, 0.6);
    dirLight2.position.set(30, 20, 20);
    scene.add(dirLight2);

    const ambLight = new THREE.AmbientLight(0x182030, 1.2);
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
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Subtle Ground Reference Grid
    const gridHelper = new THREE.GridHelper(100, 50, 0x00f0ff, 0x141a29);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = -1.73;
    scene.add(gridHelper);

    // 1. Fovea Nested Lattice Ring Boundaries
    const ringsGroup = new THREE.Group();
    ringsGroupRef.current = ringsGroup;
    scene.add(ringsGroup);

    const ringConfigs = [
      { radius: 10.0, color: 0x00f0ff, opacity: 0.85, name: 'Ring 0 (5cm)' },
      { radius: 25.0, color: 0x00e676, opacity: 0.65, name: 'Ring 1 (10cm)' },
      { radius: 50.0, color: 0x7e8b9f, opacity: 0.45, name: 'Ring 2 (25cm)' },
    ];

    ringConfigs.forEach((cfg) => {
      const ringGeo = new THREE.RingGeometry(cfg.radius - 0.12, cfg.radius + 0.12, 96);
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

    // 2. Autonomous UGV Vehicle Model (Tactical Cyber-Chassis + Spinning LiDAR + Active Steering)
    const carGroup = new THREE.Group();
    carGroupRef.current = carGroup;
    scene.add(carGroup);

    // Chassis Lower Hull (Gunmetal tactical titanium)
    const chassisGeo = new THREE.BoxGeometry(2.3, 1.25, 0.42);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x1a2333,
      metalness: 0.85,
      roughness: 0.25,
    });
    const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
    chassisMesh.position.z = 0.0;
    carGroup.add(chassisMesh);

    // Cabin / Sensor Enclosure (Tinted armored glass with cyan accent trim)
    const cabinGeo = new THREE.BoxGeometry(1.2, 0.95, 0.36);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.9,
    });
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.set(-0.2, 0, 0.35);
    carGroup.add(cabinMesh);

    // Cabin Glow Accent Trim
    const trimGeo = new THREE.BoxGeometry(1.22, 0.97, 0.04);
    const trimMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const trimMesh = new THREE.Mesh(trimGeo, trimMat);
    trimMesh.position.set(-0.2, 0, 0.52);
    carGroup.add(trimMesh);

    // Four Wheels with Rubber Treads & Cyan Rims
    const wheelTireGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16);
    const wheelRimGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.24, 16);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.8 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, metalness: 0.8, roughness: 0.2 });

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

    // Front Twin Headlights (LED Cyan) + Spotlight Cones
    const hlGeo = new THREE.BoxGeometry(0.08, 0.18, 0.1);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xe0f7fa });
    const hlLeft = new THREE.Mesh(hlGeo, hlMat);
    hlLeft.position.set(1.15, 0.42, 0.05);
    carGroup.add(hlLeft);

    const hlRight = new THREE.Mesh(hlGeo, hlMat);
    hlRight.position.set(1.15, -0.42, 0.05);
    carGroup.add(hlRight);

    const spotLight1 = new THREE.SpotLight(0x00f0ff, 3.5, 30, Math.PI / 5, 0.4, 1.2);
    spotLight1.position.set(1.2, 0.42, 0.1);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(12, 0.42, -1.0);
    carGroup.add(spotTarget);
    spotLight1.target = spotTarget;
    spotLight1.visible = activeLayers.headlights;
    headlightsRef.current = spotLight1;
    carGroup.add(spotLight1);

    // Rear Taillights (Crimson Red)
    const tlGeo = new THREE.BoxGeometry(0.08, 0.18, 0.08);
    const tlMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    const tlLeft = new THREE.Mesh(tlGeo, tlMat);
    tlLeft.position.set(-1.15, 0.42, 0.05);
    carGroup.add(tlLeft);

    const tlRight = new THREE.Mesh(tlGeo, tlMat);
    tlRight.position.set(-1.15, -0.42, 0.05);
    carGroup.add(tlRight);

    // Roof Spinning LiDAR Sensor Turret Puck
    const lidarBaseGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.18, 16);
    const lidarBaseMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.3 });
    const lidarBase = new THREE.Mesh(lidarBaseGeo, lidarBaseMat);
    lidarBase.position.set(-0.2, 0, 0.62);
    carGroup.add(lidarBase);

    const lidarPuckGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.14, 16);
    const lidarPuckMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.2 });
    const lidarPuck = new THREE.Mesh(lidarPuckGeo, lidarPuckMat);
    lidarPuck.position.set(-0.2, 0, 0.76);
    carGroup.add(lidarPuck);
    lidarTurretRef.current = lidarPuck;

    const laserStripGeo = new THREE.BoxGeometry(0.04, 0.25, 0.04);
    const laserStripMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
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

      // Scene C: Dynamic Vehicle Mound / Bounding Elevation
      if (sceneId === 'scene_c_moving') {
        if (x >= 11.0 && x <= 15.4 && Math.abs(y - 1.8) < 1.1) {
          z = 0.15; // Moving vehicle top
          semId = 10;
          variance = 0.045;
        }
      }

      // Scene D: Thin Pole Array
      if (sceneId === 'scene_d_poles') {
        const poles = [8, 18, 28, 38];
        for (const px of poles) {
          if (Math.hypot(x - px, y - 2.0) < 0.35) {
            z = 1.4; // Vertical pole
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
          // Bayesian variance heatmap: 0.001 (cool teal) to 0.08 (hot magenta/orange)
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
    demMesh.visible = displayMode === 'surface';
    scene.add(demMesh);

    // ==========================================
    // 4. FastDEM Overhang Upper Deck (Scene A Dual Elevation)
    // ==========================================
    if (sceneId === 'scene_a_bridge') {
      const bridgeGeo = new THREE.BoxGeometry(10.0, 18.0, 0.4);
      const bridgeMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.75,
        wireframe: false,
        roughness: 0.3,
      });
      const bridgeMesh = new THREE.Mesh(bridgeGeo, bridgeMat);
      bridgeMesh.position.set(20.0, 0.0, 0.8);
      bridgeDeckMeshRef.current = bridgeMesh;
      scene.add(bridgeMesh);
    }

    // ==========================================
    // 5. FastDEM 2.5D Elevation Column Voxels (InstancedMesh)
    // ==========================================
    const voxelCount = 800;
    const boxGeo = new THREE.BoxGeometry(0.35, 0.35, 1.0);
    const voxelMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.2 });
    const voxelMesh = new THREE.InstancedMesh(boxGeo, voxelMat, voxelCount);
    voxelMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    demVoxelsMeshRef.current = voxelMesh;
    voxelMesh.visible = displayMode === 'voxels';

    const dummy = new THREE.Object3D();
    const instColor = new THREE.Color();
    for (let i = 0; i < voxelCount; i++) {
      const vx = Math.random() * 46 - 3;
      const vy = Math.random() * 26 - 13;
      const { z } = evalElevation(vx, vy);

      const h = Math.max(z - (-2.0), 0.15);
      dummy.position.set(vx, vy, -2.0 + h / 2);
      dummy.scale.set(0.4, 0.4, h);
      dummy.updateMatrix();
      voxelMesh.setMatrixAt(i, dummy.matrix);

      const normZ = (z - zMin) / (zMax - zMin);
      const col = getTurboColor(normZ);
      instColor.setRGB(col.r, col.g, col.b);
      voxelMesh.setColorAt(i, instColor);
    }
    voxelMesh.instanceMatrix.needsUpdate = true;
    if (voxelMesh.instanceColor) voxelMesh.instanceColor.needsUpdate = true;
    scene.add(voxelMesh);

    // ==========================================
    // 6. FastDEM Raw Point Cloud Overlay (5,200 points)
    // ==========================================
    const ptCount = 4800;
    const ptPositions = new Float32Array(ptCount * 3);
    const ptColors = new Float32Array(ptCount * 3);

    for (let i = 0; i < ptCount; i++) {
      const px = Math.random() * 48 - 4;
      const py = Math.random() * 26 - 13;
      const { z } = evalElevation(px, py);
      const pz = z + (Math.random() * 0.06 - 0.03);

      ptPositions[i * 3] = px;
      ptPositions[i * 3 + 1] = py;
      ptPositions[i * 3 + 2] = pz;

      const normZ = (pz - zMin) / (zMax - zMin);
      const col = getTurboColor(normZ);
      ptColors[i * 3] = col.r;
      ptColors[i * 3 + 1] = col.g;
      ptColors[i * 3 + 2] = col.b;
    }

    const ptGeo = new THREE.BufferGeometry();
    ptGeo.setAttribute('position', new THREE.BufferAttribute(ptPositions, 3));
    ptGeo.setAttribute('color', new THREE.BufferAttribute(ptColors, 3));
    const ptMat = new THREE.PointsMaterial({ size: 0.22, vertexColors: true });
    const cloudPoints = new THREE.Points(ptGeo, ptMat);
    cloudPointsRef.current = cloudPoints;
    cloudPoints.visible = displayMode === 'points' || showCloudOverlay;
    scene.add(cloudPoints);

    // ==========================================
    // 7. Dynamic LiDAR Scan Sweep Pulse (FastDEM 100+ Hz Engine Animation)
    // ==========================================
    const sweepRingGeo = new THREE.RingGeometry(0.1, 1.8, 64);
    const sweepRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const sweepRingMesh = new THREE.Mesh(sweepRingGeo, sweepRingMat);
    sweepRingMesh.position.z = -1.70;
    sweepRingMeshRef.current = sweepRingMesh;
    scene.add(sweepRingMesh);

    // ==========================================
    // 8. Planned Hybrid-A* 3D Trajectory Spline
    // ==========================================
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
    trajCurveRef.current = trajCurve;

    const trajGeo = new THREE.TubeGeometry(trajCurve, 48, 0.12, 8, false);
    const trajMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
    });
    const trajMesh = new THREE.Mesh(trajGeo, trajMat);
    trajectoryGroup.add(trajMesh);

    // ==========================================
    // 9. Dynamic Tracked Bounding Box (Scene C)
    // ==========================================
    const trackersGroup = new THREE.Group();
    trackersGroupRef.current = trackersGroup;
    scene.add(trackersGroup);

    if (sceneId === 'scene_c_moving') {
      const boxGeo = new THREE.BoxGeometry(4.2, 1.8, 1.4);
      const boxMat = new THREE.MeshBasicMaterial({ color: 0xb388ff, wireframe: true });
      const boxMesh = new THREE.Mesh(boxGeo, boxMat);
      boxMesh.position.set(13.2, 1.8, -0.98);
      trackersGroup.add(boxMesh);

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

    // ==========================================
    // 10. Interactive 3D Cursor Reticle
    // ==========================================
    const reticleGeo = new THREE.RingGeometry(0.35, 0.45, 32);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
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

      // Raycast against DEM terrain surface
      if (demSurfaceMeshRef.current && cameraRef.current) {
        raycaster.setFromCamera(mouseNDC, cameraRef.current);
        const intersects = raycaster.intersectObject(demSurfaceMeshRef.current);
        if (intersects.length > 0) {
          const hit = intersects[0];
          const hx = hit.point.x;
          const hy = hit.point.y;
          const hz = hit.point.z;
          const rad = Math.hypot(hx, hy);

          let rId = 0;
          if (rad < 10) rId = 0;
          else if (rad < 25) rId = 1;
          else if (rad < 50) rId = 2;
          else rId = 3;

          const normZ = Math.min(Math.max((hz - zMin) / (zMax - zMin), 0.0), 1.0);
          const { variance } = evalElevation(hx, hy);

          let clearance: number | null = null;
          if (sceneId === 'scene_a_bridge' && hx >= 15 && hx <= 25 && Math.abs(hy) < 7) {
            clearance = Number((0.8 - hz).toFixed(2));
          }

          // Compute slope angle from surface normal
          let slopeDeg = 2.4;
          if (hit.face) {
            const nz = Math.max(Math.min(hit.face.normal.z, 1.0), 0.0);
            slopeDeg = Number((Math.acos(nz) * (180 / Math.PI)).toFixed(1));
          }

          setHoverData({
            x: Number(hx.toFixed(2)),
            y: Number(hy.toFixed(2)),
            z: Number(hz.toFixed(2)),
            slopeDeg,
            variance: Number(variance.toFixed(4)),
            clearance,
            ringId: rId,
            normZ,
          });

          if (hoverCrosshairRef.current) {
            hoverCrosshairRef.current.position.set(hx, hy, hz + 0.04);
            hoverCrosshairRef.current.visible = true;
          }
        } else {
          setHoverData(null);
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
    // WASD & Arrow Key Drive Event Handlers
    // ==========================================
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const code = e.code;
      keysRef.current[code] = true;

      if (code === 'KeyR') {
        const car = carPhysicsRef.current;
        car.x = 0;
        car.y = 0;
        car.heading = 0;
        car.speed = 0;
        car.steerAngle = 0;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      keysRef.current[code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // ==========================================
    // FastDEM Smooth Animation Loop (60 FPS WebGL)
    // ==========================================
    let animationId: number;
    let sweepRadius = 0.5;
    let frameCount = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const car = carPhysicsRef.current;
      const keys = keysRef.current;
      const dt = 0.016;

      if (controlModeRef.current === 'playback' && trajCurveRef.current) {
        if (isPlayingRef.current) {
          playbackProgressRef.current = (playbackProgressRef.current + (dt * 0.075 * playbackSpeedRef.current)) % 1.0;
        }
        const pt = trajCurveRef.current.getPointAt(playbackProgressRef.current);
        const tangent = trajCurveRef.current.getTangentAt(playbackProgressRef.current);
        car.x = pt.x;
        car.y = pt.y;
        const targetHeading = Math.atan2(tangent.y, tangent.x);
        car.heading += (targetHeading - car.heading) * Math.min(10.0 * dt, 1.0);
        car.speed = 8.5 * playbackSpeedRef.current;
        car.steerAngle = Math.max(-0.52, Math.min(0.52, targetHeading - car.heading));
        if (frontLeftWheelRef.current) frontLeftWheelRef.current.rotation.z = car.steerAngle;
        if (frontRightWheelRef.current) frontRightWheelRef.current.rotation.z = car.steerAngle;
      } else {
        // 1. Steering Kinematics (A / D / Arrows)
        const maxSteer = 0.52;
        let targetSteer = 0;
        if (keys['KeyA'] || keys['ArrowLeft']) targetSteer += maxSteer;
        if (keys['KeyD'] || keys['ArrowRight']) targetSteer -= maxSteer;
        car.steerAngle += (targetSteer - car.steerAngle) * Math.min(8.0 * dt, 1.0);

        if (frontLeftWheelRef.current) frontLeftWheelRef.current.rotation.z = car.steerAngle;
        if (frontRightWheelRef.current) frontRightWheelRef.current.rotation.z = car.steerAngle;

        // 2. Throttle & Braking (W / S / Space)
        const maxSpeed = 16.0; // ~58 km/h
        const accel = 18.0;
        const brakeDecel = 26.0;
        const drag = 4.5;

        if (keys['KeyW'] || keys['ArrowUp']) {
          car.speed = Math.min(car.speed + accel * dt, maxSpeed);
        } else if (keys['KeyS'] || keys['ArrowDown']) {
          car.speed = Math.max(car.speed - brakeDecel * dt, -maxSpeed * 0.45);
        } else if (keys['Space']) {
          car.speed *= Math.max(0, 1.0 - 16.0 * dt);
        } else {
          if (Math.abs(car.speed) > 0.08) {
            car.speed -= Math.sign(car.speed) * drag * dt;
          } else {
            car.speed = 0;
          }
        }

        // 3. Heading & Position (Bicycle Kinematics)
        if (Math.abs(car.speed) > 0.02) {
          const wheelbase = 1.5;
          const yawRate = (car.speed / wheelbase) * Math.sin(car.steerAngle);
          car.heading += yawRate * dt;
        }

        car.x += Math.cos(car.heading) * car.speed * dt;
        car.y += Math.sin(car.heading) * car.speed * dt;

        // DEM Map Boundary Constraints (-4m to 44m X, -13m to 13m Y)
        car.x = Math.max(Math.min(car.x, 44.0), -4.0);
        car.y = Math.max(Math.min(car.y, 13.0), -13.0);
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

      // Throttled UI Telemetry Sync (~10 Hz)
      frameCount++;
      if (frameCount % 6 === 0) {
        if (controlModeRef.current === 'playback') {
          setCurrentFrame(Math.floor(playbackProgressRef.current * 120));
        }
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
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      domElement.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
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
    if (propCurrentFrame !== undefined) handleFrameSeek(propCurrentFrame);
  }, [propCurrentFrame]);

  useEffect(() => {
    if (resetSignal) {
      handleResetCar();
    }
  }, [resetSignal]);

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }} ref={mountRef}>
      {/* Real-Time Cursor Height Inspector (Subtle bottom-left Tooltip) */}
      {hoverData && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '24px',
            padding: '7px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontFamily: 'var(--font-mono)',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            background: 'rgba(9, 13, 21, 0.92)',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
            ({hoverData.x.toFixed(1)}m, {hoverData.y.toFixed(1)}m)
          </span>
          <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 600 }}>
            Z: {hoverData.z.toFixed(2)}m
          </span>
          <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: '11px', color: hoverData.slopeDeg < 5 ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
            {hoverData.slopeDeg.toFixed(1)}°
          </span>
          {hoverData.clearance !== null && (
            <>
              <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.15)' }} />
              <span style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>
                Clr: {hoverData.clearance.toFixed(2)}m
              </span>
            </>
          )}
        </div>
      )}

      {/* Optional Elevation Scale Bar */}
      {showScaleBar && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '24px',
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '130px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            <span>-2.0m</span>
            <span>0.0m</span>
            <span>+3.0m</span>
          </div>
          <div
            style={{
              width: '130px',
              height: '6px',
              borderRadius: '3px',
              background: 'linear-gradient(to right, #3b82f6, #00e676, #ffab00, #ff1744)',
            }}
          />
        </div>
      )}
    </div>
  );
};
