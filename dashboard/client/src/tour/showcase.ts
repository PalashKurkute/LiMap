import type { GridCellData, SceneId } from '../types/telemetry';

/**
 * Picks the cell the tour shows off for a scene. Pure and deterministic: ties go to the cell nearest the
 * vehicle, and every scene falls back to the best-observed cell, so a result always exists when there are cells.
 */
function best(cells: GridCellData[], keep: (c: GridCellData) => boolean, score: (c: GridCellData) => number): GridCellData | null {
  let top: GridCellData | null = null;
  let topScore = -Infinity;
  let topDist = Infinity;
  for (const c of cells) {
    if (!keep(c)) continue;
    const s = score(c);
    const d = Math.hypot(c.x_m, c.y_m);
    if (s > topScore || (s === topScore && d < topDist)) {
      top = c;
      topScore = s;
      topDist = d;
    }
  }
  return top;
}

const POLE = 80;
const BUILDING = 50;
const TRUNK = 71;
const MOVING_MIN = 250;

export function pickShowcaseCell(scene: SceneId, cells: GridCellData[], groundZ: number): GridCellData | null {
  if (cells.length === 0) return null;
  let picked: GridCellData | null = null;
  switch (scene) {
    case 'scene_a_bridge':
      picked = best(cells, (c) => c.clearance != null, (c) => -(c.clearance as number));
      break;
    case 'scene_b_potholes':
      picked = best(cells, (c) => c.ring_id <= 1, (c) => -(c.mean_z - groundZ));
      break;
    case 'scene_c_moving':
      picked = best(cells, (c) => c.sem_id >= MOVING_MIN, (c) => -Math.hypot(c.x_m, c.y_m));
      break;
    case 'scene_d_poles':
      picked = best(cells, (c) => c.ring_id === 0 && c.sem_id === POLE, (c) => c.max_z - c.min_z);
      break;
    default:
      picked = best(cells, (c) => c.sem_id === POLE || c.sem_id === BUILDING || c.sem_id === TRUNK, (c) => c.max_z - c.min_z);
  }
  return picked ?? best(cells, () => true, (c) => c.count);
}
