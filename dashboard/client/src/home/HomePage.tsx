/**
 * The home screen: shown at `/` before the dashboard (which lives at `/dashboard/`). It imports nothing from the dashboard,
 * so it loads fast, and it carries no figures: every number in the product is on the dashboard, read from data.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Compass, Moon, Sun } from 'lucide-react';
import LogoMark from '../brand/LogoMark';
import { toggleTheme, useTheme } from '../theme/theme';
import RobotFit from './RobotFit';

const ROBOT_FIT_ID = 'how-it-fits-a-robot';

/** Brings the "How it fits a robot" section into view inside the home scroller; instant under reduced motion. */
function scrollToRobotFit(e: React.MouseEvent<HTMLAnchorElement>) {
  const section = document.getElementById(ROBOT_FIT_ID);
  if (!section) return; // no section to scroll to: let the browser follow the link
  e.preventDefault();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  section.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  section.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
}

/**
 * Resolution rings spreading from the mark like ripples on water: fine spacing near the centre, coarse far away. The rings are
 * centred on the mark itself (measured, so they stay on it at any window size), the inner dashed ring frames the mark, and the
 * outer radii grow with the window as before (units of a 1200 x 800 window).
 */
const RINGS = [125, 190, 275, 390, 540, 740];

const Backdrop: React.FC<{ anchor: React.RefObject<HTMLElement | null> }> = ({ anchor }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [geo, setGeo] = useState<{ x: number; y: number; frame: number; scale: number } | null>(null);

  // A passive effect: it runs after every ref in the page is attached (the mark comes after the backdrop in the tree).
  useEffect(() => {
    const svg = svgRef.current;
    const mark = anchor.current;
    if (!svg || !mark) return;
    const measure = () => {
      const box = svg.getBoundingClientRect();
      const m = (mark.querySelector('img') ?? mark).getBoundingClientRect();
      setGeo({
        x: m.left + m.width / 2 - box.left,
        y: m.top + m.height / 2 - box.top,
        frame: m.width * 0.55, // the drawing is a wide diamond, so this clears its corners with a small margin
        scale: Math.max(box.width / 1200, box.height / 800),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    observer.observe(mark);
    return () => observer.disconnect();
  }, [anchor]);

  const outer = geo ? RINGS.map((r) => r * geo.scale).filter((r) => r > geo.frame + 16) : [];
  return (
    <svg ref={svgRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
      {geo && (
        <>
          <circle cx={geo.x} cy={geo.y} r={geo.frame} fill="none" strokeWidth={1.5} strokeDasharray="6 8" style={{ stroke: 'var(--accent)', opacity: 0.7 }} />
          {outer.map((r) => (
            <circle key={r} cx={geo.x} cy={geo.y} r={r} fill="none" strokeWidth={1.5} style={{ stroke: 'var(--line)' }} />
          ))}
        </>
      )}
    </svg>
  );
};

const HomePage: React.FC = () => {
  const { theme } = useTheme();
  const markRef = useRef<HTMLDivElement>(null);
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

      <main className="relative z-10 flex flex-1 flex-col">
        {/* The first screen: it fills the space between the header and where the footer used to sit, so the hero is placed as before. */}
        <div className="relative flex min-h-[calc(100vh-113.5px)] flex-1 flex-col items-center justify-center px-6 pb-10 pt-2 text-center">
          <Backdrop anchor={markRef} />
          <div className="relative flex max-w-2xl flex-col items-center gap-5">
            {/* The top padding leaves room for the dashed ring above the mark (below, the heading's own spacing is enough). */}
            <div ref={markRef} className="flex pt-8">
              <LogoMark size={120} title="LiMap logo" />
            </div>
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
            <a
              href={`#${ROBOT_FIT_ID}`}
              onClick={scrollToRobotFit}
              className="-mt-1 flex items-center gap-1 rounded text-sm font-medium text-accent-text underline-offset-4 hover:underline"
            >
              <span>How it fits a robot</span>
              <ChevronDown size={15} aria-hidden="true" />
            </a>
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
        </div>

        <RobotFit id={ROBOT_FIT_ID} />
      </main>

      <footer className="relative z-10 px-6 py-4 text-center text-[11px] text-fg-muted">
        Team Abhedya &middot; SIH26053 &middot; Ministry of Defence / DRDO
      </footer>
    </div>
  );
};

export default HomePage;
