import React, { useMemo, useState } from 'react';
import type { CrossSectionResponse, CrossSectionPoint } from '../types/telemetry';
import { Layers } from 'lucide-react';

interface InteractiveCrossSectionProps {
  data: CrossSectionResponse | null;
  sceneId: string;
}

type ObservedPoint = CrossSectionPoint & { observed: true; z_ground: number };

const isObserved = (p: CrossSectionPoint): p is ObservedPoint => p.observed && p.z_ground !== null;

/** Splits samples into runs of consecutive observed points so unobserved gaps are drawn as gaps. */
function observedRuns(profile: CrossSectionPoint[]): ObservedPoint[][] {
  const runs: ObservedPoint[][] = [];
  let current: ObservedPoint[] = [];
  for (const p of profile) {
    if (isObserved(p)) {
      current.push(p);
    } else if (current.length) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length) runs.push(current);
  return runs;
}

export const InteractiveCrossSection: React.FC<InteractiveCrossSectionProps> = ({ data, sceneId }) => {
  const profile = useMemo(() => data?.profile ?? [], [data]);
  const observed = useMemo(() => profile.filter(isObserved), [profile]);

  const xMin = profile.length ? Math.min(...profile.map((p) => p.x)) : 0;
  const xMax = profile.length ? Math.max(...profile.map((p) => p.x)) : 1;
  const [sliceOffset, setSliceOffset] = useState<number | null>(null);
  const slice = sliceOffset !== null ? Math.min(Math.max(sliceOffset, xMin), xMax) : (xMin + xMax) / 2;

  const width = 360;
  const height = 150;
  const padL = 36;
  const padR = 14;
  const padT = 16;
  const padB = 24;

  if (observed.length === 0) {
    return (
      <div data-tour="cross-section" className="bg-panel border border-line-strong rounded-xl p-4 shadow-sm flex flex-col gap-2">
        <div className="flex items-center gap-2 border-b border-line pb-2">
          <Layers size={14} className="text-fg-2" />
          <span className="text-xs font-bold tracking-tight text-fg uppercase">
            Interactive Cross-Section Slicer
          </span>
        </div>
        <p className="text-xs text-fg-2 leading-relaxed">
          No grid cells are available along this line for <span className="font-mono">{sceneId}</span>, so no
          profile is drawn. Load a scene with the API running, or use a precomputed snapshot.
        </p>
      </div>
    );
  }

  const zVals = observed.flatMap((p) => (p.z_overhang !== null ? [p.z_ground, p.z_overhang] : [p.z_ground]));
  const zLo = Math.min(...zVals);
  const zHi = Math.max(...zVals);
  const zPad = Math.max((zHi - zLo) * 0.15, 0.3);
  const minZ = zLo - zPad;
  const maxZ = zHi + zPad;

  const spanX = Math.max(xMax - xMin, 1e-6);
  const scaleX = (x: number) => padL + ((x - xMin) / spanX) * (width - padL - padR);
  const scaleZ = (z: number) => padT + ((maxZ - z) / (maxZ - minZ)) * (height - padT - padB);

  const nearest = profile.reduce((prev, curr) => (Math.abs(curr.x - slice) < Math.abs(prev.x - slice) ? curr : prev), profile[0]);
  const gridTicks = [0, 1, 2, 3].map((i) => minZ + ((maxZ - minZ) * i) / 3);
  const gaps = profile.length - observed.length;

  const pathFor = (pts: { x: number; z: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x).toFixed(1)} ${scaleZ(p.z).toFixed(1)}`).join(' ');

  const overhangRuns = observedRuns(profile.map((p) => (p.z_overhang !== null ? p : { ...p, observed: false })));

  return (
    <div data-tour="cross-section" className="bg-panel border border-line-strong rounded-xl p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-fg-2" />
          <span className="text-xs font-bold tracking-tight text-fg uppercase">
            Interactive Cross-Section Slicer
          </span>
        </div>
        <span className="text-[11px] font-mono font-semibold text-fg-2 bg-subtle px-2 py-0.5 rounded">
          X = {nearest.x.toFixed(1)}m
        </span>
      </div>

      <div className="relative w-full overflow-hidden bg-subtle border border-line rounded-lg p-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block select-none"
          role="img"
          aria-label={`Elevation profile along x from ${xMin.toFixed(1)} to ${xMax.toFixed(1)} metres, ${observed.length} observed samples`}
        >
          {gridTicks.map((zVal) => (
            <g key={zVal}>
              <line x1={padL} y1={scaleZ(zVal)} x2={width - padR} y2={scaleZ(zVal)} className="stroke-viz-grid" strokeWidth="1" />
              <text x={padL - 6} y={scaleZ(zVal) + 3} fontSize="8" fontFamily="var(--font-mono)" textAnchor="end" className="fill-viz-axis">
                {zVal.toFixed(1)}m
              </text>
            </g>
          ))}

          {observedRuns(profile).map((run, i) => (
            <path
              key={`g${i}`}
              d={pathFor(run.map((p) => ({ x: p.x, z: p.z_ground })))}
              fill="none"
              className="stroke-fg"
              strokeWidth="2"
            />
          ))}

          {overhangRuns.map((run, i) => (
            <path
              key={`o${i}`}
              d={pathFor(run.map((p) => ({ x: p.x, z: p.z_overhang as number })))}
              fill="none"
              className="stroke-scene-path"
              strokeWidth="2.5"
            />
          ))}

          {isObserved(nearest) && (
            <g>
              <line x1={scaleX(nearest.x)} y1={padT} x2={scaleX(nearest.x)} y2={height - padB} className="stroke-fg" strokeWidth="1.5" strokeDasharray="3,2" />
              <circle cx={scaleX(nearest.x)} cy={scaleZ(nearest.z_ground)} r="3.5" className="fill-fg" />
              {nearest.z_overhang !== null && (
                <>
                  <circle cx={scaleX(nearest.x)} cy={scaleZ(nearest.z_overhang)} r="3.5" className="fill-scene-path" />
                  <line x1={scaleX(nearest.x)} y1={scaleZ(nearest.z_ground)} x2={scaleX(nearest.x)} y2={scaleZ(nearest.z_overhang)} className="stroke-scene-path" strokeWidth="1.5" />
                </>
              )}
            </g>
          )}
        </svg>
      </div>

      <div className="flex flex-col gap-1.5 pt-1">
        <div className="flex justify-between items-center text-[10px] font-mono text-fg-muted">
          <span>DRAG SLICE PLANE:</span>
          <span className="font-semibold text-fg">
            {!isObserved(nearest)
              ? 'Unobserved (no cell here)'
              : nearest.clearance_m !== null
                ? `Clearance: ${nearest.clearance_m.toFixed(2)}m`
                : 'No overhang recorded'}
          </span>
        </div>
        <input
          type="range"
          aria-label="Cross-section slice position"
          min={xMin}
          max={xMax}
          step={Math.max(spanX / 200, 0.05)}
          value={slice}
          onChange={(e) => setSliceOffset(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-line rounded-lg appearance-none cursor-pointer accent-accent"
        />
        <div className="flex justify-between text-[9px] font-mono text-fg-muted">
          <span>{xMin.toFixed(1)}m</span>
          <span>{xMax.toFixed(1)}m</span>
        </div>
        {gaps > 0 && (
          <div className="text-[10px] font-mono text-fg-muted">
            {gaps} of {profile.length} samples fall in unobserved space and are left as gaps.
          </div>
        )}
      </div>
    </div>
  );
};
