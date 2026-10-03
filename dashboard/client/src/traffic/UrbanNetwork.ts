// traffic/UrbanNetwork.ts
// Builds Three.js geometry for the urban road network: roads, markings,
// sidewalks, crosswalks, parking areas, buildings, trees, street lights.
// All geometry is PROCEDURAL — not a real city map.

import * as THREE from 'three';

const ROAD_COLOR    = 0x1a1f2e;
const KERB_COLOR    = 0x374151;
const MARKING_COLOR = 0xffffff;
const SIDEWALK_COLOR= 0x2a3040;
const CROSS_COLOR   = 0xe8eaf6;
const BUILDING_COLORS = [0x1e2842, 0x1a3040, 0x2a1e3f, 0x0f2818, 0x2a1a1a];
const LIGHT_POLE_COLOR= 0x475569;
const LIGHT_GLOBE_COLOR = 0xfef3c7;  // warm amber
const TREE_TRUNK_COLOR  = 0x3d2b1a;
const TREE_CROWN_COLOR  = 0x1a3d1a;

// Half-widths for road geometry
const LANE_W   = 3.5;
const KERB_W   = 0.5;
const WALK_W   = 4.0;

export class UrbanNetwork {
  readonly group: THREE.Group;

  constructor() {
    this.group = new THREE.Group();
    this._buildGround();
    this._buildMainBoulevard();
    this._buildCrossStreets();
    this._buildSideStreets();
    this._buildCrosswalks();
    this._buildParkingAreas();
    this._buildBuildings();
    this._buildTrees();
    this._buildStreetLights();
  }

  // ── Ground Plane ─────────────────────────────────────────────────────────
  private _buildGround(): void {
    const geo = new THREE.PlaneGeometry(300, 300);
    const mat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    this.group.add(mesh);
  }

  // ── Helper: road segment ─────────────────────────────────────────────────
  private _addRoadRect(
    cx: number, cy: number,
    w: number, h: number,
    color: number,
    y: number = 0.01,
  ): void {
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, y, cy);
    this.group.add(mesh);
  }

  // ── Helper: dashed line stripe ───────────────────────────────────────────
  private _addDashLine(
    x1: number, y1: number,
    x2: number, y2: number,
    dashLen = 3, gapLen = 4,
    width = 0.18,
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const total = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const stride = dashLen + gapLen;
    let t = 0;
    while (t < total) {
      const cx = x1 + (t + dashLen / 2) * (dx / total);
      const cy = y1 + (t + dashLen / 2) * (dy / total);
      const geo = new THREE.PlaneGeometry(dashLen, width);
      const mat = new THREE.MeshBasicMaterial({ color: MARKING_COLOR, opacity: 0.8, transparent: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = -angle;
      mesh.position.set(cx, 0.015, cy);
      this.group.add(mesh);
      t += stride;
    }
  }

  // ── Helper: solid line ───────────────────────────────────────────────────
  private _addSolidLine(
    x1: number, y1: number,
    x2: number, y2: number,
    width = 0.18,
    color = MARKING_COLOR,
  ): void {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const geo = new THREE.PlaneGeometry(len, width);
    const mat = new THREE.MeshBasicMaterial({ color, opacity: 0.9, transparent: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -angle;
    mesh.position.set(cx, 0.015, cy);
    this.group.add(mesh);
  }

  // ── Main East-West Boulevard (±120m) ────────────────────────────────────
  private _buildMainBoulevard(): void {
    const roadHalfW = LANE_W * 2 + KERB_W;
    const totalW = roadHalfW * 2;

    // Asphalt surface
    this._addRoadRect(0, 0, 240, totalW, ROAD_COLOR);

    // Sidewalks
    this._addRoadRect(0,  roadHalfW + WALK_W / 2, 240, WALK_W, SIDEWALK_COLOR);
    this._addRoadRect(0, -(roadHalfW + WALK_W / 2), 240, WALK_W, SIDEWALK_COLOR);

    // Kerb edges
    this._addRoadRect(0,  roadHalfW, 240, KERB_W * 0.5, KERB_COLOR, 0.02);
    this._addRoadRect(0, -roadHalfW, 240, KERB_W * 0.5, KERB_COLOR, 0.02);

    // Centre dividing double yellow line
    this._addSolidLine(-120, 0.25, 120,  0.25, 0.14, 0xfbbf24);
    this._addSolidLine(-120, -0.25, 120, -0.25, 0.14, 0xfbbf24);

    // Lane dashes (northbound lane y ≈ 1.75, southbound y ≈ -1.75)
    this._addDashLine(-120, 3.5, 120, 3.5);   // NB outer
    this._addDashLine(-120, -3.5, 120, -3.5); // SB outer
  }

  // ── North-South Cross Streets ────────────────────────────────────────────
  private _buildCrossStreets(): void {
    const xs = [-60, 0, 60];
    for (const x of xs) {
      const roadHalfW = LANE_W * 2 + KERB_W;
      const totalW = roadHalfW * 2;
      // Asphalt (N-S so rotate)
      this._addRoadRect(x, 0, totalW, 200, ROAD_COLOR);
      // Sidewalks
      this._addRoadRect(x - (roadHalfW + WALK_W / 2), 0, WALK_W, 200, SIDEWALK_COLOR);
      this._addRoadRect(x + (roadHalfW + WALK_W / 2), 0, WALK_W, 200, SIDEWALK_COLOR);
      // Centre divider
      this._addSolidLine(x + 0.25, -100, x + 0.25, 100, 0.14, 0xfbbf24);
      this._addSolidLine(x - 0.25, -100, x - 0.25, 100, 0.14, 0xfbbf24);
      // Lane dashes
      this._addDashLine(x + 1.75, -100, x + 1.75, 100);
      this._addDashLine(x - 1.75, -100, x - 1.75, 100);
    }
  }

  // ── Side Streets ─────────────────────────────────────────────────────────
  private _buildSideStreets(): void {
    const ys = [28, -30];
    for (const y of ys) {
      this._addRoadRect(0, y, 240, LANE_W * 2 + 1, ROAD_COLOR);
      this._addRoadRect(0, y + LANE_W + 0.7, 240, WALK_W, SIDEWALK_COLOR);
      this._addRoadRect(0, y - LANE_W - 0.7, 240, WALK_W, SIDEWALK_COLOR);
      this._addDashLine(-120, y, 120, y);
    }
  }

  // ── Crosswalks at intersections ──────────────────────────────────────────
  private _buildCrosswalks(): void {
    const stripeW = 0.7;
    const stripeGap = 0.5;
    const stripeCount = 8;
    const xs = [-60, 0, 60];

    for (const x of xs) {
      // E-W crosswalk (crosses the main boulevard)
      for (let s = 0; s < stripeCount; s++) {
        const cz = -5 + s * (stripeW + stripeGap);
        this._addRoadRect(x - 5, cz, 10, stripeW, CROSS_COLOR, 0.02);
        this._addRoadRect(x + 5, cz, 10, stripeW, CROSS_COLOR, 0.02);
      }
      // N-S crosswalk
      for (let s = 0; s < stripeCount; s++) {
        const cx = x - 5 + s * (stripeW + stripeGap);
        this._addRoadRect(cx, -5, stripeW, 10, CROSS_COLOR, 0.02);
        this._addRoadRect(cx,  5, stripeW, 10, CROSS_COLOR, 0.02);
      }
    }
  }

  // ── Parking Areas ────────────────────────────────────────────────────────
  private _buildParkingAreas(): void {
    const spots: [number, number, number, number][] = [
      [-90, 38, 40, 8],
      [ 30, 38, 40, 8],
      [-90,-38, 40, 8],
      [ 30,-38, 40, 8],
    ];
    for (const [cx, cy, w, h] of spots) {
      this._addRoadRect(cx, cy, w, h, 0x1e2738);
      // Parking stall stripes
      const n = Math.floor(w / 3);
      for (let i = 0; i <= n; i++) {
        const px = cx - w / 2 + i * 3;
        this._addSolidLine(px, cy - h / 2, px, cy + h / 2, 0.1, 0xffffff);
      }
    }
  }

  // ── Buildings ────────────────────────────────────────────────────────────
  private _buildBuildings(): void {
    const bldgs: [number, number, number, number, number][] = [
      // [cx, cy, w, d, height]
      [-85, 50, 20, 18, 14],
      [-55, 50, 24, 18, 20],
      [-20, 50, 18, 18, 10],
      [ 15, 50, 22, 18, 16],
      [ 45, 50, 20, 18, 12],
      [ 75, 50, 18, 18, 22],
      [-85,-50, 20, 18, 12],
      [-50,-50, 24, 18, 18],
      [-15,-50, 18, 18,  8],
      [ 20,-50, 22, 18, 14],
      [ 50,-50, 20, 18, 20],
      [ 80,-50, 18, 18, 10],
    ];
    const colorIdx = [0, 1, 2, 3, 4];
    let ci = 0;
    for (const [cx, cy, w, d, h] of bldgs) {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshStandardMaterial({
        color: BUILDING_COLORS[colorIdx[ci % colorIdx.length]],
        roughness: 0.7,
        metalness: 0.15,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx, h / 2, cy);
      this.group.add(mesh);
      // Roof highlight
      const rfGeo = new THREE.BoxGeometry(w + 0.2, 0.3, d + 0.2);
      const rfMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
      const rf = new THREE.Mesh(rfGeo, rfMat);
      rf.position.set(cx, h + 0.15, cy);
      this.group.add(rf);
      ci++;
    }
  }

  // ── Trees ────────────────────────────────────────────────────────────────
  private _buildTrees(): void {
    const positions: [number, number][] = [];
    // Along main boulevard sidewalks
    for (let x = -110; x <= 110; x += 12) {
      positions.push([x,  11], [x, -11]);
    }
    // Along side streets
    for (let x = -100; x <= 100; x += 15) {
      positions.push([x, 35], [x, -37]);
    }

    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 3, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: TREE_TRUNK_COLOR });
    const crownGeo = new THREE.SphereGeometry(1.8, 8, 6);
    const crownMat = new THREE.MeshStandardMaterial({ color: TREE_CROWN_COLOR, roughness: 0.9 });

    for (const [tx, ty] of positions) {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(tx, 1.5, ty);
      this.group.add(trunk);

      const crown = new THREE.Mesh(crownGeo, crownMat);
      crown.position.set(tx, 4.5, ty);
      this.group.add(crown);
    }
  }

  // ── Street Lights ────────────────────────────────────────────────────────
  private _buildStreetLights(): void {
    const positions: [number, number][] = [];
    for (let x = -100; x <= 100; x += 24) {
      positions.push([x, 10], [x, -10]);
    }
    for (const [px, py] of positions) {
      // Pole
      const poleGeo = new THREE.CylinderGeometry(0.07, 0.09, 8, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: LIGHT_POLE_COLOR });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(px, 4, py);
      this.group.add(pole);

      // Arm
      const armGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(px + 1.2, 8.0, py);
      this.group.add(arm);

      // Globe
      const globeGeo = new THREE.SphereGeometry(0.25, 8, 6);
      const globeMat = new THREE.MeshBasicMaterial({ color: LIGHT_GLOBE_COLOR });
      const globe = new THREE.Mesh(globeGeo, globeMat);
      globe.position.set(px + 2.4, 7.9, py);
      this.group.add(globe);

      // Point light (soft, short range)
      const pl = new THREE.PointLight(0xfef3c7, 1.2, 20, 2);
      pl.position.set(px + 2.4, 8.2, py);
      this.group.add(pl);
    }
  }
}
