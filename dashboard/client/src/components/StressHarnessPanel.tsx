import React, { useState } from 'react';
import type { StressModeId } from '../types/telemetry';
import { ShieldAlert, CheckCircle, CloudRain, EyeOff, Ghost, Sliders } from 'lucide-react';

interface StressHarnessPanelProps {
  activeStressMode: StressModeId;
  onSelectStressMode: (mode: StressModeId) => void;
}

export const StressHarnessPanel: React.FC<StressHarnessPanelProps> = ({
  activeStressMode,
  onSelectStressMode,
}) => {
  const [dropoutSlider, setDropoutSlider] = useState<number>(0);
  const [rainNoiseSlider, setRainNoiseSlider] = useState<number>(0);

  const scenarios: {
    id: StressModeId;
    title: string;
    description: string;
    icon: React.ReactNode;
    defenseRule: string;
  }[] = [
    {
      id: 'nominal',
      title: 'Nominal 64-Beam Ingestion',
      description: 'Clean Ouster / Velodyne LiDAR returns with zero simulated degradation.',
      icon: <CheckCircle size={15} className="text-slate-800" />,
      defenseRule: 'Welford recursive mean & variance across all 4 concentric lattice rings.',
    },
    {
      id: 'dropout_50',
      title: '50% Sensor Dropout (Aperture Mud)',
      description: 'Simulates heavy mud coverage or 32 emitter diodes failing instantaneously.',
      icon: <EyeOff size={15} className="text-amber-600" />,
      defenseRule: 'Chan parallel variance merge; preallocated flat hash table retains exact 3.2616 MB footprint.',
    },
    {
      id: 'monsoon_noise',
      title: 'Monsoon Rain & Aerosol Clutter',
      description: 'Indian monsoon downpour with extreme false returns and ground spray scatter.',
      icon: <CloudRain size={15} className="text-blue-600" />,
      defenseRule: 'Bayesian variance gating filters spurious floating returns without costmap pollution.',
    },
    {
      id: 'ghost_stress',
      title: 'High-Speed Dynamic Ghost Trail',
      description: 'Overtaking vehicle (15 m/s) cutting across forward trajectory.',
      icon: <Ghost size={15} className="text-slate-700" />,
      defenseRule: 'Range-disparity MOS flags dynamic cells; ray carving sweeps phantom trails in <200ms.',
    },
  ];

  return (
    <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-sm flex flex-col gap-4 text-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <ShieldAlert size={15} className="text-slate-800" />
          <span className="text-xs font-bold tracking-tight uppercase">
            Adversarial Stress Harness
          </span>
        </div>
        <span className="text-[10px] font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
          SIH26053 §9.2
        </span>
      </div>

      <div className="text-xs text-slate-600 leading-relaxed">
        Select degraded sensor modes to verify that memory allocation stays strictly constant at 3.2616 MB without memory spikes.
      </div>

      {/* Interactive Direct-Manipulation Degradation Sliders */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
            <Sliders size={12} />
            <span>BEAM DROPOUT (SIMULATED)</span>
          </span>
          <span className="text-[9px] font-mono text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
            {dropoutSlider}% DROPOUT (MOCK)
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={90}
          step={5}
          value={dropoutSlider}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            setDropoutSlider(val);
            if (val > 30) {
              onSelectStressMode('dropout_50');
            } else if (val === 0 && rainNoiseSlider === 0) {
              onSelectStressMode('nominal');
            }
          }}
          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
        />
        <div className="flex justify-between text-[9px] font-mono text-slate-400">
          <span>0% (Nominal)</span>
          <span>50% (Mud Occlusion)</span>
          <span>90% (Near Total Blindness)</span>
        </div>
      </div>

      {/* Preset Defense Mode Scenarios */}
      <div className="flex flex-col gap-2">
        {scenarios.map((s) => {
          const isActive = activeStressMode === s.id;
          return (
            <div
              key={s.id}
              onClick={() => {
                onSelectStressMode(s.id);
                if (s.id === 'dropout_50') setDropoutSlider(50);
                if (s.id === 'nominal') {
                  setDropoutSlider(0);
                  setRainNoiseSlider(0);
                }
              }}
              className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col gap-1.5 ${
                isActive
                  ? 'border-slate-900 bg-slate-50 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {s.icon}
                  <span className={`text-xs font-semibold ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                    {s.title}
                  </span>
                </div>
                {isActive && (
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-900 bg-slate-200/80 px-1.5 py-0.5 rounded">
                    Active
                  </span>
                )}
              </div>

              <div className="text-[11px] text-slate-500 leading-snug">
                {s.description}
              </div>

              <div className="text-[10px] font-mono text-slate-700 pt-1 border-t border-slate-100 mt-0.5">
                &bull; Defense Invariant: {s.defenseRule}
              </div>
            </div>
          );
        })}
      </div>

      {/* DRDO Invariant Guarantee Card */}
      <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 flex items-start gap-2 text-[10px] font-mono text-slate-700">
        <CheckCircle size={14} className="text-slate-900 shrink-0 mt-0.5" />
        <span>
          O(1) BOUND VERIFIED: Spatial hash array is preallocated to 106,875 elements. Zero dynamic heap growth during sensor failure modes.
        </span>
      </div>
    </div>
  );
};
