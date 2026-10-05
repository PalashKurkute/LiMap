/**
 * The guided tour: a spotlight on the real UI plus a popover, advanced ONLY by the user (Next / Back / arrow keys).
 * Loaded lazily; the rest of the app never imports this file and works identically without it.
 *
 * What it must not do: change app state any way a user could not (it only calls the app's public actions through
 * ./ensure), persist anything but its own progress key, or leave the app changed. On every exit path (Exit, Esc,
 * Finish, a crash) it pops its keyboard scope and restores the exact state captured when it started.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';
import { useAppActions, useAppData, type AppSnapshot } from '../state/AppActions';
import { popScope, pushScope } from '../lib/keyScope';
import { prefersReducedMotion } from '../lib/motion';
import { computeGroundZ } from '../data/pipeline';
import { placePopover, type Rect } from '../ui/placement';
import { pickShowcaseCell } from './showcase';
import { STEPS, type TourData } from './steps';
import { frames, resetToStart } from './ensure';
import { writeProgress } from './storage';
import { useGlide, type Shown } from './useGlide';

export type TourExit = 'done' | 'exit' | 'error';

interface TourProps {
  startAt: number;
  onExit: (reason: TourExit) => void;
}

const PAD = 6; // spotlight padding around the anchor, px
const RADIUS = 12; // spotlight corner radius, px (matches rounded-xl)

async function waitForElement(selector: string, ms: number, cancelled: () => boolean): Promise<Element | null> {
  const t0 = performance.now();
  while (performance.now() - t0 < ms && !cancelled()) {
    const el = document.querySelector(selector);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
    await frames(2);
  }
  return null;
}

/** The on-screen rectangle of an element, or null when it is missing or not shown. */
function rectOf(el: Element | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
}

/** The step's own anchor first, then its secondary anchors that are on screen. Anything missing is skipped. */
function measure(primary: Element | null, also: string[] | undefined): Rect[] {
  return [rectOf(primary), ...(also ?? []).map((sel) => rectOf(document.querySelector(sel)))].filter((r): r is Rect => r !== null);
}

const sameRects = (a: Rect[], b: Rect[]) =>
  a.length === b.length &&
  a.every(
    (r, i) =>
      Math.abs(r.left - b[i].left) < 0.5 && Math.abs(r.top - b[i].top) < 0.5 && Math.abs(r.width - b[i].width) < 0.5 && Math.abs(r.height - b[i].height) < 0.5,
  );

/** The dimmed layer: the whole screen with one rounded hole per spotlight (even-odd fill). */
function dimPath(vp: { w: number; h: number }, holes: Rect[]): string {
  let d = `M0 0H${vp.w}V${vp.h}H0Z`;
  for (const h of holes) {
    const r = Math.max(0, Math.min(RADIUS, h.width / 2, h.height / 2));
    const x2 = h.left + h.width;
    const y2 = h.top + h.height;
    d += `M${h.left + r} ${h.top}H${x2 - r}A${r} ${r} 0 0 1 ${x2} ${h.top + r}V${y2 - r}A${r} ${r} 0 0 1 ${x2 - r} ${y2}H${h.left + r}A${r} ${r} 0 0 1 ${h.left} ${y2 - r}V${h.top + r}A${r} ${r} 0 0 1 ${h.left + r} ${h.top}Z`;
  }
  return d;
}

const Tour: React.FC<TourProps> = ({ startAt, onExit }) => {
  const actions = useAppActions();
  const { scene, sceneData } = useAppData();

  const [index, setIndex] = useState(() => Math.min(Math.max(startAt, 0), STEPS.length - 1));
  const [started, setStarted] = useState(false);
  // A step is "ready" only for the index it was readied for, so the commit that changes `index` can never show the
  // new step's text over the previous step's spotlight.
  const [readyIndex, setReadyIndex] = useState(-1);
  const phase: 'entering' | 'ready' = readyIndex === index ? 'ready' : 'entering';
  const [rects, setRects] = useState<Rect[]>([]);
  const [popSize, setPopSize] = useState({ w: 320, h: 220 });
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });

  const dirRef = useRef<1 | -1>(1);
  const anchorRef = useRef<Element | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);
  const snapshotRef = useRef<AppSnapshot | null>(null);
  const exitedRef = useRef(false);
  const indexRef = useRef(index);
  const phaseRef = useRef(phase);

  const step = STEPS[index];
  const data = useMemo<TourData>(
    () => ({
      scene,
      sceneData,
      cell: sceneData ? pickShowcaseCell(scene, sceneData.cells, computeGroundZ(sceneData.cells)) : null,
    }),
    [scene, sceneData],
  );
  const dataRef = useRef(data);
  useLayoutEffect(() => {
    dataRef.current = data;
    indexRef.current = index;
    phaseRef.current = phase;
  });

  const finish = useCallback(
    (reason: TourExit) => {
      if (exitedRef.current) return;
      exitedRef.current = true;
      writeProgress(
        reason === 'done'
          ? { lastStep: 0, total: STEPS.length, done: true }
          : { lastStep: indexRef.current, total: STEPS.length, done: false },
      );
      onExit(reason);
    },
    [onExit],
  );

  // ---- lifecycle: take the keyboard, remember the app's state, start from a known state; undo all of it on exit ----
  useEffect(() => {
    pushScope('tour');
    snapshotRef.current = actions.getSnapshot();
    let live = true;
    resetToStart(actions)
      .catch((e) => console.warn('tour: could not reset to the start state', e))
      .finally(() => live && setStarted(true));
    return () => {
      live = false;
      popScope('tour');
      const s = snapshotRef.current;
      if (s) actions.restore(s);
    };
  }, [actions]);

  // ---- enter the current step ----
  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    setReadyIndex(-1);
    anchorRef.current = null;

    const advance = (to: number) => {
      if (to >= STEPS.length) finish('done');
      else setIndex(Math.max(0, to));
    };

    (async () => {
      try {
        await step.enter?.({ actions, getData: () => dataRef.current });
      } catch (e) {
        console.warn('tour: step failed, showing it anyway', step.id, e);
      }
      if (cancelled) return;
      let el: Element | null = null;
      if (step.anchor) {
        el = await waitForElement(step.anchor, 6000, () => cancelled);
        if (cancelled) return;
        if (!el) {
          console.warn('tour: anchor not found', step.id, step.anchor);
          if (step.optional) {
            advance(index + dirRef.current);
            return;
          }
        } else {
          (el as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
          await frames(2);
        }
      }
      if (cancelled) return;
      anchorRef.current = el;
      // Measured in the same update that marks the step ready, so the first ready frame already has the right spotlight.
      setRects(measure(el, step.also));
      setReadyIndex(index);
      writeProgress({ lastStep: index, total: STEPS.length, done: false });
    })();

    return () => {
      cancelled = true;
    };
  }, [index, started]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- keep the spotlights on their anchors (they can move: scrolling, resizing, the drawer opening) ----
  useEffect(() => {
    if (phase !== 'ready') return;
    let raf = 0;
    const tick = () => {
      let el = anchorRef.current;
      if ((!el || !el.isConnected) && step.anchor) {
        el = document.querySelector(step.anchor);
        anchorRef.current = el;
      }
      const next = measure(el, step.also);
      setRects((prev) => (sameRects(prev, next) ? prev : next));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [phase, step]);

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useLayoutEffect(() => {
    const r = popRef.current?.getBoundingClientRect();
    if (r && (Math.abs(r.width - popSize.w) > 1 || Math.abs(r.height - popSize.h) > 1)) setPopSize({ w: r.width, h: r.height });
  });

  useEffect(() => {
    if (phase === 'ready') nextRef.current?.focus({ preventScroll: true });
  }, [phase, index]);

  // ---- navigation (always user-initiated) ----
  const next = useCallback(() => {
    if (phaseRef.current !== 'ready') return;
    dirRef.current = 1;
    if (indexRef.current >= STEPS.length - 1) finish('done');
    else setIndex(indexRef.current + 1);
  }, [finish]);
  const back = useCallback(() => {
    if (phaseRef.current !== 'ready' || indexRef.current === 0) return;
    dirRef.current = -1;
    setIndex(indexRef.current - 1);
  }, []);
  const replay = () => {
    dirRef.current = 1;
    setIndex(0);
  };

  // Keys: captured before the app sees them. Left/Right step, Esc exits. Enter/Space press the focused button natively.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish('exit');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        back();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [finish, next, back]);

  // ---- render ----
  const reduced = prefersReducedMotion();
  const holes: Rect[] = rects.map((r) => ({ left: r.left - PAD, top: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }));
  // The popover and spotlights that are shown. While a step is getting ready this keeps the previous step's, so nothing
  // jumps to the middle of the screen and back; `target` is null until the new step is ready.
  const pos = placePopover(holes[0] ?? null, popSize, vp, step.placement ?? 'auto', undefined, undefined, step.align);
  const target: Shown | null = phase === 'ready' ? { holes, pos: { left: pos.left, top: pos.top } } : null;
  const shown = useGlide(target, !reduced);
  const centre = placePopover(null, popSize, vp);
  const display: Shown = shown ?? { holes: [], pos: { left: centre.left, top: centre.top } };
  const live = phase === 'ready' && !!step.interactive && display.holes.length > 0;

  const last = index === STEPS.length - 1;
  const body = phase === 'ready' ? step.body(data) : 'Getting ready…';

  return createPortal(
    <div data-region="tour" data-tour-step={step.id} data-tour-phase={phase} data-tour-index={index} className="fixed inset-0 z-[70] pointer-events-none">
      {/* The dimmed screen with a hole for each spotlight. Only the dimmed part takes clicks, so holes stay usable. */}
      <svg aria-hidden="true" width={vp.w} height={vp.h} className="fixed inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
        <path d={dimPath(vp, display.holes)} fillRule="evenodd" style={{ fill: 'var(--overlay)', pointerEvents: live ? 'auto' : 'none' }} />
      </svg>
      {!live && <div aria-hidden="true" className="fixed inset-0 pointer-events-auto" />}
      {/* Movement is driven by useGlide, so no CSS transition (even the near-zero one the reduced-motion rule leaves) may delay it. */}
      {display.holes.map((h, i) => (
        <div
          key={i}
          aria-hidden="true"
          data-region={i === 0 ? 'tour-spotlight' : 'tour-spotlight-extra'}
          className="fixed rounded-xl pointer-events-none"
          style={{ left: h.left, top: h.top, width: h.width, height: h.height, outline: '2px solid var(--focus)', transition: 'none' }}
        />
      ))}

      <div
        ref={popRef}
        role="dialog"
        aria-modal="false"
        aria-label={`Tour: ${step.title}`}
        data-region="tour-popover"
        className="fixed w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-line-strong bg-panel p-4 text-fg shadow-xl pointer-events-auto"
        style={{ left: display.pos.left, top: display.pos.top, transition: 'none' }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-fg-muted">
            Step {index + 1} of {STEPS.length}
          </span>
          <button
            onClick={() => finish('exit')}
            aria-label="Exit tour"
            title="Exit tour (Esc)"
            className="rounded p-1 text-fg-muted transition-colors hover:bg-subtle hover:text-fg"
          >
            <X size={14} />
          </button>
        </div>

        <h2 className="mt-1 text-sm font-bold tracking-tight text-fg">{step.title}</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-fg-2">{body}</p>

        <div className="mt-3 h-1 rounded bg-line" aria-hidden="true">
          <div className="h-1 rounded bg-accent transition-[width]" style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            onClick={back}
            disabled={index === 0 || phase !== 'ready'}
            className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-fg-2 transition-colors hover:bg-subtle disabled:opacity-40"
          >
            <ChevronLeft size={13} aria-hidden="true" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            {last && (
              <button
                onClick={replay}
                className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-fg-2 transition-colors hover:bg-subtle"
              >
                <RotateCcw size={12} aria-hidden="true" />
                <span>Replay</span>
              </button>
            )}
            <button
              ref={nextRef}
              onClick={next}
              disabled={phase !== 'ready'}
              className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-on shadow-sm transition-all hover:bg-accent/90 disabled:opacity-60"
            >
              <span>{last ? 'Finish' : 'Next'}</span>
              {!last && <ChevronRight size={13} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      <div className="sr-only" aria-live="polite">
        {phase === 'ready' ? `Step ${index + 1} of ${STEPS.length}: ${step.title}. ${body}` : ''}
      </div>
    </div>,
    document.body,
  );
};

/** A crash inside the tour must never take the app down: exit the tour (which restores the app) and carry on. */
class TourBoundary extends React.Component<{ onError: () => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('tour crashed; exiting it and restoring the app', error);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const TourRoot: React.FC<TourProps> = (props) => (
  <TourBoundary onError={() => props.onExit('error')}>
    <Tour {...props} />
  </TourBoundary>
);

export default TourRoot;
