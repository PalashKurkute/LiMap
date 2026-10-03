// traffic/trafficSimulation.ts
// Core deterministic vehicle simulation engine.
// Uses Welford-style IDM (Intelligent Driver Model) for car-following.
// All data is SIMULATED — no real sensor measurements.

import type {
  SimVehicle,
  TrafficSimState,
  TrafficLight,
  VehicleType,
  EventFeedItem,
} from './types';
import {
  buildLaneGraph,
  buildRoute,
  edgeLength,
  getEdgePosition,
  mulberry32,
} from './laneGraph';

// ── Constants ─────────────────────────────────────────────────────────────────
const SENSING_RADIUS = 50.0; // metres — matches fovea ring radius
const MIN_GAP = 2.5;          // IDM minimum safety gap (m)
const MAX_ACCEL = 2.8;        // IDM max acceleration (m/s²)
const COMFORT_DECEL = 3.5;    // IDM comfortable braking (m/s²)
const HEADWAY_T = 1.6;        // IDM desired time headway (s)
const TRAIL_INTERVAL = 0.15;  // seconds between trail point recordings
const INDICATOR_BLINK = 0.4;  // seconds per blink half-cycle

const VEHICLE_TYPES: VehicleType[] = ['sedan', 'suv', 'truck', 'hatchback'];
const TYPE_SIZES: Record<VehicleType, [number, number]> = {
  sedan:    [4.2, 1.8],
  suv:      [4.6, 2.0],
  truck:    [5.8, 2.2],
  hatchback:[3.8, 1.7],
};
const TYPE_SPEEDS: Record<VehicleType, [number, number]> = {
  sedan:    [9, 14],   // m/s
  suv:      [8, 12],
  truck:    [6, 9],
  hatchback:[10, 15],
};
const PALETTE = [
  0x334155, 0x1e40af, 0x065f46, 0x7c3aed,
  0x92400e, 0x831843, 0x0e7490, 0x3f6212,
  0x1e293b, 0x4c1d95, 0x164e63, 0x14532d,
];

const GRAPH = buildLaneGraph();

// ── Seeded RNG ────────────────────────────────────────────────────────────────
const GLOBAL_SEED = 0xdeadbeef;
const rng = mulberry32(GLOBAL_SEED);

// ── Traffic Light Initialisation ─────────────────────────────────────────────
function buildTrafficLights(): Map<string, TrafficLight> {
  const lights = new Map<string, TrafficLight>();
  const configs: [string, number, number, number][] = [
    ['tl_main_0',     22, 18, 0],
    ['tl_main_neg60', 22, 18, 8],   // phase offset so not all red at once
    ['tl_main_60',    22, 18, 14],
  ];
  for (const [groupId, green, red, offset] of configs) {
    // Determine initial state based on offset
    const cycle = green + red;
    const t = offset % cycle;
    lights.set(groupId, {
      groupId,
      greenDuration: green,
      redDuration: red,
      elapsed: t,
      isGreen: t < green,
    });
  }
  return lights;
}

// ── Vehicle Spawner ────────────────────────────────────────────────────────────
function spawnVehicle(id: string, density: number): SimVehicle {
  const type = VEHICLE_TYPES[Math.floor(rng() * VEHICLE_TYPES.length)];
  const size = TYPE_SIZES[type];
  const speedRange = TYPE_SPEEDS[type];
  const targetSpeed = speedRange[0] + rng() * (speedRange[1] - speedRange[0]);
  const color = PALETTE[Math.floor(rng() * PALETTE.length)];

  // Pick a random start node
  const nodeIds = Array.from(GRAPH.nodes.keys());
  const startId = nodeIds[Math.floor(rng() * nodeIds.length)];
  const routeLen = 12 + Math.floor(rng() * 20);
  const route = buildRoute(startId, routeLen, GRAPH, rng);

  // Random starting edge progress so vehicles don't all bunch at nodes
  const edgeIndex = 0;
  const edgeProgress = rng();

  // Place vehicle at starting position
  let x = 0, y = 0, heading = 0;
  if (route.length >= 2) {
    const from = GRAPH.nodes.get(route[0]);
    const to = GRAPH.nodes.get(route[1]);
    if (from && to) {
      const pos = getEdgePosition(from, to, edgeProgress);
      x = pos.x; y = pos.y; heading = pos.heading;
    }
  }

  void density;

  return {
    id,
    type,
    x, y, heading,
    speed: targetSpeed * (0.6 + rng() * 0.4),
    targetSpeed,
    state: 'driving',
    route: { nodeIds: route, edgeIndex, edgeProgress },
    size,
    color,
    isBraking: false,
    indicator: 0,
    indicatorTimer: 0,
    isSelected: false,
    inLidarRange: false,
    trail: [],
    timeSinceLastLaneChange: rng() * 10,
    gapAhead: -1,
  };
}

// ── IDM Acceleration ──────────────────────────────────────────────────────────
function idmAcceleration(
  v: number,
  v0: number,
  gap: number,
  dv: number
): number {
  if (gap <= 0) return -MAX_ACCEL * 2; // emergency brake
  const s0 = MIN_GAP;
  const sStar = s0 + Math.max(0, v * HEADWAY_T + (v * dv) / (2 * Math.sqrt(MAX_ACCEL * COMFORT_DECEL)));
  const freeAccel = MAX_ACCEL * (1 - Math.pow(Math.max(0, v) / v0, 4));
  const brakeTerm = MAX_ACCEL * Math.pow(sStar / Math.max(gap, 0.1), 2);
  return freeAccel - brakeTerm;
}

// ── Initialise Simulation State ───────────────────────────────────────────────
export function initSimState(targetCount: number): TrafficSimState {
  const vehicles: SimVehicle[] = [];
  for (let i = 0; i < targetCount; i++) {
    vehicles.push(spawnVehicle(`v${i}`, 1.0));
  }
  return {
    vehicles,
    lights: buildTrafficLights(),
    elapsed: 0,
    egoX: 0,
    egoY: 0,
    egoSensingRadius: SENSING_RADIUS,
  };
}

// ── Respawn a vehicle that has finished its route ─────────────────────────────
function respawnVehicle(v: SimVehicle): void {
  const nodeIds = Array.from(GRAPH.nodes.keys());
  const startId = nodeIds[Math.floor(rng() * nodeIds.length)];
  const routeLen = 12 + Math.floor(rng() * 20);
  v.route.nodeIds = buildRoute(startId, routeLen, GRAPH, rng);
  v.route.edgeIndex = 0;
  v.route.edgeProgress = 0;
  v.state = 'driving';
  v.isBraking = false;
  v.indicator = 0;
  v.trail = [];
}

// ── Main Tick ─────────────────────────────────────────────────────────────────
export function tickSimulation(
  state: TrafficSimState,
  dt: number,
  simSpeed: number,
  density: number,
  isPlaying: boolean,
  onEvent: (e: EventFeedItem) => void,
): TrafficSimState {
  if (!isPlaying) return state;

  const scaledDt = dt * simSpeed;
  const newElapsed = state.elapsed + scaledDt;

  // ── 1. Update traffic lights ───────────────────────────────────────────────
  const lights = new Map(state.lights);
  lights.forEach((light, key) => {
    const newElapsedLight = light.elapsed + scaledDt;
    const cycle = light.greenDuration + light.redDuration;
    const phase = newElapsedLight % cycle;
    lights.set(key, {
      ...light,
      elapsed: newElapsedLight,
      isGreen: phase < light.greenDuration,
    });
  });

  // ── 2. Build spatial lookup: vehicle positions for gap detection ───────────
  // Map each vehicle to its current position for car-following
  const prevPositions = new Map<string, { x: number; y: number; speed: number; heading: number }>();
  state.vehicles.forEach((v) => {
    prevPositions.set(v.id, { x: v.x, y: v.y, speed: v.speed, heading: v.heading });
  });

  // ── 3. Update each vehicle ─────────────────────────────────────────────────
  const targetCount = Math.round(30 + density * 70); // 30–100 vehicles
  const prevCount = state.vehicles.length;

  const vehicles = state.vehicles.map((v): SimVehicle => {
    // Clone
    const nv: SimVehicle = { ...v, route: { ...v.route, nodeIds: [...v.route.nodeIds] }, trail: [...v.trail] };

    const { nodeIds, edgeIndex, edgeProgress } = nv.route;
    if (nodeIds.length < 2 || edgeIndex >= nodeIds.length - 1) {
      respawnVehicle(nv);
      return nv;
    }

    const fromId = nodeIds[edgeIndex];
    const toId = nodeIds[edgeIndex + 1];
    const fromNode = GRAPH.nodes.get(fromId);
    const toNode = GRAPH.nodes.get(toId);
    if (!fromNode || !toNode) { respawnVehicle(nv); return nv; }

    const segLen = Math.max(edgeLength(fromNode, toNode), 0.5);

    // Check traffic light at destination intersection
    let lightIsRed = false;
    if (toNode.isIntersection && toNode.trafficLightGroup) {
      const light = lights.get(toNode.trafficLightGroup);
      if (light && !light.isGreen) lightIsRed = true;
    }

    // Find closest vehicle ahead on same edge segment (simple linear gap)
    let gapAhead = 999;
    let speedAhead = nv.targetSpeed;
    for (const [otherId, oPos] of prevPositions) {
      if (otherId === nv.id) continue;
      // Project onto same heading
      const dx = oPos.x - nv.x;
      const dy = oPos.y - nv.y;
      const dot = dx * Math.cos(nv.heading) + dy * Math.sin(nv.heading);
      const cross = Math.abs(-dx * Math.sin(nv.heading) + dy * Math.cos(nv.heading));
      if (dot > 0 && dot < 30 && cross < 2.5) {
        const bodyGap = dot - (nv.size[0] / 2 + 2.0);
        if (bodyGap < gapAhead) {
          gapAhead = bodyGap;
          speedAhead = oPos.speed;
        }
      }
    }
    nv.gapAhead = gapAhead > 100 ? -1 : gapAhead;

    // IDM acceleration
    let targetV = lightIsRed && edgeProgress > 0.75 ? 0 : nv.targetSpeed;
    // Emergency stop at red
    if (lightIsRed && edgeProgress > 0.85) targetV = 0;

    const dv = nv.speed - speedAhead;
    let accel = idmAcceleration(nv.speed, targetV, gapAhead, dv);
    accel = Math.max(-COMFORT_DECEL * 2, Math.min(MAX_ACCEL, accel));

    const newSpeed = Math.max(0, nv.speed + accel * scaledDt);
    nv.speed = newSpeed;
    nv.isBraking = accel < -0.5;

    // Determine state
    if (newSpeed < 0.2 && lightIsRed) nv.state = 'stopped';
    else if (newSpeed < 0.2 && gapAhead < 3) nv.state = 'stopped';
    else if (nv.isBraking) nv.state = 'braking';
    else {
      // Check if turning (next edge has different heading)
      const nextEdgeIdx = edgeIndex + 1;
      if (nextEdgeIdx < nodeIds.length - 1) {
        const nextFrom = GRAPH.nodes.get(nodeIds[nextEdgeIdx]);
        const nextTo = GRAPH.nodes.get(nodeIds[nextEdgeIdx + 1]);
        if (nextFrom && nextTo) {
          const nextHeading = Math.atan2(nextTo.y - nextFrom.y, nextTo.x - nextFrom.x);
          const currentHeading = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
          const delta = Math.abs(((nextHeading - currentHeading) + Math.PI) % (2 * Math.PI) - Math.PI);
          if (delta > 0.3 && edgeProgress > 0.7) nv.state = 'turning';
          else nv.state = 'driving';
        } else nv.state = 'driving';
      } else nv.state = 'driving';
    }

    // Indicator logic: turn on when approaching a turn junction
    if (nv.state === 'turning') {
      nv.indicator = nv.indicator === 0 ? 1 : nv.indicator;
      nv.indicatorTimer += scaledDt;
    } else {
      nv.indicator = 0;
      nv.indicatorTimer = 0;
    }

    // Advance position along edge
    const distTravelled = newSpeed * scaledDt;
    const progressDelta = distTravelled / segLen;
    nv.route.edgeProgress = edgeProgress + progressDelta;

    // Advance to next edge
    if (nv.route.edgeProgress >= 1.0) {
      nv.route.edgeProgress = nv.route.edgeProgress - 1.0;
      nv.route.edgeIndex = edgeIndex + 1;
      if (nv.route.edgeIndex >= nodeIds.length - 1) {
        respawnVehicle(nv);
        return nv;
      }
      // Fire lane change event occasionally
      if (rng() < 0.15) {
        onEvent({
          id: `${nv.id}_lc_${newElapsed.toFixed(0)}`,
          timestamp: newElapsed,
          type: 'lane_change',
          vehicleId: nv.id,
          message: `${nv.id} changed lane`,
        });
        nv.timeSinceLastLaneChange = 0;
      }
    }

    // Update world position
    const edgeI = nv.route.edgeIndex;
    if (edgeI < nodeIds.length - 1) {
      const fn = GRAPH.nodes.get(nodeIds[edgeI]);
      const tn = GRAPH.nodes.get(nodeIds[edgeI + 1]);
      if (fn && tn) {
        const pos = getEdgePosition(fn, tn, Math.min(nv.route.edgeProgress, 1.0));
        nv.x = pos.x;
        nv.y = pos.y;
        // Smooth heading interpolation
        const targetH = pos.heading;
        let dh = targetH - nv.heading;
        while (dh > Math.PI) dh -= 2 * Math.PI;
        while (dh < -Math.PI) dh += 2 * Math.PI;
        nv.heading += dh * Math.min(8 * scaledDt, 1.0);
      }
    }

    // LiDAR range check
    const distFromEgo = Math.hypot(nv.x - state.egoX, nv.y - state.egoY);
    const wasInRange = nv.inLidarRange;
    nv.inLidarRange = distFromEgo <= SENSING_RADIUS;

    if (nv.inLidarRange && !wasInRange) {
      onEvent({
        id: `${nv.id}_enter_${newElapsed.toFixed(0)}`,
        timestamp: newElapsed,
        type: 'entered_range',
        vehicleId: nv.id,
        message: `${nv.id} entered sensing range`,
      });
    } else if (!nv.inLidarRange && wasInRange) {
      onEvent({
        id: `${nv.id}_exit_${newElapsed.toFixed(0)}`,
        timestamp: newElapsed,
        type: 'exited_range',
        vehicleId: nv.id,
        message: `${nv.id} exited sensing range`,
      });
    }

    // Stopped at intersection event
    if (nv.state === 'stopped' && lightIsRed && rng() < 0.002) {
      onEvent({
        id: `${nv.id}_stop_${newElapsed.toFixed(0)}`,
        timestamp: newElapsed,
        type: 'stopped_intersection',
        vehicleId: nv.id,
        message: `${nv.id} stopped at red light`,
      });
    }

    // Collision risk: close gap + high speed
    if (gapAhead < MIN_GAP * 1.5 && nv.speed > 5 && rng() < 0.003) {
      onEvent({
        id: `${nv.id}_risk_${newElapsed.toFixed(0)}`,
        timestamp: newElapsed,
        type: 'collision_risk',
        vehicleId: nv.id,
        message: `${nv.id} collision risk — gap ${gapAhead.toFixed(1)}m`,
      });
    }

    // Trail recording
    if (nv.isSelected) {
      // Record every TRAIL_INTERVAL seconds (approximated)
      if (nv.trail.length === 0 ||
          Math.hypot(nv.x - nv.trail[nv.trail.length - 1].x, nv.y - nv.trail[nv.trail.length - 1].y) > 2.0) {
        nv.trail.push({ x: nv.x, y: nv.y });
        if (nv.trail.length > 24) nv.trail.shift();
      }
    } else {
      nv.trail = [];
    }

    void TRAIL_INTERVAL;
    void INDICATOR_BLINK;

    return nv;
  });

  // ── 4. Density management: spawn or despawn ────────────────────────────────
  while (vehicles.length < targetCount) {
    vehicles.push(spawnVehicle(`v${prevCount + vehicles.length}`, density));
  }
  // Trim excess (remove from end, keep selected ones)
  while (vehicles.length > targetCount && !vehicles[vehicles.length - 1].isSelected) {
    vehicles.pop();
  }

  return {
    ...state,
    vehicles,
    lights,
    elapsed: newElapsed,
  };
}

/** Compute distance from ego vehicle to a traffic vehicle */
export function distanceToEgo(state: TrafficSimState, vehicleId: string): number {
  const v = state.vehicles.find((v) => v.id === vehicleId);
  if (!v) return -1;
  return Math.hypot(v.x - state.egoX, v.y - state.egoY);
}
