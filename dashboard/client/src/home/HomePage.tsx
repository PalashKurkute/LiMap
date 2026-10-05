/**
 * The home screen: shown at `/` before the dashboard (which lives at `/dashboard/`). It imports nothing from the dashboard,
 * so it loads fast, and it carries no figures: every number in the product is on the dashboard, read from data.
 */
import React from 'react';
import { ArrowRight, Compass, Moon, Sun } from 'lucide-react';
import LogoMark from '../brand/LogoMark';
import { toggleTheme, useTheme } from '../theme/theme';

/**
 * Resolution rings spreading from the mark like ripples on water: fine spacing near the centre, coarse far away. The drawing is
 * centred on the mark at the top of the page (the SVG scales to fill the window, which keeps it there), and the inner dashed
 * ring frames the mark.
 */
const RINGS = [60, 125, 190, 275, 390, 540, 740];

const Backdrop: React.FC = () => (
  <svg aria-hidden="true" viewBox="-600 -400 1200 800" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full">
    {RINGS.map((r, i) => (
      <circle key={r} cx={0} cy={-250} r={r} fill="none" strokeWidth={1.5} strokeDasharray={i === 0 ? '6 8' : undefined} style={{ stroke: i === 0 ? 'var(--accent)' : 'var(--line)', opacity: i === 0 ? 0.7 : 1 }} />
    ))}
  </svg>
);

const HomePage: React.FC = () => {
  const { theme } = useTheme();
  const team = theme === 'dark' ? '/brand/team-abhedya-dark.png' : '/brand/team-abhedya-light.png';

  return (
    // The page body does not scroll (the dashboard fills the window), so this screen scrolls inside itself on small windows.
    <div data-region="home" className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-app text-fg">
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <LogoMark size={28} />
          <span className="text-sm font-bold tracking-tight">LiMap</span>
          <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent-on">2.5D</span>
        </div>
        <button
          onClick={toggleTheme}
          aria-pressed={theme === 'dark'}
          aria-label={theme === 'dark' ? 'Dark theme (switch to light)' : 'Light theme (switch to dark)'}
          title="Toggle light / dark theme"
          className="rounded-lg border border-line-strong bg-subtle p-2 text-fg-2 transition-colors hover:bg-line hover:text-fg"
        >
          {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
        </button>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-10 pt-2 text-center">
        <Backdrop />
        <div className="relative flex max-w-2xl flex-col items-center gap-5">
          <LogoMark size={120} title="LiMap logo" />
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">LiMap</h1>
          <p className="text-sm font-semibold uppercase tracking-widest text-accent-text">Adaptive variable-resolution 2.5D LiDAR mapping</p>
          <p className="text-[15px] leading-relaxed text-fg-2">
            LiMap turns a LiDAR scan into a 2.5D grid that keeps fine cells near the vehicle and coarse cells far away, held in a
            fixed-size memory pool. Each cell remembers the height of the ground and of anything overhead, so a planner can tell an
            underpass from a wall, and moving objects are filtered out so they leave no ghost trails. It was built for problem
            statement SIH26053 (DRDO) on mapping dynamic environments for an unmanned ground vehicle, and every figure in the
            dashboard is read from data, never typed in.
          </p>

          <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/dashboard/"
              className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-on shadow-sm transition-colors hover:bg-accent/90"
            >
              <span>Open the dashboard</span>
              <ArrowRight size={16} aria-hidden="true" />
            </a>
            <a
              href="/dashboard/?tour=1"
              className="flex items-center gap-2 rounded-xl border border-line-strong bg-panel px-5 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-subtle"
            >
              <Compass size={16} aria-hidden="true" />
              <span>Take the guided tour</span>
            </a>
          </div>
        </div>

        <section aria-label="Built by" className="relative mt-12 flex flex-col items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-fg-muted">Built by</span>
          <img
            src={team}
            alt="Team Abhedya logo"
            width={160}
            className="h-auto w-40 rounded-2xl border border-line shadow-sm"
          />
        </section>
      </main>

      <footer className="relative z-10 px-6 py-4 text-center text-[11px] text-fg-muted">
        Team Abhedya &middot; SIH26053 &middot; Ministry of Defence / DRDO
      </footer>
    </div>
  );
};

export default HomePage;
