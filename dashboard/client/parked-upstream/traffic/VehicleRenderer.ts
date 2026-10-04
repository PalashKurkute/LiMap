// traffic/VehicleRenderer.ts
// Manages Three.js instanced rendering of all traffic vehicles.
// Uses InstancedMesh for body, brake lights, and bounding boxes.
// SIMULATED data only.

import * as THREE from 'three';
import type { TrafficSimState } from './types';

const MAX_VEHICLES = 120;

// Colour constants (semantic)
const CLR_EGO         = new THREE.Color(0x06b6d4);
const CLR_TRACKED     = new THREE.Color(0x22c55e);
const CLR_STOPPED     = new THREE.Color(0xf59e0b);
const CLR_RISK        = new THREE.Color(0xef4444);
const CLR_SELECTED    = new THREE.Color(0xfbbf24);
const CLR_BRAKE_LIGHT = new THREE.Color(0xff2222);
const CLR_SHADOW      = new THREE.Color(0x000000);

const _mat4 = new THREE.Matrix4();
const _col  = new THREE.Color();
const _v3   = new THREE.Vector3();
const _euler= new THREE.Euler();
const _q    = new THREE.Quaternion();

export class VehicleRenderer {
  private scene: THREE.Scene;

  // Instanced bodies
  private bodyMesh: THREE.InstancedMesh;
  // Instanced brake lights (rear quads)
  private brakeMesh: THREE.InstancedMesh;
  // Instanced shadows
  private shadowMesh: THREE.InstancedMesh;
  // Bounding box line segments
  private bboxGroup: THREE.Group;
  // Trail lines group (rebuilt each frame for selected vehicle)
  private trailGroup: THREE.Group;
  // Velocity arrows group
  private velGroup: THREE.Group;

  // Ego vehicle mesh
  private egoMesh: THREE.Group;

  // Traffic light indicators
  private tlGroup: THREE.Group;

  // Fovea sensing ring (follows ego)
  private sensingRingMesh: THREE.Mesh;

  // State
  showBBoxes = true;
  showVelVectors = true;
  showTrails = true;
  showModels = true;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // ── Body InstancedMesh ──────────────────────────────────────────────────
    const bodyGeo = new THREE.BoxGeometry(1, 1, 1);  // scaled per instance
    const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.25 });
    this.bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, MAX_VEHICLES);
    this.bodyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bodyMesh.castShadow = false;
    scene.add(this.bodyMesh);

    // ── Brake lights ─────────────────────────────────────────────────────────
    const brakeGeo = new THREE.PlaneGeometry(1, 1);
    const brakeMat = new THREE.MeshBasicMaterial({ color: CLR_BRAKE_LIGHT, transparent: true, opacity: 0.85 });
    this.brakeMesh = new THREE.InstancedMesh(brakeGeo, brakeMat, MAX_VEHICLES);
    this.brakeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.brakeMesh);

    // ── Contact shadows ───────────────────────────────────────────────────────
    const shadowGeo = new THREE.PlaneGeometry(1, 1);
    const shadowMat = new THREE.MeshBasicMaterial({ color: CLR_SHADOW, transparent: true, opacity: 0.22 });
    this.shadowMesh = new THREE.InstancedMesh(shadowGeo, shadowMat, MAX_VEHICLES);
    this.shadowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.shadowMesh);

    // ── Groups ────────────────────────────────────────────────────────────────
    this.bboxGroup  = new THREE.Group();
    this.trailGroup = new THREE.Group();
    this.velGroup   = new THREE.Group();
    scene.add(this.bboxGroup);
    scene.add(this.trailGroup);
    scene.add(this.velGroup);

    // ── Ego vehicle ───────────────────────────────────────────────────────────
    this.egoMesh = this._buildEgoMesh();
    scene.add(this.egoMesh);

    // ── Traffic lights group (built externally) ────────────────────────────────
    this.tlGroup = new THREE.Group();
    scene.add(this.tlGroup);

    // ── Sensing ring (fovea perimeter) ────────────────────────────────────────
    const ringGeo = new THREE.RingGeometry(49.8, 50.2, 128);
    const ringMat = new THREE.MeshBasicMaterial({
      color: CLR_EGO, side: THREE.DoubleSide, transparent: true, opacity: 0.35,
    });
    this.sensingRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.sensingRingMesh.rotation.x = -Math.PI / 2;
    this.sensingRingMesh.position.y = 0.05;
    scene.add(this.sensingRingMesh);
  }

  // ── Ego vehicle model ─────────────────────────────────────────────────────
  private _buildEgoMesh(): THREE.Group {
    const g = new THREE.Group();
    // Body
    const bodyGeo = new THREE.BoxGeometry(4.4, 0.8, 2.0);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.35, metalness: 0.4 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    g.add(body);
    // Cabin
    const cabinGeo = new THREE.BoxGeometry(2.4, 0.6, 1.4);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x083344, roughness: 0.2, metalness: 0.7 });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 1.1, 0);
    g.add(cabin);
    // Heading indicator arrow on top
    const arrowGeo = new THREE.ConeGeometry(0.3, 0.8, 8);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.rotation.z = -Math.PI / 2;
    arrow.position.set(2.2, 1.4, 0);
    g.add(arrow);
    // LiDAR turret
    const lidarGeo = new THREE.CylinderGeometry(0.25, 0.28, 0.35, 12);
    const lidarMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.6 });
    const lidar = new THREE.Mesh(lidarGeo, lidarMat);
    lidar.position.set(0, 1.65, 0);
    g.add(lidar);
    // Selection glow ring
    const selGeo = new THREE.RingGeometry(2.5, 2.9, 32);
    const selMat = new THREE.MeshBasicMaterial({ color: CLR_EGO, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    const selRing = new THREE.Mesh(selGeo, selMat);
    selRing.rotation.x = -Math.PI / 2;
    selRing.position.y = 0.02;
    g.add(selRing);
    return g;
  }

  // ── Build / update traffic lights in scene ───────────────────────────────
  updateTrafficLights(
    lights: Map<string, { isGreen: boolean }>,
    intersections: Array<{ groupId: string; x: number; z: number }>,
  ): void {
    // Rebuild each frame (lights are few, so cheap)
    while (this.tlGroup.children.length) this.tlGroup.remove(this.tlGroup.children[0]);

    for (const { groupId, x, z } of intersections) {
      const light = lights.get(groupId);
      const color = light?.isGreen ? 0x22c55e : 0xef4444;
      const geo = new THREE.SphereGeometry(0.45, 8, 6);
      const mat = new THREE.MeshBasicMaterial({ color });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, 6.5, z);
      this.tlGroup.add(m);

      // Pole
      const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 7, 6);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 3.5, z);
      this.tlGroup.add(pole);
    }
  }

  // ── Main per-frame update ─────────────────────────────────────────────────
  update(state: TrafficSimState): void {
    const { vehicles, egoX, egoY } = state;

    // Clear dynamic groups
    while (this.bboxGroup.children.length)  this.bboxGroup.remove(this.bboxGroup.children[0]);
    while (this.trailGroup.children.length) this.trailGroup.remove(this.trailGroup.children[0]);
    while (this.velGroup.children.length)   this.velGroup.remove(this.velGroup.children[0]);

    // Update ego
    this.egoMesh.position.set(egoX, 0.0, egoY);
    this.sensingRingMesh.position.set(egoX, 0.05, egoY);

    const n = Math.min(vehicles.length, MAX_VEHICLES);

    for (let i = 0; i < MAX_VEHICLES; i++) {
      if (i >= n) {
        // Hide unused instances
        _mat4.makeScale(0, 0, 0);
        this.bodyMesh.setMatrixAt(i, _mat4);
        this.brakeMesh.setMatrixAt(i, _mat4);
        this.shadowMesh.setMatrixAt(i, _mat4);
        continue;
      }

      const v = vehicles[i];
      const [len, wid] = v.size;
      const ht = v.type === 'truck' ? 1.9 : v.type === 'suv' ? 1.7 : 1.4;

      // ── World transform ──────────────────────────────────────────────────
      _euler.set(0, -v.heading, 0, 'YXZ');
      _q.setFromEuler(_euler);
      _v3.set(v.x, ht / 2, v.y);
      _mat4.compose(_v3, _q, new THREE.Vector3(len, ht, wid));
      this.bodyMesh.setMatrixAt(i, _mat4);

      // ── Body colour ──────────────────────────────────────────────────────
      if (v.isSelected) {
        _col.copy(CLR_SELECTED);
      } else if (v.state === 'stopped' && v.inLidarRange) {
        _col.copy(CLR_STOPPED);
      } else if (v.gapAhead >= 0 && v.gapAhead < 3 && v.inLidarRange) {
        _col.copy(CLR_RISK);
      } else if (!v.inLidarRange) {
        _col.setHex(v.color).lerp(new THREE.Color(0x0f172a), 0.45);
      } else {
        _col.copy(CLR_TRACKED);
      }
      this.bodyMesh.setColorAt(i, _col);

      // ── Brake lights (rear face quad) ────────────────────────────────────
      const brakeActive = v.isBraking || v.state === 'stopped';
      if (brakeActive) {
        const bx = v.x - Math.cos(v.heading) * len / 2;
        const bz = v.y - Math.sin(v.heading) * wid / 2;
        _v3.set(bx, ht * 0.55, bz);
        _euler.set(-Math.PI / 2, 0, -v.heading + Math.PI / 2, 'YXZ');
        _q.setFromEuler(_euler);
        _mat4.compose(_v3, _q, new THREE.Vector3(wid, 0.25, 1));
        this.brakeMesh.setMatrixAt(i, _mat4);
        this.brakeMesh.setColorAt(i, CLR_BRAKE_LIGHT);
      } else {
        _mat4.makeScale(0, 0, 0);
        this.brakeMesh.setMatrixAt(i, _mat4);
      }

      // ── Contact shadow ───────────────────────────────────────────────────
      _euler.set(-Math.PI / 2, 0, -v.heading, 'YXZ');
      _q.setFromEuler(_euler);
      _v3.set(v.x, 0.01, v.y);
      _mat4.compose(_v3, _q, new THREE.Vector3(len + 0.5, wid + 0.5, 1));
      this.shadowMesh.setMatrixAt(i, _mat4);
      this.shadowMesh.setColorAt(i, CLR_SHADOW);

      // ── Bounding box ─────────────────────────────────────────────────────
      if (this.showBBoxes && v.inLidarRange) {
        const boxColor = v.isSelected ? CLR_SELECTED
          : v.state === 'stopped' ? CLR_STOPPED
          : v.gapAhead >= 0 && v.gapAhead < 3 ? CLR_RISK
          : CLR_TRACKED;
        const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(len + 0.2, ht + 0.1, wid + 0.2));
        const lineMat = new THREE.LineBasicMaterial({ color: boxColor, linewidth: 1 });
        const lineMesh = new THREE.LineSegments(edges, lineMat);
        lineMesh.position.set(v.x, ht / 2, v.y);
        lineMesh.rotation.y = -v.heading;
        this.bboxGroup.add(lineMesh);

        // Vehicle ID label (done via CSS in TrafficControls overlay)
      }

      // ── Velocity vector arrow ─────────────────────────────────────────────
      if (this.showVelVectors && (v.isSelected || v.inLidarRange) && v.speed > 0.2) {
        const arrowLen = Math.max(0.5, v.speed * 0.8);
        const dir = new THREE.Vector3(Math.cos(v.heading), 0, Math.sin(v.heading));
        const arrow = new THREE.ArrowHelper(
          dir,
          new THREE.Vector3(v.x, ht + 0.2, v.y),
          arrowLen,
          v.isSelected ? 0xfbbf24 : 0x22c55e,
          Math.min(arrowLen * 0.3, 0.8),
          0.4,
        );
        this.velGroup.add(arrow);
      }

      // ── Trail ─────────────────────────────────────────────────────────────
      if (this.showTrails && v.isSelected && v.trail.length >= 2) {
        const pts: THREE.Vector3[] = v.trail.map((t) => new THREE.Vector3(t.x, 0.08, t.y));
        const trailGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const trailMat = new THREE.LineBasicMaterial({
          color: CLR_SELECTED, transparent: true, opacity: 0.65, linewidth: 1,
        });
        this.trailGroup.add(new THREE.Line(trailGeo, trailMat));
      }
    }

    // Uncertain vehicles: dim overlay on out-of-range
    if (this.bodyMesh.instanceColor) this.bodyMesh.instanceColor.needsUpdate = true;
    if (this.brakeMesh.instanceColor) this.brakeMesh.instanceColor.needsUpdate = true;
    if (this.shadowMesh.instanceColor) this.shadowMesh.instanceColor.needsUpdate = true;
    this.bodyMesh.instanceMatrix.needsUpdate = true;
    this.brakeMesh.instanceMatrix.needsUpdate = true;
    this.shadowMesh.instanceMatrix.needsUpdate = true;
    this.bodyMesh.count = n;
    this.brakeMesh.count = n;
    this.shadowMesh.count = n;
  }

  dispose(): void {
    this.scene.remove(
      this.bodyMesh, this.brakeMesh, this.shadowMesh,
      this.bboxGroup, this.trailGroup, this.velGroup,
      this.egoMesh, this.tlGroup, this.sensingRingMesh,
    );
    this.bodyMesh.dispose();
    this.brakeMesh.dispose();
    this.shadowMesh.dispose();
  }
}

// Traffic light intersection positions (world coords)
export const TRAFFIC_LIGHT_INTERSECTIONS = [
  { groupId: 'tl_main_0',     x:  0,  z: 0 },
  { groupId: 'tl_main_neg60', x: -60, z: 0 },
  { groupId: 'tl_main_60',    x:  60, z: 0 },
];
