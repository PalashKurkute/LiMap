import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { SceneId, TelemetryData, CameraViewMode, ColorMapMode, DEMDisplayMode } from '../types/telemetry';
import { Gauge, Compass, Zap } from 'lucide-react';

interface ThreeViewportProps {
  sceneId: SceneId;
  telemetry: TelemetryData | null;
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

export const ThreeViewport: React.FC<ThreeViewportProps> = ({ sceneId, telemetry }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // FastDEM Viewport & Generation Controls
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('orbit');
  const [displayMode, setDisplayMode] = useState<DEMDisplayMode>('surface');
  const [colorMode, setColorMode] = useState<ColorMapMode>('elevation');
  const [isWireframe, setIsWireframe] = useState<boolean>(false);
  const [showSweepWave, setShowSweepWave] = useState<boolean>(true);
  const [showCloudOverlay, setShowCloudOverlay] = useState<boolean>(false);
  const [showColorbar, setShowColorbar] = useState<boolean>(true);

  // Interactive Real-Time Height Inspector State
  const [hoverData, setHoverData] = useState<HoverInspection | null>(null);

  // Scene References for Dynamic Updates
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const targetCameraPos = useRef<THREE.Vector3>(new THREE.Vector3(-14, -14, 11));
  const targetLookAt = useRef<THREE.Vector3>(new THREE.Vector3(16, 0, -1.0));
  const currentLookAt = useRef<THREE.Vector3>(new THREE.Vector3(16, 0, -1.0));

  const ringsGroupRef = useRef<THREE.Group | null>(null);
  const trajectoryGroupRef = useRef<THREE.Group | null>(null);
  const trackersGroupRef = useRef<THREE.Group | null>(null);
  const demSurfaceMeshRef = useRef<THREE.Mesh | null>(null);
  const demVoxelsMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const cloudPointsRef = useRef<THREE.Points | null>(null);
  const bridgeDeckMeshRef = useRef<THREE.Mesh | null>(null);
  const sweepRingMeshRef = useRef<THREE.Mesh | null>(null);
  const hoverCrosshairRef = useRef<THREE.Mesh | null>(null);

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
    if (!cameraRef.current) return;

    if (mode === 'orbit') {
      cameraRef.current.up.set(0, 0, 1);
      targetCameraPos.current.set(-14, -14, 11);
      targetLookAt.current.set(16, 0, -1.0);
    } else if (mode === 'bev') {
      cameraRef.current.up.set(1, 0, 0);
      targetCameraPos.current.set(20, 0, 44);
      targetLookAt.current.set(20, 0, 0);
    } else if (mode === 'cockpit') {
      cameraRef.current.up.set(0, 0, 1);
      targetCameraPos.current.set(-0.2, 0.0, -0.6);
      targetLookAt.current.set(32.0, 0.0, -1.2);
    } else if (mode === 'cross_cut') {
      cameraRef.current.up.set(0, 0, 1);
      targetCameraPos.current.set(18.0, -28.0, 0.0);
      targetLookAt.current.set(18.0, 0.0, 0.0);
    }
  };

  // Lightweight Display Mode & Toggles Effect (No WebGL context recreation)
  useEffect(() => {
    if (demSurfaceMeshRef.current) {
      demSurfaceMeshRef.current.visible = displayMode === 'surface';
      if (demSurfaceMeshRef.current.material instanceof THREE.MeshStandardMaterial) {
        demSurfaceMeshRef.current.material.wireframe = isWireframe;
      }
    }
    if (demVoxelsMeshRef.current) {
      demVoxelsMeshRef.current.visible = displayMode === 'voxels';
    }
    if (cloudPointsRef.current) {
      cloudPointsRef.current.visible = displayMode === 'points' || showCloudOverlay;
    }
    if (sweepRingMeshRef.current) {
      sweepRingMeshRef.current.visible = showSweepWave;
    }
  }, [displayMode, isWireframe, showCloudOverlay, showSweepWave]);

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

    // 2. Ego Vehicle Body (3D Wireframe Chassis + ROS REP-103 Axis Triad)
    const egoGroup = new THREE.Group();
    const egoBoxGeo = new THREE.BoxGeometry(2.4, 1.4, 0.8);
    const egoBoxMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true });
    const egoMesh = new THREE.Mesh(egoBoxGeo, egoBoxMat);
    egoMesh.position.set(0, 0, -1.33);
    egoGroup.add(egoMesh);

    // ROS REP-103 Axes: Red = +X Forward, Green = +Y Left, Blue = +Z Up
    const axesHelper = new THREE.AxesHelper(2.5);
    axesHelper.position.set(0, 0, -1.33);
    egoGroup.add(axesHelper);

    // Forward Direction Arrow on Ego
    const egoArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, -1.33),
      2.8,
      0x00f0ff,
      0.6,
      0.3
    );
    egoGroup.add(egoArrow);
    scene.add(egoGroup);

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
        const offset = camera.position.clone().sub(targetLookAt.current);
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

    // ==========================================
    // FastDEM Smooth Animation Loop (60 FPS WebGL)
    // ==========================================
    let animationId: number;
    let sweepRadius = 0.5;

    const animate = () => {
      animationId = requestAnimationFrame(animate);

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
  }, [sceneId]);

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }} ref={mountRef}>
      {/* Top-Left Streamlined Engine Badge & Metrics Pill */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          padding: '5px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          borderColor: 'rgba(0, 240, 255, 0.25)',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Zap size={13} style={{ color: 'var(--accent-cyan)' }} />
          <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>FASTDEM 2.5D</span>
          <span style={{ color: 'var(--accent-emerald)', fontSize: '10px', fontWeight: 600 }}>100+ Hz</span>
        </div>
        <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.15)' }} />
        <div style={{ display: 'flex', gap: '5px' }}>
          <span style={{ color: 'var(--text-muted)' }}>HEAP:</span>
          <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>
            {telemetry ? `${telemetry.total_heap_mb.toFixed(2)} MB` : '3.26 MB'}
          </span>
        </div>
        <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.15)' }} />
        <div style={{ display: 'flex', gap: '5px' }}>
          <span style={{ color: 'var(--text-muted)' }}>CELLS:</span>
          <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
            {telemetry ? `${telemetry.active_cells.toLocaleString()}` : '47,307'}
          </span>
        </div>
      </div>

      {/* Top-Right Consolidated Glass Command Bar */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 10,
        }}
      >
        {/* Display Mode (Surface / Voxels / Points) */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {(['surface', 'voxels', 'points'] as DEMDisplayMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setDisplayMode(mode)}
              style={{
                background: displayMode === mode ? 'rgba(0, 240, 255, 0.22)' : 'transparent',
                border: `1px solid ${displayMode === mode ? 'var(--accent-cyan)' : 'transparent'}`,
                color: displayMode === mode ? 'var(--accent-cyan)' : 'var(--text-muted)',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {mode === 'surface' ? 'DEM Surface' : mode === 'voxels' ? '2.5D Voxels' : 'Points'}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 16, background: 'rgba(255, 255, 255, 0.12)' }} />

        {/* Color Mode (Turbo / Slope / Variance) */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {(['elevation', 'traversability', 'uncertainty'] as ColorMapMode[]).map((col) => (
            <button
              key={col}
              onClick={() => setColorMode(col)}
              style={{
                background: colorMode === col ? 'rgba(0, 230, 118, 0.22)' : 'transparent',
                border: `1px solid ${colorMode === col ? 'var(--accent-emerald)' : 'transparent'}`,
                color: colorMode === col ? 'var(--accent-emerald)' : 'var(--text-muted)',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {col === 'elevation' ? 'Turbo Z' : col === 'traversability' ? 'Slope Risk' : 'σ² Var'}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 16, background: 'rgba(255, 255, 255, 0.12)' }} />

        {/* Camera Preset */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {(['orbit', 'bev', 'cockpit'] as CameraViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => handleCameraChange(mode)}
              style={{
                background: cameraMode === mode ? 'rgba(255, 171, 0, 0.22)' : 'transparent',
                border: `1px solid ${cameraMode === mode ? 'var(--accent-amber)' : 'transparent'}`,
                color: cameraMode === mode ? 'var(--accent-amber)' : 'var(--text-muted)',
                borderRadius: '4px',
                padding: '3px 7px',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {mode === 'bev' ? 'BEV' : mode === 'cockpit' ? 'POV' : 'Orbit'}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 16, background: 'rgba(255, 255, 255, 0.12)' }} />

        {/* Feature Toggles */}
        <button
          onClick={() => setIsWireframe(!isWireframe)}
          title="Toggle Grid Wireframe"
          style={{
            background: isWireframe ? 'rgba(255, 171, 0, 0.22)' : 'transparent',
            border: `1px solid ${isWireframe ? 'var(--accent-amber)' : 'transparent'}`,
            color: isWireframe ? 'var(--accent-amber)' : 'var(--text-muted)',
            borderRadius: '4px',
            padding: '3px 6px',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
          }}
        >
          Wire
        </button>

        <button
          onClick={() => setShowSweepWave(!showSweepWave)}
          title="Toggle Laser Scan Wave"
          style={{
            background: showSweepWave ? 'rgba(0, 240, 255, 0.22)' : 'transparent',
            border: `1px solid ${showSweepWave ? 'var(--accent-cyan)' : 'transparent'}`,
            color: showSweepWave ? 'var(--accent-cyan)' : 'var(--text-muted)',
            borderRadius: '4px',
            padding: '3px 6px',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
          }}
        >
          Wave
        </button>

        <button
          onClick={() => setShowCloudOverlay(!showCloudOverlay)}
          title="Toggle Point Cloud Overlay"
          style={{
            background: showCloudOverlay ? 'rgba(179, 136, 255, 0.22)' : 'transparent',
            border: `1px solid ${showCloudOverlay ? 'var(--accent-purple)' : 'transparent'}`,
            color: showCloudOverlay ? 'var(--accent-purple)' : 'var(--text-muted)',
            borderRadius: '4px',
            padding: '3px 6px',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
          }}
        >
          Cloud
        </button>

        <button
          onClick={() => setShowColorbar(!showColorbar)}
          title="Toggle Elevation Colorbar"
          style={{
            background: showColorbar ? 'rgba(0, 240, 255, 0.22)' : 'transparent',
            border: `1px solid ${showColorbar ? 'var(--accent-cyan)' : 'transparent'}`,
            color: showColorbar ? 'var(--accent-cyan)' : 'var(--text-muted)',
            borderRadius: '4px',
            padding: '3px 6px',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
          }}
        >
          Scale
        </button>
      </div>

      {/* FastDEM RViz-Grade Vertical Elevation Colorbar */}
      {showColorbar && (
        <div className="fastdem-colorbar-container" style={{ top: '56px', right: '12px' }}>
          <div className="fastdem-colorbar-gradient">
            {hoverData && (
              <div
                className="fastdem-colorbar-pointer"
                style={{ top: `${(1.0 - hoverData.normZ) * 100}%` }}
              />
            )}
          </div>
          <div className="fastdem-colorbar-ticks">
            <span>+2.0m Obstacle</span>
            <span>+0.8m Incline</span>
            <span>-0.5m Slope</span>
            <span>-1.2m Ground</span>
            <span>-1.73m Surface</span>
            <span>-2.25m Pothole</span>
          </div>
        </div>
      )}

      {/* Bottom Floating Telemetry & Real-Time Cursor Inspector */}
      <div
        style={{
          position: 'absolute',
          bottom: '14px',
          left: '14px',
          right: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        {/* Left: UGV Dynamics & Speedometer */}
        <div style={{ display: 'flex', gap: '10px' }}>
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
            <Gauge size={16} style={{ color: 'var(--accent-cyan)' }} />
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
            <Compass size={16} style={{ color: 'var(--accent-emerald)' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>DYNAMIC FOVEA REACH</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                14.80 m <small style={{ fontSize: '10px', fontWeight: 400, color: 'var(--accent-emerald)' }}>(+48% Lookahead)</small>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Live Interactive FastDEM Topography Inspector */}
        {hoverData ? (
          <div
            className="glass-panel"
            style={{
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              fontFamily: 'var(--font-mono)',
              border: '1px solid rgba(0, 240, 255, 0.4)',
              background: 'rgba(9, 13, 21, 0.95)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>COORDINATES</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                X: {hoverData.x.toFixed(1)}m · Y: {hoverData.y.toFixed(1)}m
              </span>
            </div>

            <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.1)' }} />

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>ELEVATION Z</span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: hoverData.z < -1.9 ? 'var(--accent-cyan)' : hoverData.z > 0.0 ? 'var(--accent-crimson)' : 'var(--accent-emerald)',
                }}
              >
                {hoverData.z.toFixed(2)} m
              </span>
            </div>

            <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.1)' }} />

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>SLOPE GRADE</span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: hoverData.slopeDeg < 5 ? 'var(--accent-emerald)' : hoverData.slopeDeg < 12 ? 'var(--accent-amber)' : 'var(--accent-crimson)',
                }}
              >
                {hoverData.slopeDeg.toFixed(1)}°
              </span>
            </div>

            {hoverData.clearance !== null && (
              <>
                <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>CLEARANCE</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    {hoverData.clearance.toFixed(2)} m
                  </span>
                </div>
              </>
            )}

            <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.1)' }} />

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>LATTICE RING</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                Ring {hoverData.ringId} ({hoverData.ringId === 0 ? '5cm' : hoverData.ringId === 1 ? '10cm' : hoverData.ringId === 2 ? '25cm' : '50cm'})
              </span>
            </div>
          </div>
        ) : (
          <div
            className="glass-panel"
            style={{
              padding: '6px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-muted)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            Hover cursor over 3D terrain to inspect real-time elevation &amp; slope
          </div>
        )}
      </div>
    </div>
  );
};
