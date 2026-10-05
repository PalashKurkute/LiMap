/**
 * Underpass comparison drawing (Map Inspector). Draws one grid's costmap, the path the planner found on it, and the
 * start and goal, in CSS pixels. Colours come from CSS tokens (readToken); tints use globalAlpha, never rgba() strings.
 * Everything drawn is read from the planner snapshot (schema limap.planner/1); nothing is invented here.
 */
import type { PlannerFile, PlannerGridId } from '../../types/telemetry';
import { readToken } from '../../theme/theme';
import type { Projection } from './projection';

export const UNDERPASS_HINT =
  'Underpass: the same scan, turned into a costmap by a one-height grid (left) and by the 2.5D grid (right), then handed to the planner. Red cells are impassable.';

export function costText(cost: number | null): string {
  return cost == null ? 'none' : cost.toFixed(2);
}

/** World position of one costmap cell centre. */
function cellWorld(cm: PlannerFile['meta']['costmap'], ix: number, iy: number): { x: number; y: number } {
  return { x: cm.origin_x_m + (ix + 0.5) * cm.resolution_m, y: cm.origin_y_m + (iy + 0.5) * cm.resolution_m };
}

/**
 * Where to centre and how far to zoom so the whole underpass fits one pane: the forward span from start to goal, and
 * the sideways span of what the one-height grid blocks between them (plus the endpoints). All derived from the data.
 */
export function fitUnderpass(data: PlannerFile, paneW: number, paneH: number): { x: number; y: number; zoom: number } {
  const { costmap: cm, start, goal } = data.meta;
  const fx0 = Math.min(start[0], goal[0]);
  const fx1 = Math.max(start[0], goal[0]);
  let sy0 = Math.min(start[1], goal[1]);
  let sy1 = Math.max(start[1], goal[1]);
  const naive = data.maps.naive;
  for (let i = 0; i < naive.n; i++) {
    if (naive.v[i] < cm.lethal) continue;
    const w = cellWorld(cm, naive.ix[i], naive.iy[i]);
    if (w.x < fx0 || w.x > fx1) continue;
    sy0 = Math.min(sy0, w.y);
    sy1 = Math.max(sy1, w.y);
  }
  const spanForward = fx1 - fx0 + 6;
  const spanSide = sy1 - sy0 + 4;
  return {
    x: (fx0 + fx1) / 2,
    y: (sy0 + sy1) / 2,
    zoom: Math.min((paneW * 0.92) / spanSide, (paneH * 0.86) / spanForward),
  };
}

export function drawCostmap(
  ctx: CanvasRenderingContext2D,
  proj: Projection,
  data: PlannerFile,
  grid: PlannerGridId,
  w: number,
  h: number,
): void {
  const lethal = readToken('--scene-cost-lethal');
  const risk = readToken('--scene-cost-risk');
  const pathColor = readToken('--scene-path');
  const mark = readToken('--scene-selection');
  const label = readToken('--scene-guide');

  const { costmap: cm, start, goal } = data.meta;
  const map = data.maps[grid];
  const px = Math.max(2, cm.resolution_m * proj.zoom);

  // Risky but passable cells first (graded by cost), impassable cells on top.
  for (const pass of ['risk', 'lethal'] as const) {
    ctx.fillStyle = pass === 'risk' ? risk : lethal;
    for (let i = 0; i < map.n; i++) {
      const v = map.v[i];
      const isLethal = v >= cm.lethal;
      if (isLethal !== (pass === 'lethal')) continue;
      const world = cellWorld(cm, map.ix[i], map.iy[i]);
      const c = proj.project(world.x, world.y);
      if (c.x < -px || c.y < -px || c.x > w + px || c.y > h + px) continue;
      ctx.globalAlpha = isLethal ? 0.9 : 0.25 + 0.5 * (v / cm.lethal);
      ctx.fillRect(c.x - px / 2, c.y - px / 2, px, px);
    }
  }
  ctx.globalAlpha = 1;

  // The path the planner found on this map, if it found one.
  const path = data.results[grid].path;
  if (path && path.length > 1) {
    ctx.strokeStyle = pathColor;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    path.forEach(([x, y], i) => {
      const p = proj.project(x, y);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }

  // Start (filled) and goal (ring with a cross), with labels.
  ctx.font = '10px "JetBrains Mono Variable", monospace';
  ctx.textBaseline = 'alphabetic';
  const s = proj.project(start[0], start[1]);
  ctx.fillStyle = mark;
  ctx.beginPath();
  ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
  ctx.fill();
  const g = proj.project(goal[0], goal[1]);
  ctx.strokeStyle = mark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(g.x, g.y, 6, 0, Math.PI * 2);
  ctx.moveTo(g.x - 9, g.y);
  ctx.lineTo(g.x + 9, g.y);
  ctx.moveTo(g.x, g.y - 9);
  ctx.lineTo(g.x, g.y + 9);
  ctx.stroke();
  ctx.fillStyle = label;
  ctx.fillText('START', s.x + 9, s.y + 4);
  ctx.fillText('GOAL', g.x + 11, g.y + 4);
}
