import React from 'react';
import type { StressModeId } from '../types/telemetry';
import { ShieldAlert, CheckCircle, EyeOff } from 'lucide-react';
import { POOL_CAPACITY_CELLS } from '../lib/constants';

interface StressHarnessPanelProps {
  activeStressMode: StressModeId;
  onSelectStressMode: (mode: StressModeId) => void;
}

/**
 * Visual preview only. Selecting "dropout" hides half of the points drawn in the 3D view.
 * It does NOT re-run the perception pipeline, so no robustness claim is made here.
 */
export const StressHarnessPanel: React.FC<StressHarnessPanelProps> = ({
  activeStressMode,
  onSelectStressMode,
}) => {
  const modes: { id: StressModeId; title: string; description: string; icon: React.ReactNode }[] = [
    {
      id: 'nominal',
      title: 'All returns drawn',
      description: 'Every simulated LiDAR return in the scene is drawn.',
      icon: <CheckCircle size={15} className="text-slate-800" />,
    },
    {
      id: 'dropout_50',
      title: 'Half the points hidden',
      description: 'Previews what sparse input looks like (for example a mud-covered aperture) by hiding half of the drawn points.',
      icon: <EyeOff size={15} className="text-amber-600" />,
    },
  ];

  return (
    <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-sm flex flex-col gap-4 text-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <ShieldAlert size={15} className="text-slate-800" />
          <span className="text-xs font-bold tracking-tight uppercase">Sensor dropout preview</span>
        </div>
        <span className="text-[10px] font-mono font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
          VISUAL ONLY
        </span>
      </div>

      <div className="text-xs text-slate-600 leading-relaxed">
        This only changes what is drawn in the 3D point view. It does not feed degraded data through the perception
        pipeline, so it says nothing about accuracy under sensor failure.
      </div>

      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Dropout preview mode">
        {modes.map((m) => {
          const isActive = activeStressMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onSelectStressMode(m.id)}
              className={`p-3 rounded-lg border text-left transition-all flex flex-col gap-1.5 ${
                isActive ? 'border-slate-900 bg-slate-50 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {m.icon}
                  <span className={`text-xs font-semibold ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>{m.title}</span>
                </div>
                {isActive && (
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-900 bg-slate-200/80 px-1.5 py-0.5 rounded">
                    Active
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 leading-snug">{m.description}</div>
            </button>
          );
        })}
      </div>

      <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 flex items-start gap-2 text-[10px] font-mono text-slate-700">
        <CheckCircle size={14} className="text-slate-900 shrink-0 mt-0.5" />
        <span>
          The grid pool is preallocated ({POOL_CAPACITY_CELLS.toLocaleString()} cells) and this preview does not touch it.
        </span>
      </div>
    </div>
  );
};
