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
      icon: <CheckCircle size={15} className="text-fg" />,
    },
    {
      id: 'dropout_50',
      title: 'Half the points hidden',
      description: 'Previews what sparse input looks like (for example a mud-covered aperture) by hiding half of the drawn points.',
      icon: <EyeOff size={15} className="text-warn-fg" />,
    },
  ];

  return (
    <div className="bg-panel border border-line-strong rounded-xl p-4 shadow-sm flex flex-col gap-4 text-fg">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <div className="flex items-center gap-2">
          <ShieldAlert size={15} className="text-fg" />
          <span className="text-xs font-bold tracking-tight uppercase">Sensor dropout preview</span>
        </div>
        <span className="text-[10px] font-mono font-medium text-warn-fg bg-warn-bg border border-warn-line px-2 py-0.5 rounded">
          VISUAL ONLY
        </span>
      </div>

      <div className="text-xs text-fg-2 leading-relaxed">
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
                isActive ? 'border-line-strong bg-subtle shadow-sm' : 'border-line hover:border-line-strong bg-panel'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {m.icon}
                  <span className={`text-xs font-semibold ${isActive ? 'text-fg' : 'text-fg-2'}`}>{m.title}</span>
                </div>
                {isActive && (
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-fg bg-line/80 px-1.5 py-0.5 rounded">
                    Active
                  </span>
                )}
              </div>
              <div className="text-[11px] text-fg-muted leading-snug">{m.description}</div>
            </button>
          );
        })}
      </div>

      <div className="p-2.5 rounded-lg bg-subtle border border-line flex items-start gap-2 text-[10px] font-mono text-fg-2">
        <CheckCircle size={14} className="text-fg shrink-0 mt-0.5" />
        <span>
          The grid pool is preallocated ({POOL_CAPACITY_CELLS.toLocaleString()} cells) and this preview does not touch it.
        </span>
      </div>
    </div>
  );
};
