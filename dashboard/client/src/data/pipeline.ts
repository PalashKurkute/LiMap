import type { GridCellData } from '../types/telemetry';

/** Pipeline height colouring is relative to the grid's own ground estimate, so small dips (potholes) and overhangs stand out. */
export const PIPE_REL_MIN = -0.8;
export const PIPE_REL_SPAN = 3.8;

const median = (values: number[]): number => {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * Ground height under the sensor, taken from the grid itself: median height of the finest-ring cells within a few
 * metres of the origin (road cells when labelled). Falls back to the sensor-mount default when there are none.
 */
export function computeGroundZ(cells: GridCellData[], fallback = -1.73): number {
  const near = cells.filter((c) => c.ring_id === 0 && Math.hypot(c.x_m, c.y_m) < 6);
  const road = near.filter((c) => c.sem_id === 40);
  const pool = road.length >= 8 ? road : near;
  return pool.length >= 8 ? median(pool.map((c) => c.mean_z)) : fallback;
}
