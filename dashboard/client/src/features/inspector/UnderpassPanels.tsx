import React from 'react';
import type { PlannerFile, PlannerGridId } from '../../types/telemetry';
import type { PlannerStatus } from '../../data/planner';
import { ProvenanceBadge } from '../evidence/primitives';
import { costText } from './underpass';

// The pieces of the Map Inspector's underpass comparison that are DOM, not canvas: the two pane titles, the legend and
// the results card. Every figure is read from the planner snapshot (schema limap.planner/1); the sentences state only
// how to read it. Nothing here names an outcome, so it stays true if the data changes.

/** Title above one pane, with what the planner found on that map. */
export const UnderpassPaneLabel: React.FC<{ data: PlannerFile; grid: PlannerGridId; leftPct: number }> = ({ data, grid, leftPct }) => {
  const result = data.results[grid];
  return (
    <span
      data-region={`underpass-pane-${grid}`}
      className="absolute top-3 z-20 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-1"
      style={{ left: `${leftPct}%` }}
    >
      <span className="rounded border border-line bg-panel/90 px-2 py-0.5 text-[10px] font-mono font-bold text-fg-2">
        {data.meta.grids[grid].label}
      </span>
      <span
        className={`rounded border px-2 py-0.5 text-[10px] font-mono font-bold ${
          result.traversable ? 'border-good-line bg-good-bg text-good-fg' : 'border-critical-line bg-critical-bg text-critical-fg'
        }`}
      >
        {result.traversable ? `Path found · cost ${costText(result.cost)}` : 'No path found'}
      </span>
    </span>
  );
};

export const UnderpassLegend: React.FC = () => (
  <div
    data-region="underpass-legend"
    className="absolute bottom-4 right-4 z-20 bg-panel/90 border border-line rounded-xl p-2.5 backdrop-blur-md shadow-md text-[10px] font-mono text-fg-2 max-w-56"
  >
    <ul className="flex flex-col gap-1">
      <li className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: 'var(--scene-cost-lethal)' }} />
        <span>Impassable</span>
      </li>
      <li className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: 'var(--scene-cost-risk)' }} />
        <span>Passable, with a risk cost</span>
      </li>
      <li className="flex items-center gap-2">
        <span className="h-0.5 w-2.5 shrink-0 rounded" style={{ backgroundColor: 'var(--scene-path)' }} />
        <span>Path the planner found</span>
      </li>
    </ul>
  </div>
);

/** One figure with its provenance tag. `stacked` puts a long value under its label instead of beside it. */
const Line: React.FC<{ label: string; children: React.ReactNode; kind?: 'MEASURED' | 'CALCULATED'; stacked?: boolean }> = ({
  label,
  children,
  kind = 'MEASURED',
  stacked = false,
}) =>
  stacked ? (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-fg-muted">{label}</span>
        <ProvenanceBadge kind={kind} />
      </div>
      <strong className="text-fg tabular-nums">{children}</strong>
    </div>
  ) : (
    <div className="flex items-center justify-between gap-3">
      <span className="text-fg-muted">{label}</span>
      <span className="flex items-center gap-2">
        <strong className="text-fg tabular-nums text-right">{children}</strong>
        <ProvenanceBadge kind={kind} />
      </span>
    </div>
  );

/** "One-height grid (naive baseline)" -> "One-height grid": the part of the exported label before its qualifier. */
const shortLabel = (label: string) => label.split(' (')[0];

export const UnderpassCard: React.FC<{ data: PlannerFile | null; status: PlannerStatus; minClearance: number | null }> = ({
  data,
  status,
  minClearance,
}) => (
  <div data-region="underpass-card" className="p-4 flex flex-col gap-2.5">
    <span className="font-bold text-fg uppercase tracking-wider text-[11px]">Underpass: one height vs 2.5D</span>
    {data ? (
      <div className="bg-subtle border border-line rounded-lg p-3 flex flex-col gap-1.5 text-[11px] font-mono">
        <Line label={shortLabel(data.meta.grids.naive.label)} stacked>
          {data.results.naive.traversable ? `Path found · cost ${costText(data.results.naive.cost)}` : 'No path found'}
        </Line>
        <Line label={shortLabel(data.meta.grids.aware.label)} stacked>
          {data.results.aware.traversable
            ? `Path found · cost ${costText(data.results.aware.cost)} · ${data.results.aware.waypoints} waypoints`
            : 'No path found'}
        </Line>
        <Line label="Same route, no obstacles">{costText(data.results.reference.cost)}</Line>
        <Line label="Impassable costmap cells">
          {data.meta.grids.naive.lethal_cells.toLocaleString()} vs {data.meta.grids.aware.lethal_cells.toLocaleString()}
        </Line>
        <Line label="Vehicle height used">{data.meta.costmap.vehicle_height_m} m</Line>
        {minClearance != null && <Line label="Lowest clearance recorded">{minClearance} m</Line>}
        <p className="text-fg-muted leading-relaxed pt-1">
          Both costmaps come from the same scan. The one-height grid is this project&apos;s own naive baseline: a cell with something
          overhead is impassable. The 2.5D grid keeps the clearance, so a vehicle can pass where there is room.
        </p>
        <p className="text-fg-muted leading-relaxed">
          Cost is path length plus risk and steering penalties. One scenario on a synthetic scene, planned by this project&apos;s
          Hybrid-A* from the start to the goal marked on the map.
        </p>
      </div>
    ) : (
      <p className="text-[11px] font-mono text-fg-muted">
        {status === 'unavailable' ? 'No planner run was exported for this scene.' : 'Loading the planner run…'}
      </p>
    )}
  </div>
);
