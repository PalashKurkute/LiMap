/**
 * Map Inspector projections. Pure functions, no DOM, so they can be tested directly.
 *
 * World frame is ROS REP-103: X forward, Y left, Z up, metres. Screen is CSS pixels, y down.
 *  - '2d'  : top-down, X forward = up the screen, Y left = left. This is the original inspector transform.
 *  - 'iso' : the same map tilted (pitch) and turned (yaw) so heights show. Cells lie on the ground plane at
 *            `groundZ`; a point `dz` above it is lifted on screen by dz * k * cos(pitch) * ISO_LIFT.
 *
 * `unproject` is exact for the ground plane in both modes (it is what hit-testing and the cursor readout use).
 */
export type ProjectionMode = '2d' | 'iso';

export const ISO_PITCH = 0.82; // rad, ~47 deg
export const ISO_YAW = -0.32; // rad
const ISO_SQUEEZE = 1.05; // horizontal scale
export const ISO_LIFT = 1.5; // vertical exaggeration of heights

export interface ProjectionOpts {
  mode: ProjectionMode;
  /** Pixels per metre along the ground. */
  zoom: number;
  /** Screen position of the ego vehicle (world origin). */
  origin: { x: number; y: number };
  /** Ground height; heights are drawn relative to it. */
  groundZ: number;
}

export interface Pt {
  x: number;
  y: number;
}

export interface Projection {
  mode: ProjectionMode;
  zoom: number;
  /** World (x, y, z) to screen. `z` defaults to the ground. */
  project: (x: number, y: number, z?: number) => Pt;
  /** Screen to the world ground point under it. */
  unproject: (sx: number, sy: number) => Pt;
  /** Larger = farther from the viewer. Paint far to near. Always 0 in the top-down view. */
  depth: (x: number, y: number) => number;
}

const cosY = Math.cos(ISO_YAW);
const sinY = Math.sin(ISO_YAW);
const cosP = Math.cos(ISO_PITCH);
const sinP = Math.sin(ISO_PITCH);

/** Depth key for sorting cells far-to-near in the isometric view (larger = farther). Independent of pan and zoom. */
export function isoDepth(x: number, y: number): number {
  return x * cosY - y * sinY;
}

export function makeProjection({ mode, zoom: k, origin: o, groundZ }: ProjectionOpts): Projection {
  if (mode === '2d') {
    return {
      mode,
      zoom: k,
      project: (x, y) => ({ x: o.x - y * k, y: o.y - x * k }),
      unproject: (sx, sy) => ({ x: (o.y - sy) / k, y: (o.x - sx) / k }),
      depth: () => 0,
    };
  }
  return {
    mode,
    zoom: k,
    project: (x, y, z = groundZ) => {
      const rotX = x * cosY - y * sinY;
      const rotY = x * sinY + y * cosY;
      return {
        x: o.x - ISO_SQUEEZE * k * rotY,
        y: o.y - k * sinP * rotX - (z - groundZ) * k * cosP * ISO_LIFT,
      };
    },
    unproject: (sx, sy) => {
      const rotY = (o.x - sx) / (ISO_SQUEEZE * k);
      const rotX = (o.y - sy) / (k * sinP);
      return { x: rotX * cosY + rotY * sinY, y: -rotX * sinY + rotY * cosY };
    },
    depth: isoDepth,
  };
}

/** The four screen corners of a square cell centred on (x, y) with side `res`, on the ground plane. */
export function cellCorners(p: Projection, x: number, y: number, res: number, z?: number): [Pt, Pt, Pt, Pt] {
  const h = res / 2;
  return [p.project(x - h, y - h, z), p.project(x + h, y - h, z), p.project(x + h, y + h, z), p.project(x - h, y + h, z)];
}
