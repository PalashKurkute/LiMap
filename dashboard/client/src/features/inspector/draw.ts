/**
 * Canvas drawing for the Map Inspector. Draws in CSS pixels (the caller sets the DPR transform).
 * Everything coloured comes from CSS tokens (readToken) or src/theme/colormaps.ts, never literals, so the
 * light/dark toggle reaches this canvas. Tints use globalAlpha, not rgba() strings.
 */
import type { GridCellData } from '../../types/telemetry';
import type { InspectorColorBy } from '../../state/inspector';
import type { ResolvedTheme } from '../../theme/theme';
import { readToken } from '../../theme/theme';
import { elevationCss, overhangCss, semanticColor, varianceCss } from '../../theme/colormaps';
import { cellCorners, type Projection } from './projection';

export interface CellLayer {
  /** Already sorted far-to-near when the projection is isometric. */
  cells: GridCellData[];
  /** Restrict this layer to screen x in [x0, x1) (used by the A/B swipe). */
  clipX?: [number, number] | null;
}

export interface RingGeom {
  id: number;
  /** Outer radius in metres. */
  radius: number;
}

export interface DrawParams {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  proj: Projection;
  layers: CellLayer[];
  colorBy: InspectorColorBy;
  theme: ResolvedTheme;
  rings: RingGeom[];
  /** Fovea centre in metres (0, 0 when stationary). */
  shift: { x: number; y: number };
  /** Draw the shifted fovea outline (a preset is active). */
  showOutline: boolean;
  guides: boolean;
  selected: GridCellData | null;
  groundZ: number;
  /** Restrict everything to screen x in [x0, x1): one pane of a side-by-side view. */
  pane?: { x0: number; x1: number } | null;
  /** Extra drawing after the cells and before the range rings (the underpass costmaps and path). */
  overlay?: ((ctx: CanvasRenderingContext2D, proj: Projection) => void) | null;
}

export function cellFillFn(colorBy: InspectorColorBy, theme: ResolvedTheme, rings: RingGeom[]): (c: GridCellData) => string {
  const ringColors = rings.map((r) => readToken(`--scene-ring-${r.id}`));
  const fallback = readToken('--fg-muted');
  const semCache = new Map<number, string>();
  const overhangOn = overhangCss(true, theme);
  const overhangOff = overhangCss(false, theme);
  switch (colorBy) {
    case 'ring':
      return (c) => ringColors[c.ring_id] ?? fallback;
    case 'elevation':
      return (c) => elevationCss(c.mean_z);
    case 'variance':
      return (c) => varianceCss(c.variance);
    case 'overhang':
      return (c) => (c.overhang_z != null ? overhangOn : overhangOff);
    default:
      return (c) => {
        let col = semCache.get(c.sem_id);
        if (!col) {
          col = semanticColor(c.sem_id, theme);
          semCache.set(c.sem_id, col);
        }
        return col;
      };
  }
}

const RING_SEGMENTS = 96;

function ringPath(ctx: CanvasRenderingContext2D, proj: Projection, cx: number, cy: number, r: number, z?: number): void {
  for (let i = 0; i <= RING_SEGMENTS; i++) {
    const a = (i / RING_SEGMENTS) * Math.PI * 2;
    const p = proj.project(cx + r * Math.cos(a), cy + r * Math.sin(a), z);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
}

export function drawInspector(p: DrawParams): void {
  const { ctx, w, h, proj, layers, colorBy, theme, rings, shift, showOutline, guides, selected, groundZ, pane, overlay } = p;
  const iso = proj.mode === 'iso';
  const zoom = proj.zoom;

  const bg = readToken('--scene-bg');
  const gridColor = readToken('--scene-grid-minor');
  const egoColor = readToken('--scene-ego');
  const selColor = readToken('--scene-selection');
  const guideColor = readToken('--scene-guide');
  const overhangTint = readToken('--scene-overhang');
  const ringColors = rings.map((r) => readToken(`--scene-ring-${r.id}`));
  const fill = cellFillFn(colorBy, theme, rings);

  if (pane) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(pane.x0, 0, pane.x1 - pane.x0, h);
    ctx.clip();
  }

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Metric ground grid every 10 m, as lines on the ground plane.
  ctx.lineWidth = 1;
  ctx.strokeStyle = gridColor;
  ctx.beginPath();
  if (iso) {
    const ext = 110;
    for (let g = -ext; g <= ext; g += 10) {
      const a = proj.project(g, -ext);
      const b = proj.project(g, ext);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      const c = proj.project(-ext, g);
      const d = proj.project(ext, g);
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
    }
  } else {
    const o = proj.project(0, 0);
    const step = 10 * zoom;
    for (let x = (((o.x % step) + step) % step) - step; x < w + step; x += step) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, h);
    }
    for (let y = (((o.y % step) + step) % step) - step; y < h + step; y += step) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(w, Math.round(y) + 0.5);
    }
  }
  ctx.stroke();

  // Cells
  for (const layer of layers) {
    ctx.save();
    if (layer.clipX) {
      ctx.beginPath();
      ctx.rect(layer.clipX[0], 0, layer.clipX[1] - layer.clipX[0], h);
      ctx.clip();
    }
    for (const cell of layer.cells) {
      ctx.fillStyle = fill(cell);
      if (!iso) {
        const c = proj.project(cell.x_m, cell.y_m);
        const px = Math.max(2, cell.res_m * zoom);
        if (c.x < -px || c.y < -px || c.x > w + px || c.y > h + px) continue;
        ctx.fillRect(c.x - px / 2, c.y - px / 2, px, px);
        continue;
      }
      const c = proj.project(cell.x_m, cell.y_m, cell.mean_z);
      const px = cell.res_m * zoom;
      if (c.x < -px * 2 || c.y < -px * 2 || c.x > w + px * 2 || c.y > h + px * 2) continue;
      if (px < 3) {
        ctx.fillRect(c.x - 1.25, c.y - 1.25, 2.5, 2.5);
      } else {
        const q = cellCorners(proj, cell.x_m, cell.y_m, cell.res_m * 0.96, cell.mean_z);
        ctx.beginPath();
        ctx.moveTo(q[0].x, q[0].y);
        ctx.lineTo(q[1].x, q[1].y);
        ctx.lineTo(q[2].x, q[2].y);
        ctx.lineTo(q[3].x, q[3].y);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Overhang canopies: the recorded deck above the road, at its real height (isometric view only).
    if (iso) {
      ctx.fillStyle = overhangTint;
      ctx.strokeStyle = overhangTint;
      ctx.lineWidth = 1;
      for (const cell of layer.cells) {
        if (cell.overhang_z == null) continue;
        const top = proj.project(cell.x_m, cell.y_m, cell.overhang_z);
        if (top.x < -20 || top.y < -20 || top.x > w + 20 || top.y > h + 20) continue;
        const base = proj.project(cell.x_m, cell.y_m, cell.mean_z);
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.stroke();
        ctx.globalAlpha = 0.5;
        const px = Math.max(2.5, cell.res_m * zoom);
        if (px < 3.5) ctx.fillRect(top.x - px / 2, top.y - px / 2, px, px);
        else {
          const q = cellCorners(proj, cell.x_m, cell.y_m, cell.res_m * 0.96, cell.overhang_z);
          ctx.beginPath();
          ctx.moveTo(q[0].x, q[0].y);
          ctx.lineTo(q[1].x, q[1].y);
          ctx.lineTo(q[2].x, q[2].y);
          ctx.lineTo(q[3].x, q[3].y);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  overlay?.(ctx, proj);

  // Range rings, always centred on the vehicle. Faint when a shifted fovea outline is also drawn.
  rings.forEach((r, idx) => {
    ctx.beginPath();
    ringPath(ctx, proj, 0, 0, r.radius, groundZ);
    ctx.strokeStyle = ringColors[idx];
    ctx.globalAlpha = showOutline ? 0.3 : 1;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  });

  // Fovea outline: where each ring really sits for this preset (centred on the shift).
  if (showOutline) {
    rings.forEach((r, idx) => {
      if (idx === rings.length - 1) return; // the outermost boundary is the sensor range, not a fovea edge
      ctx.beginPath();
      ringPath(ctx, proj, shift.x, shift.y, r.radius, groundZ);
      if (idx === 0) {
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = ringColors[0];
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = ringColors[idx];
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  // Guides: ring labels, forward / left axes
  if (guides) {
    ctx.font = '10px "JetBrains Mono Variable", monospace';
    ctx.textBaseline = 'alphabetic';
    rings.forEach((r, idx) => {
      const at = proj.project(0, -r.radius, groundZ);
      ctx.fillStyle = ringColors[idx];
      ctx.fillText(`${r.radius} m`, at.x + 4, at.y - 4);
    });
    ctx.strokeStyle = guideColor;
    ctx.fillStyle = guideColor;
    ctx.lineWidth = 1.25;
    const axisLen = 8;
    const fwd = proj.project(axisLen, 0, groundZ);
    const left = proj.project(0, axisLen, groundZ);
    const o = proj.project(0, 0, groundZ);
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(fwd.x, fwd.y);
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(left.x, left.y);
    ctx.stroke();
    ctx.fillText('FORWARD', fwd.x + 5, fwd.y - 3);
    ctx.fillText('LEFT', left.x + 5, left.y - 3);
  }

  // Selection outline
  if (selected) {
    ctx.strokeStyle = selColor;
    ctx.lineWidth = 2;
    if (iso) {
      const q = cellCorners(proj, selected.x_m, selected.y_m, Math.max(selected.res_m, 6 / zoom) * 1.3, selected.mean_z);
      ctx.beginPath();
      ctx.moveTo(q[0].x, q[0].y);
      ctx.lineTo(q[1].x, q[1].y);
      ctx.lineTo(q[2].x, q[2].y);
      ctx.lineTo(q[3].x, q[3].y);
      ctx.closePath();
      ctx.stroke();
    } else {
      const c = proj.project(selected.x_m, selected.y_m);
      const px = Math.max(2, selected.res_m * zoom);
      ctx.strokeRect(c.x - px / 2 - 2, c.y - px / 2 - 2, px + 4, px + 4);
    }
  }

  // Ego marker + heading
  const ego = proj.project(0, 0, groundZ);
  const head = proj.project(3, 0, groundZ);
  ctx.fillStyle = egoColor;
  ctx.beginPath();
  ctx.arc(ego.x, ego.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = bg;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ego.x, ego.y);
  if (iso) ctx.lineTo(head.x, head.y);
  else ctx.lineTo(ego.x, ego.y - 10);
  ctx.strokeStyle = egoColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  if (pane) ctx.restore();
}
