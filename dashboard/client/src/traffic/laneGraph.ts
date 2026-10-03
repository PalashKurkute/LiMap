// traffic/laneGraph.ts
// Procedural urban lane graph for the FoveaGrid 2.5D traffic simulation.
// Road layout is FICTIONAL/PROCEDURAL — not geographically real.

import type { LaneGraph, LaneNode } from './types';

// ──────────────────────────────────────────────────────────────────────────────
// Lane Graph Construction
// The city block is centred around the ego vehicle origin (0,0).
// World units: 1 unit = 1 metre.  Roads are 8m wide (two 3.5m lanes + kerbs).
// ──────────────────────────────────────────────────────────────────────────────
export function buildLaneGraph(): LaneGraph {
  const nodes = new Map<string, LaneNode>();

  function addNode(n: LaneNode): void {
    nodes.set(n.id, n);
  }

  // ── MAIN EAST-WEST BOULEVARD (y = +1.75 northbound, y = -1.75 southbound) ──
  // Northbound lane (vehicles travel left→right, i.e. +X)
  for (let x = -120; x <= 120; x += 20) {
    const id = `nb_${x}`;
    const prev = `nb_${x - 20}`;
    addNode({
      id,
      x,
      y: 1.75,
      next: x < 120 ? [`nb_${x + 20}`] : ['nb_120_turn'],
      laneId: 'Main Blvd NB',
      isIntersection: (x === 0 || x === -60 || x === 60),
      trafficLightGroup: (x === 0) ? 'tl_main_0' : (x === -60) ? 'tl_main_neg60' : (x === 60) ? 'tl_main_60' : undefined,
    });
    void prev;
  }
  // Southbound lane (vehicles travel right→left, i.e. -X)
  for (let x = 120; x >= -120; x -= 20) {
    const id = `sb_${x}`;
    addNode({
      id,
      x,
      y: -1.75,
      next: x > -120 ? [`sb_${x - 20}`] : ['sb_neg120_turn'],
      laneId: 'Main Blvd SB',
      isIntersection: (x === 0 || x === -60 || x === 60),
      trafficLightGroup: (x === 0) ? 'tl_main_0' : (x === -60) ? 'tl_main_neg60' : (x === 60) ? 'tl_main_60' : undefined,
    });
  }

  // ── U-TURN CONNECTORS ──
  addNode({ id: 'nb_120_turn', x: 124, y: 0, next: ['sb_120'], laneId: 'East U-Turn' });
  addNode({ id: 'sb_neg120_turn', x: -124, y: 0, next: ['nb_-120'], laneId: 'West U-Turn' });

  // Fix references: add missing nb_-120
  addNode({ id: 'nb_-120', x: -120, y: 1.75, next: ['nb_-100'], laneId: 'Main Blvd NB', isIntersection: false });

  // ── NORTH-SOUTH CROSS STREETS ──
  // Street A: x = -60  (N-S through main intersection)
  for (let y = -80; y <= 80; y += 20) {
    const eastId = `sA_e_${y}`;   // eastside (+x) lane going south (y--)
    const westId = `sA_w_${y}`;   // westside (-x) lane going north (y++)
    addNode({
      id: eastId, x: -58.25, y,
      next: y > -80 ? [`sA_e_${y - 20}`] : ['sA_e_turn_s'],
      laneId: 'Cross St A SB',
      isIntersection: y === 0,
      trafficLightGroup: y === 0 ? 'tl_main_neg60' : undefined,
    });
    addNode({
      id: westId, x: -61.75, y,
      next: y < 80 ? [`sA_w_${y + 20}`] : ['sA_w_turn_n'],
      laneId: 'Cross St A NB',
      isIntersection: y === 0,
      trafficLightGroup: y === 0 ? 'tl_main_neg60' : undefined,
    });
  }
  addNode({ id: 'sA_e_turn_s', x: -60, y: -84, next: ['sA_w_-80'], laneId: 'St A South Turn' });
  addNode({ id: 'sA_w_turn_n', x: -60, y: 84, next: ['sA_e_80'], laneId: 'St A North Turn' });

  // Street B: x = 0  (N-S through main intersection)
  for (let y = -80; y <= 80; y += 20) {
    addNode({
      id: `sB_e_${y}`, x: 1.75, y,
      next: y > -80 ? [`sB_e_${y - 20}`] : ['sB_e_turn_s'],
      laneId: 'Cross St B SB',
      isIntersection: y === 0,
      trafficLightGroup: y === 0 ? 'tl_main_0' : undefined,
    });
    addNode({
      id: `sB_w_${y}`, x: -1.75, y,
      next: y < 80 ? [`sB_w_${y + 20}`] : ['sB_w_turn_n'],
      laneId: 'Cross St B NB',
      isIntersection: y === 0,
      trafficLightGroup: y === 0 ? 'tl_main_0' : undefined,
    });
  }
  addNode({ id: 'sB_e_turn_s', x: 0, y: -84, next: ['sB_w_-80'], laneId: 'St B South Turn' });
  addNode({ id: 'sB_w_turn_n', x: 0, y: 84, next: ['sB_e_80'], laneId: 'St B North Turn' });

  // Street C: x = 60
  for (let y = -80; y <= 80; y += 20) {
    addNode({
      id: `sC_e_${y}`, x: 61.75, y,
      next: y > -80 ? [`sC_e_${y - 20}`] : ['sC_e_turn_s'],
      laneId: 'Cross St C SB',
      isIntersection: y === 0,
      trafficLightGroup: y === 0 ? 'tl_main_60' : undefined,
    });
    addNode({
      id: `sC_w_${y}`, x: 58.25, y,
      next: y < 80 ? [`sC_w_${y + 20}`] : ['sC_w_turn_n'],
      laneId: 'Cross St C NB',
      isIntersection: y === 0,
      trafficLightGroup: y === 0 ? 'tl_main_60' : undefined,
    });
  }
  addNode({ id: 'sC_e_turn_s', x: 60, y: -84, next: ['sC_w_-80'], laneId: 'St C South Turn' });
  addNode({ id: 'sC_w_turn_n', x: 60, y: 84, next: ['sC_e_80'], laneId: 'St C North Turn' });

  // ── PARALLEL SIDE STREET (y = +30 eastbound, y = +26 westbound) ──
  for (let x = -100; x <= 100; x += 20) {
    addNode({
      id: `side_e_${x}`, x, y: 30,
      next: x < 100 ? [`side_e_${x + 20}`] : ['side_turn_e'],
      laneId: 'Side St EB',
    });
    addNode({
      id: `side_w_${x}`, x, y: 26,
      next: x > -100 ? [`side_w_${x - 20}`] : ['side_turn_w'],
      laneId: 'Side St WB',
    });
  }
  addNode({ id: 'side_turn_e', x: 104, y: 28, next: ['side_w_100'], laneId: 'Side East Turn' });
  addNode({ id: 'side_turn_w', x: -104, y: 28, next: ['side_e_-100'], laneId: 'Side West Turn' });

  // ── SOUTHERN SIDE STREET (y = -28, y = -32) ──
  for (let x = -100; x <= 100; x += 20) {
    addNode({
      id: `south_e_${x}`, x, y: -28,
      next: x < 100 ? [`south_e_${x + 20}`] : ['south_turn_e'],
      laneId: 'South St EB',
    });
    addNode({
      id: `south_w_${x}`, x, y: -32,
      next: x > -100 ? [`south_w_${x - 20}`] : ['south_turn_w'],
      laneId: 'South St WB',
    });
  }
  addNode({ id: 'south_turn_e', x: 104, y: -30, next: ['south_w_100'], laneId: 'South East Turn' });
  addNode({ id: 'south_turn_w', x: -104, y: -30, next: ['south_e_-100'], laneId: 'South West Turn' });

  return { nodes };
}

// ──────────────────────────────────────────────────────────────────────────────
// Route helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Seeded PRNG (mulberry32) for deterministic reproducibility */
export function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** All valid starting node IDs for spawning vehicles */
export function getAllSpawnNodeIds(graph: LaneGraph): string[] {
  return Array.from(graph.nodes.keys());
}

/** Build a route from a start node by following random next-hops for ~routeLen steps */
export function buildRoute(
  startId: string,
  routeLen: number,
  graph: LaneGraph,
  rng: () => number
): string[] {
  const route: string[] = [startId];
  let currentId = startId;
  for (let i = 0; i < routeLen; i++) {
    const node = graph.nodes.get(currentId);
    if (!node || node.next.length === 0) break;
    const nextId = node.next[Math.floor(rng() * node.next.length)];
    if (!graph.nodes.has(nextId)) break;
    route.push(nextId);
    currentId = nextId;
  }
  return route;
}

/** Get world position (x,y) interpolated between two lane nodes */
export function getEdgePosition(
  fromNode: LaneNode,
  toNode: LaneNode,
  t: number
): { x: number; y: number; heading: number } {
  const x = fromNode.x + (toNode.x - fromNode.x) * t;
  const y = fromNode.y + (toNode.y - fromNode.y) * t;
  const heading = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
  return { x, y, heading };
}

/** Euclidean distance between two lane nodes */
export function edgeLength(a: LaneNode, b: LaneNode): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
