/**
 * Fly-through of the planned route in the 3D view. Pure functions, no DOM and no three.js, so they can be tested directly.
 *
 * The route is the path the 2.5D planner found through the underpass (planner snapshot, schema limap.planner/1), so the
 * camera goes the way the planner decided a vehicle could. It is extended a little before the start and after the end,
 * eased in and out along its length, and flown at eye height with the camera looking along the route.
 */
export type Path3 = [number, number, number][];

// How the shot feels. These are camera settings, not claims about the scene.
const LEAD_IN_M = 6; // the camera starts this far before the route's first point
const RUN_OUT_M = 5; // and carries on this far past its last point
const SPEED_MPS = 4; // cruising speed along the route
const LOOK_AHEAD_M = 9; // the camera looks at the point this far ahead along the route
const EYE_HEIGHT_M = 1.2; // above the ground
const LOOK_RISE_M = 0.5; // the look target sits a little above the eye, so the deck above stays in frame
export const FLIGHT_FOV_DEG = 60;
export const FLIGHT_HOLD_MS = 1200; // pause at the end before the camera glides back

interface Pt {
  x: number;
  y: number;
}

export interface FlightPlan {
  pts: Pt[];
  /** Cumulative length at each point. */
  cum: number[];
  length: number;
  durationS: number;
  eyeZ: number;
  lookZ: number;
}

export interface Pose {
  pos: [number, number, number];
  look: [number, number, number];
  /** The route has been flown to its end. */
  done: boolean;
}

function unit(dx: number, dy: number): Pt {
  const n = Math.hypot(dx, dy) || 1;
  return { x: dx / n, y: dy / n };
}

/** null when the path has fewer than two points. `groundZ` is the ground height in the same frame as the cells. */
export function planFlight(path: Path3, groundZ: number): FlightPlan | null {
  if (path.length < 2) return null;
  const first = path[0];
  const last = path[path.length - 1];
  const d0 = unit(path[1][0] - first[0], path[1][1] - first[1]);
  const d1 = unit(last[0] - path[path.length - 2][0], last[1] - path[path.length - 2][1]);
  const pts: Pt[] = [
    { x: first[0] - d0.x * LEAD_IN_M, y: first[1] - d0.y * LEAD_IN_M },
    ...path.map(([x, y]) => ({ x, y })),
    { x: last[0] + d1.x * RUN_OUT_M, y: last[1] + d1.y * RUN_OUT_M },
  ];
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const length = cum[cum.length - 1];
  return {
    pts,
    cum,
    length,
    durationS: length / SPEED_MPS,
    eyeZ: groundZ + EYE_HEIGHT_M,
    lookZ: groundZ + EYE_HEIGHT_M + LOOK_RISE_M,
  };
}

/** Point at arc length `s` along the plan; beyond either end it carries straight on along the end segment. */
export function pointAt(plan: FlightPlan, s: number): Pt {
  const { pts, cum } = plan;
  const n = pts.length;
  if (s <= 0) {
    const d = unit(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    return { x: pts[0].x + d.x * s, y: pts[0].y + d.y * s };
  }
  if (s >= plan.length) {
    const d = unit(pts[n - 1].x - pts[n - 2].x, pts[n - 1].y - pts[n - 2].y);
    const extra = s - plan.length;
    return { x: pts[n - 1].x + d.x * extra, y: pts[n - 1].y + d.y * extra };
  }
  let i = 1;
  while (i < n - 1 && cum[i] < s) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const t = (s - cum[i - 1]) / seg;
  return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
}

const smoothstep = (u: number) => u * u * (3 - 2 * u);

function poseAtLength(plan: FlightPlan, s: number, done: boolean): Pose {
  const p = pointAt(plan, s);
  const l = pointAt(plan, s + LOOK_AHEAD_M);
  return { pos: [p.x, p.y, plan.eyeZ], look: [l.x, l.y, plan.lookZ], done };
}

/** Camera pose `elapsedS` seconds into the flight. */
export function poseAt(plan: FlightPlan, elapsedS: number): Pose {
  const u = Math.min(1, Math.max(0, elapsedS / plan.durationS));
  return poseAtLength(plan, plan.length * smoothstep(u), u >= 1);
}

/**
 * A still pose for people who ask for reduced motion: just before the route reaches forward position `x` (the
 * underpass), looking along the route. Falls back to the middle of the route when `x` is not on it.
 */
export function poseNearX(plan: FlightPlan, x: number | null): Pose {
  let s = plan.length / 2;
  if (x != null) {
    const step = 0.25;
    for (let t = 0; t <= plan.length; t += step) {
      if (pointAt(plan, t).x >= x) {
        s = t;
        break;
      }
    }
  }
  return poseAtLength(plan, s, false);
}
