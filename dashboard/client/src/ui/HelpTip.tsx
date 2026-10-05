/**
 * A small "?" next to a tool or feature group. Hover it (or focus it with the keyboard, or tap it) to read what the thing is for,
 * without taking the tour. The words live in src/help/topics.ts.
 *
 * It follows the usual tooltip rules: it opens on hover (after a short delay) and on focus, can be moved onto without
 * closing, closes on Esc, on leaving, and on a click elsewhere, and is linked to its button for screen readers.
 */
import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp } from 'lucide-react';
import { HELP, type HelpId } from '../help/topics';

type Side = 'top' | 'bottom' | 'left' | 'right';

const WIDTH = 256; // matches w-64
const GAP = 8;
const MARGIN = 8;
const EST_HEIGHT = 130; // used only to decide whether a tip fits below or above its button

interface Anchor {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Fixed position for the tooltip: next to the button, flipped when there is no room, kept inside the window. */
function place(a: Anchor, side: Side, vw: number, vh: number): React.CSSProperties {
  let s = side;
  if (s === 'bottom' && a.bottom + GAP + EST_HEIGHT > vh) s = 'top';
  else if (s === 'top' && a.top - GAP - EST_HEIGHT < 0) s = 'bottom';
  else if (s === 'right' && a.right + GAP + WIDTH > vw - MARGIN) s = 'left';
  else if (s === 'left' && a.left - GAP - WIDTH < MARGIN) s = 'right';

  const cx = (a.left + a.right) / 2;
  const cy = (a.top + a.bottom) / 2;
  const clampX = (x: number) => Math.min(Math.max(x, MARGIN), Math.max(MARGIN, vw - WIDTH - MARGIN));
  switch (s) {
    case 'top':
      return { left: clampX(cx - WIDTH / 2), top: a.top - GAP, transform: 'translateY(-100%)' };
    case 'left':
      return { left: a.left - GAP, top: cy, transform: 'translate(-100%, -50%)' };
    case 'right':
      return { left: a.right + GAP, top: cy, transform: 'translateY(-50%)' };
    default:
      return { left: clampX(cx - WIDTH / 2), top: a.bottom + GAP };
  }
}

interface HelpTipProps {
  topic: HelpId;
  /** Which side of the "?" the tip prefers (it flips when there is no room). */
  side?: Side;
  className?: string;
}

export const HelpTip: React.FC<HelpTipProps> = ({ topic, side = 'bottom', className = '' }) => {
  const { title, text } = HELP[topic];
  const tipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const open = hover || focus || pinned;

  const measure = () => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (r) setAnchor({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  };
  const later = (fn: () => void, ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };

  // While open: Esc closes just this tip, a click elsewhere unpins it, and it follows its button if the page moves.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setHover(false);
      setFocus(false);
      setPinned(false);
      buttonRef.current?.blur();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || tipRef.current?.contains(t)) return;
      setPinned(false);
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-help={topic}
        aria-label={`About ${title}`}
        aria-describedby={open ? tipId : undefined}
        onPointerEnter={() => {
          measure();
          later(() => setHover(true), 180);
        }}
        onPointerLeave={() => later(() => setHover(false), 120)}
        onFocus={() => {
          measure();
          setFocus(true);
        }}
        onBlur={() => setFocus(false)}
        onClick={() => {
          measure();
          setPinned((p) => !p);
        }}
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors hover:text-accent-text ${className}`}
      >
        <CircleHelp size={14} aria-hidden="true" />
      </button>
      {open &&
        anchor &&
        createPortal(
          <div
            ref={tipRef}
            id={tipId}
            role="tooltip"
            data-region="help-tooltip"
            data-help-for={topic}
            onPointerEnter={() => clearTimeout(timer.current)}
            onPointerLeave={() => later(() => setHover(false), 120)}
            className="fixed z-[80] w-64 rounded-lg border border-line-strong bg-elevated p-3 text-left text-xs normal-case tracking-normal text-fg shadow-xl"
            style={place(anchor, side, window.innerWidth, window.innerHeight)}
          >
            <div className="font-bold">{title}</div>
            <p className="mt-1 font-sans font-normal leading-relaxed text-fg-2">{text}</p>
          </div>,
          document.body,
        )}
    </>
  );
};
