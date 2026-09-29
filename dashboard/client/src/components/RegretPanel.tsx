import React from 'react';
import { Target, CheckCircle2 } from 'lucide-react';

export const RegretPanel: React.FC = () => {
  return (
    <div className="flex flex-col gap-3 text-slate-900">
      {/* Primary Path Regret Card */}
      <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <Target size={14} className="text-slate-800" />
            <span className="text-xs font-bold tracking-tight uppercase">
              Planner Divergence &amp; Regret
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
            Hybrid-A* Benchmark
          </span>
        </div>

        {/* Hero Metric Callout */}
        <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono font-medium text-slate-500 uppercase">
              Path Cost Regret vs 3D Ground Truth
            </div>
            <div className="text-xl font-bold font-mono tracking-tight text-amber-700">
              PENDING COMPUTATION
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-mono font-medium text-slate-500 uppercase">
              Fréchet Distance
            </div>
            <div className="text-sm font-semibold font-mono text-slate-600">
              Pending Run
            </div>
          </div>
        </div>

        {/* Head-to-Head Comparison Table */}
        <div className="flex flex-col divide-y divide-slate-200 text-xs">
          <div className="py-2 flex justify-between items-center">
            <div>
              <div className="font-semibold text-slate-900">LiMap 2.5D (Ours)</div>
              <div className="text-[10px] text-slate-500">Dual-elevation + Bayesian variance</div>
            </div>
            <div className="text-right font-mono">
              <span className="font-semibold text-amber-700">Pending Evaluation</span>
              <div className="text-[10px] text-slate-500">Awaiting planner run</div>
            </div>
          </div>

          <div className="py-2 flex justify-between items-center">
            <div>
              <div className="font-semibold text-slate-700">Standard 2.5D Mean Elevation</div>
              <div className="text-[10px] text-slate-500">Single height per cell (No overhangs)</div>
            </div>
            <div className="text-right font-mono">
              <span className="font-semibold text-slate-700">Lethal Failure (Collision)</span>
              <div className="text-[10px] text-slate-400">Bridge deck flattened to ground</div>
            </div>
          </div>

          <div className="py-2 flex justify-between items-center">
            <div>
              <div className="font-semibold text-slate-700">Dense 3D Voxel Grid (OctoMap)</div>
              <div className="text-[10px] text-slate-500">Uncompressed benchmark ground truth</div>
            </div>
            <div className="text-right font-mono">
              <span className="font-semibold text-slate-900">0.00% (Baseline)</span>
              <div className="text-[10px] text-slate-400">Requires 3,051 MB RAM</div>
            </div>
          </div>
        </div>

        {/* Proof Statement */}
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-300 text-[10px] font-mono text-slate-700 flex items-start gap-2">
          <CheckCircle2 size={13} className="text-slate-900 shrink-0 mt-0.5" />
          <span>
            VERIFICATION IN PROGRESS: Closed-loop Hybrid-A* trajectory comparison pending per-scene run.
          </span>
        </div>
      </div>
    </div>
  );
};
