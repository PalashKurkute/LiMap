/**
 * Smooth movement for the tour's spotlight and popover.
 *
 * While a step is getting ready there is no target, so whatever was shown last stays exactly where it is (the popover never
 * detours through the middle of the screen). When the next step is ready the shown value glides to it, or jumps there at
 * once when the user asks for reduced motion.
 */
import { useEffect, useState } from 'react';
import type { Rect } from '../ui/placement';

export interface Shown {
  /** The spotlight holes, the step's own anchor first. */
  holes: Rect[];
  /** Where the popover sits. */
  pos: { left: number; top: number };
}

export const GLIDE_MS = 180;

const mix = (a: number, b: number, e: number) => a + (b - a) * e;

/** Pure: the value `e` (0 to 1, already eased) of the way from `from` to `to`. Holes with no counterpart appear in place. */
export function lerpShown(from: Shown, to: Shown, e: number): Shown {
  return {
    holes: to.holes.map((h, i) => {
      const f = from.holes[i] ?? h;
      return { left: mix(f.left, h.left, e), top: mix(f.top, h.top, e), width: mix(f.width, h.width, e), height: mix(f.height, h.height, e) };
    }),
    pos: { left: mix(from.pos.left, to.pos.left, e), top: mix(from.pos.top, to.pos.top, e) },
  };
}

const keyOf = (s: Shown) =>
  [...s.holes.flatMap((h) => [h.left, h.top, h.width, h.height]), s.pos.left, s.pos.top].map((n) => Math.round(n * 2)).join(',');

/** `target` is null while a step is getting ready. Returns what to draw now (null before anything has been shown). */
export function useGlide(target: Shown | null, animate: boolean): Shown | null {
  const [shown, setShown] = useState<Shown | null>(null); // the last value that settled
  const [frame, setFrame] = useState<Shown | null>(null); // the value in flight, while gliding
  const [seen, setSeen] = useState('');
  const key = target ? keyOf(target) : '';

  // When the target changes: settle on it at once (no motion, or nothing shown yet); otherwise the effect below glides.
  if (key !== seen) {
    setSeen(key);
    if (target && (!animate || !shown)) setShown(target);
  }

  useEffect(() => {
    if (!target || !animate) return;
    const from = frame ?? shown;
    if (!from || keyOf(from) === key) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / GLIDE_MS);
      if (u >= 1) {
        setShown(target);
        setFrame(null);
        return;
      }
      setFrame(lerpShown(from, target, 1 - (1 - u) ** 3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, animate]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!animate) return target ?? shown;
  return frame ?? shown ?? target;
}
