import React from 'react';
import { Target } from 'lucide-react';

/**
 * Planner regret is computed offline (benchmark/regret_benchmark.py) on a handful of
 * real frames. It is not computed per scene in this dashboard, so this panel states that
 * plainly instead of showing a number that would not trace to a result file.
 */
export const RegretPanel: React.FC = () => {
  return (
    <div className="flex flex-col gap-3 text-slate-900">
      <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <Target size={14} className="text-slate-800" />
          <span className="text-xs font-bold tracking-tight uppercase">Planner divergence &amp; regret</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Regret compares a Hybrid-A* path on the FoveaGrid map against the same planner on a dense reference map. It is
          produced offline by <span className="font-mono">benchmark/regret_benchmark.py</span> on a small set of real
          frames, not per scene in this viewer, so no value is shown here.
        </p>
      </div>
    </div>
  );
};
