/**
 * The only tour code that ships in the main bundle: the header button, the first-visit callout and the lazy
 * loader. The tour itself (./TourRoot) is fetched when it is started. Starting it with `?tour=1` works too; the
 * flag is removed from the URL straight away so a reload or a shared link does not restart it.
 */
import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Compass, X } from 'lucide-react';
import { hasSeenIntro, markIntroSeen, readProgress, type TourProgress } from './storage';

const TourRoot = lazy(() => import('./TourRoot'));

interface TourLauncherProps {
  /** Show the first-visit callout (only on a view where the corner is free). */
  showNudge: boolean;
}

export const TourLauncher: React.FC<TourLauncherProps> = ({ showNudge }) => {
  const [active, setActive] = useState(false);
  const [startAt, setStartAt] = useState(0);
  const [progress, setProgress] = useState<TourProgress | null>(() => readProgress());
  const [introSeen, setIntroSeen] = useState(() => hasSeenIntro());
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const start = useCallback((from = 0) => {
    markIntroSeen();
    setIntroSeen(true);
    setMenuOpen(false);
    setStartAt(from);
    setActive(true);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('tour') !== '1') return;
    url.searchParams.delete('tour');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    start(0);
  }, [start]);

  const onExit = useCallback(() => {
    setActive(false);
    setProgress(readProgress());
    requestAnimationFrame(() => buttonRef.current?.focus());
  }, []);

  const resumable = !!progress && !progress.done && progress.lastStep > 0;

  return (
    <>
      <div className="relative">
        <button
          ref={buttonRef}
          data-tour="tour-button"
          onClick={() => (resumable ? setMenuOpen((o) => !o) : start(0))}
          aria-haspopup={resumable ? 'menu' : undefined}
          aria-expanded={resumable ? menuOpen : undefined}
          title="A guided tour of every feature"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent/90 text-accent-on text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95 whitespace-nowrap"
        >
          <Compass size={14} aria-hidden="true" />
          <span className="hidden lg:inline">{resumable ? 'Resume tour' : 'Take the tour'}</span>
          <span className="lg:hidden sr-only">Take the tour</span>
        </button>

        {menuOpen && resumable && progress && (
          <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-line-strong bg-panel p-1.5 shadow-xl">
            <button
              role="menuitem"
              onClick={() => start(progress.lastStep)}
              className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-fg hover:bg-subtle"
            >
              Resume at step {progress.lastStep + 1}
              {progress.total ? ` of ${progress.total}` : ''}
            </button>
            <button role="menuitem" onClick={() => start(0)} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-fg-2 hover:bg-subtle">
              Start over
            </button>
          </div>
        )}
      </div>

      {showNudge && !introSeen && !active && (
        <div
          role="region"
          aria-label="Take the tour"
          data-region="tour-nudge"
          className="fixed right-4 top-[3.75rem] z-40 w-72 rounded-xl border border-accent-line bg-panel p-4 text-fg shadow-xl"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold tracking-tight">New here?</div>
              <p className="mt-1 text-xs leading-relaxed text-fg-2">A short tour of every feature, one click at a time. You can leave it whenever you like.</p>
            </div>
            <button
              onClick={() => {
                markIntroSeen();
                setIntroSeen(true);
              }}
              aria-label="Dismiss"
              className="rounded p-1 text-fg-muted hover:bg-subtle hover:text-fg"
            >
              <X size={14} />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => start(0)} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-on shadow-sm hover:bg-accent/90">
              Take the tour
            </button>
            <button
              onClick={() => {
                markIntroSeen();
                setIntroSeen(true);
              }}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-fg-2 hover:bg-subtle"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {active && (
        <Suspense fallback={null}>
          <TourRoot startAt={startAt} onExit={onExit} />
        </Suspense>
      )}
    </>
  );
};
