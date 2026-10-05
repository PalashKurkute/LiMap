/**
 * Popover placement next to an anchor rectangle: picks the side with room, clamps to the viewport, and falls back to
 * the bottom or top centre (over the anchor) when no side fits, which happens for large anchors like a whole canvas.
 */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** `corner` is for an anchor that fills the screen (a whole page): the popover sits in the bottom-right corner, out of the way. */
export type Side = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'corner';

/** Where a popover sits along an anchor's side edge: centred on it (default), with its top on the anchor's top, or with its bottom on the anchor's bottom. */
export type Align = 'center' | 'start' | 'end';

export function placePopover(
  anchor: Rect | null,
  size: { w: number; h: number },
  vp: { w: number; h: number },
  prefer: 'auto' | Side = 'auto',
  gap = 14,
  margin = 12,
  align: Align = 'center',
): { left: number; top: number; side: Side } {
  const clampX = (x: number) => Math.min(Math.max(x, margin), Math.max(margin, vp.w - size.w - margin));
  const clampY = (y: number) => Math.min(Math.max(y, margin), Math.max(margin, vp.h - size.h - margin));
  if (!anchor || prefer === 'center') {
    return { left: clampX((vp.w - size.w) / 2), top: clampY((vp.h - size.h) / 2), side: 'center' };
  }

  const right = anchor.left + anchor.width;
  const bottom = anchor.top + anchor.height;
  if (prefer === 'corner') {
    return { left: clampX(vp.w - size.w - margin * 2), top: clampY(vp.h - size.h - margin * 5), side: 'corner' };
  }

  const room: Record<Exclude<Side, 'center' | 'corner'>, number> = {
    right: vp.w - right - margin,
    left: anchor.left - margin,
    bottom: vp.h - bottom - margin,
    top: anchor.top - margin,
  };
  const fits = (s: Exclude<Side, 'center' | 'corner'>) => room[s] >= (s === 'left' || s === 'right' ? size.w : size.h) + gap;

  const nearTop = anchor.top + anchor.height / 2 < vp.h * 0.18;
  const order: Exclude<Side, 'center' | 'corner'>[] =
    prefer !== 'auto'
      ? [prefer, 'right', 'left', 'bottom', 'top']
      : nearTop
        ? ['bottom', 'right', 'left', 'top']
        : ['right', 'left', 'bottom', 'top'];
  const side = order.find(fits);

  const cx = anchor.left + anchor.width / 2;
  const cy = anchor.top + anchor.height / 2;
  // Beside the anchor: centred on it, level with its top ('start', so a short wide anchor does not push the popover over the header), or
  // down at its bottom ('end', so the top of a tall neighbour stays in view).
  const sideTop = clampY(align === 'end' ? bottom - size.h : align === 'start' ? anchor.top : cy - size.h / 2);
  switch (side) {
    case 'right':
      return { left: clampX(right + gap), top: sideTop, side };
    case 'left':
      return { left: clampX(anchor.left - gap - size.w), top: sideTop, side };
    case 'bottom':
      return { left: clampX(cx - size.w / 2), top: clampY(bottom + gap), side };
    case 'top':
      return { left: clampX(cx - size.w / 2), top: clampY(anchor.top - gap - size.h), side };
    default: {
      // Nothing fits (large anchor): sit at the bottom centre, or the top centre when the anchor is in the lower half.
      const low = cy > vp.h / 2;
      return { left: clampX((vp.w - size.w) / 2), top: low ? clampY(margin * 4) : clampY(vp.h - size.h - margin * 2), side: 'center' };
    }
  }
}
