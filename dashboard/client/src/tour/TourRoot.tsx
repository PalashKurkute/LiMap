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

export type TourExit = 'done' | 'exit' | 'error';

interface TourProps {
  startAt: number;
  onExit: (reason: TourExit) => void;
}

const PAD = 6; // spotlight padding around the anchor, px

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

const Tour: React.FC<TourProps> = ({ startAt, onExit }) => {
  const actions = useAppActions();
  const { scene, sceneData } = useAppData();

  const [index, setIndex] = useState(() => Math.min(Math.max(startAt, 0), STEPS.length - 1));
  const [started, setStarted] = useState(false);
  // A step is "ready" only for the index it was readied for, so the commit that changes `index` can never show the
  // new step's text over the previous step's spotlight.
  const [readyIndex, setReadyIndex] = useState(-1);
  const phase: 'entering' | 'ready' = readyIndex === index ? 'ready' : 'entering';
  const [rect, setRect] = useState<Rect | null>(null);
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
    setRect(null);
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
      setReadyIndex(index);
      writeProgress({ lastStep: index, total: STEPS.length, done: false });
    })();

    return () => {
      cancelled = true;
    };
  }, [index, started]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- keep the spotlight on its anchor (it can move: scrolling, resizing, the drawer opening) ----
  useEffect(() => {
    if (phase !== 'ready') return;
    let raf = 0;
    const tick = () => {
      let el = anchorRef.current;
      if ((!el || !el.isConnected) && step.anchor) {
        el = document.querySelector(step.anchor);
        anchorRef.current = el;
      }
      if (el) {
        const r = el.getBoundingClientRect();
        const next = r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
        setRect((prev) =>
          prev &&
          next &&
          Math.abs(prev.left - next.left) < 0.5 &&
          Math.abs(prev.top - next.top) < 0.5 &&
          Math.abs(prev.width - next.width) < 0.5 &&
          Math.abs(prev.height - next.height) < 0.5
            ? prev
            : next,
        );
      } else setRect(null);
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
  const hole: Rect | null =
    phase === 'ready' && rect ? { left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 } : null;
  const pos = placePopover(hole, popSize, vp, step.placement ?? 'auto');
  const last = index === STEPS.length - 1;
  const reduced = prefersReducedMotion();
  const body = phase === 'ready' ? step.body(data) : 'Getting ready…';

  const blocker = (r: Rect, key: string) => (
    <div
      key={key}
      aria-hidden="true"
      className="fixed pointer-events-auto"
      style={{ left: r.left, top: r.top, width: Math.max(0, r.width), height: Math.max(0, r.height) }}
    />
  );

  return createPortal(
    <div data-region="tour" data-tour-step={step.id} data-tour-phase={phase} data-tour-index={index} className="fixed inset-0 z-[70] pointer-events-none">
      {hole ? (
        <>
          <div
            aria-hidden="true"
            data-region="tour-spotlight"
            className="fixed rounded-xl pointer-events-none"
            style={{
              left: hole.left,
              top: hole.top,
              width: hole.width,
              height: hole.height,
              boxShadow: '0 0 0 9999px var(--overlay)',
              outline: '2px solid var(--focus)',
              transition: reduced ? undefined : 'left 160ms ease, top 160ms ease, width 160ms ease, height 160ms ease',
            }}
          />
          {step.interactive ? (
            <>
              {blocker({ left: 0, top: 0, width: vp.w, height: hole.top }, 'top')}
              {blocker({ left: 0, top: hole.top + hole.height, width: vp.w, height: vp.h - (hole.top + hole.height) }, 'bottom')}
              {blocker({ left: 0, top: hole.top, width: hole.left, height: hole.height }, 'left')}
              {blocker({ left: hole.left + hole.width, top: hole.top, width: vp.w - (hole.left + hole.width), height: hole.height }, 'right')}
            </>
          ) : (
            <div aria-hidden="true" className="fixed inset-0 pointer-events-auto" />
          )}
        </>
      ) : (
        <div aria-hidden="true" className="fixed inset-0 bg-overlay pointer-events-auto" />
      )}

      <div
        ref={popRef}
        role="dialog"
        aria-modal="false"
        aria-label={`Tour: ${step.title}`}
        data-region="tour-popover"
        className="fixed w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-line-strong bg-panel p-4 text-fg shadow-xl pointer-events-auto"
        style={{ left: pos.left, top: pos.top }}
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
