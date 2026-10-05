/**
 * "How it fits a robot": the path a scan takes from a sensor to a route (scan in, grid, costmap, planner), what is real in this
 * repository at each stage and what is only described, and the gaps that are still open. The copy describes; it carries no
 * figures (every number in the product is on the dashboard, read from data). Each claim is taken from docs/reference/
 * KNOWN_LIMITATIONS.md, the ARCHITECTURE.md status table or the code itself.
 */
import React from 'react';
import { ArrowRight, Check, CircleDashed, Grid3x3, Map as MapIcon, Route, ScanLine, type LucideIcon } from 'lucide-react';

interface Stage {
  id: string;
  title: string;
  icon: LucideIcon;
  what: string;
  real: string;
  described: string;
}

const STAGES: Stage[] = [
  {
    id: 'scan-in',
    title: 'Scan in',
    icon: ScanLine,
    what: 'A LiDAR frame is a list of points, each with a position (x, y, z) and an intensity. The demo uses the SemanticKITTI .bin layout.',
    real: 'The loader reads recorded scans from files: generated test scenes and one public driving sequence.',
    described: 'Reading a live sensor. Nothing in the demo is connected to one.',
  },
  {
    id: 'grid',
    title: 'Grid',
    icon: Grid3x3,
    what: 'The points fill a fixed-size 2.5D grid: fine cells near the vehicle, coarse cells far away. Each cell keeps a ground height and an overhead height, so an underpass is not mistaken for a wall.',
    real: "The grid and its per-cell heights come from the project's own pipeline in core/grid. The dashboard draws what it produced.",
    described: 'Moving the fine zone to follow hazards or uncertainty. It is planned, not built.',
  },
  {
    id: 'costmap',
    title: 'Costmap',
    icon: MapIcon,
    what: 'The grid becomes a traversability costmap. Each cell gets a cost for how risky it is to drive over, and a cell with something overhead is passable only where the vehicle fits underneath.',
    real: 'costmap_generator.py in core/planning builds it, and the underpass view on the dashboard uses its output. A converter to a ROS 2 costmap message is in the repository.',
    described: 'Running inside Nav2 as a costmap layer. The architecture notes list it as planned.',
  },
  {
    id: 'planner',
    title: 'Planner',
    icon: Route,
    what: 'Hybrid A* plans a drivable route over the costmap. In this demo it runs only on the bridge underpass replay, and the same planner is run again on a grid that keeps one height per cell, to compare.',
    real: "hybrid_a_star.py in core/planning is implemented. The dashboard shows both routes and a fly-through along the planner's path.",
    described: 'Driving a robot along the route. The fly-through is a camera shot, not a recorded drive.',
  },
];

const GAPS: { lead: string; text: string }[] = [
  {
    lead: 'Not run on a robot or on embedded hardware.',
    text: "There has been no Jetson or other embedded run. Everything was measured on an ordinary computer's processor, where the full pipeline with segmentation is far below live rates; the measured speeds are on the Evidence page, and the project notes say sustained live rates need a GPU or a split between slow and fast updates.",
  },
  {
    lead: 'ROS 2 and Nav2 are only partly there.',
    text: "A ROS 2 package that publishes the costmap is in the repository, and its message conversion has tests that run without ROS 2. Nav2's own planner is not used: the planner here is this project's Hybrid A*, and a comparison against Nav2's planner is not done.",
  },
  {
    lead: 'The planner has one scenario.',
    text: "It runs only on the bridge underpass replay, and the one-height grid it is compared with is this project's own baseline, not another group's planner. The foveation presets are one scan each, so nothing here shows behaviour over a drive.",
  },
  {
    lead: 'Labels come with the scans, not from a model.',
    text: 'The demo scenes show the labels that come with each scan. The segmentation accuracy on the Evidence page comes from a separate run of a pretrained segmentation model on the real sequence, but that model file is not stored in this repository; without it, a scan that has no labels is labelled by a rule-based classifier.',
  },
  {
    lead: 'Little real data.',
    text: 'The real data is one public sequence (SemanticKITTI sequence 08), and the real scene on the dashboard is a small sample of it. The other scenes are generated.',
  },
];

const chip = 'inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider';

const RobotFit: React.FC<{ id: string }> = ({ id }) => (
  <section id={id} aria-labelledby={`${id}-title`} className="relative z-10 mx-auto w-full max-w-6xl scroll-mt-4 px-6 pb-16 pt-14 text-left">
    <p className="text-sm font-semibold uppercase tracking-widest text-accent-text">From scan to route</p>
    <h2 id={`${id}-title`} tabIndex={-1} className="mt-2 text-2xl font-bold tracking-tight outline-none sm:text-3xl">
      How it fits a robot
    </h2>
    <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-fg-2">
      This is the path a scan takes from a sensor to a route a robot could follow, and where the project stands at each step. Every stage
      says what is real in this repository and what is only described.
    </p>

    <ol aria-label="The four stages" className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4 xl:gap-6">
      {STAGES.map((s, i) => {
        const Icon = s.icon;
        return (
          <li key={s.id} data-stage={s.id} className="relative flex flex-col gap-3 rounded-2xl border border-line bg-panel p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent-line bg-accent-subtle text-accent-text">
                <Icon size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-fg-muted">Stage {i + 1}</p>
                <h3 className="text-base font-bold tracking-tight">{s.title}</h3>
              </div>
            </div>
            <p className="text-[13px] leading-relaxed text-fg-2">{s.what}</p>
            <dl className="flex flex-col gap-3 border-t border-line pt-3">
              <div className="flex flex-col gap-1.5">
                <dt className={`${chip} border-accent-line bg-accent-subtle text-accent-text`}>
                  <Check size={11} aria-hidden="true" />
                  In this repo
                </dt>
                <dd className="break-words text-[13px] leading-relaxed text-fg-2">{s.real}</dd>
              </div>
              <div className="flex flex-col gap-1.5">
                <dt className={`${chip} border-line-strong bg-subtle text-fg-2`}>
                  <CircleDashed size={11} aria-hidden="true" />
                  Only described
                </dt>
                <dd className="break-words text-[13px] leading-relaxed text-fg-2">{s.described}</dd>
              </div>
            </dl>
            {i < STAGES.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute -right-[22px] top-7 z-10 hidden h-5 w-5 items-center justify-center rounded-full border border-line-strong bg-app text-fg-muted xl:flex"
              >
                <ArrowRight size={12} />
              </span>
            )}
          </li>
        );
      })}
    </ol>

    <div className="mt-8 rounded-2xl border border-line bg-panel p-5 shadow-sm sm:p-6">
      <h3 id={`${id}-gaps`} className="text-base font-bold tracking-tight">
        What is not done yet
      </h3>
      <ul aria-labelledby={`${id}-gaps`} className="mt-3 flex flex-col divide-y divide-line">
        {GAPS.map((g) => (
          <li key={g.lead} data-gap className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <CircleDashed size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-fg-muted" />
            <p className="text-[13px] leading-relaxed text-fg-2">
              <strong className="font-semibold text-fg">{g.lead}</strong> {g.text}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[12px] leading-relaxed text-fg-muted">
        The full list, with the reasons, is in <code className="font-mono text-fg-2">docs/reference/KNOWN_LIMITATIONS.md</code> in the repository.
      </p>
    </div>
  </section>
);

export default RobotFit;
