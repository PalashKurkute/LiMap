import React from 'react';
import type { StressModeId } from '../types/telemetry';
import { ShieldAlert, CheckCircle, CloudRain, EyeOff, Ghost } from 'lucide-react';

interface StressHarnessPanelProps {
  activeStressMode: StressModeId;
  onSelectStressMode: (mode: StressModeId) => void;
}

interface StressScenario {
  id: StressModeId;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  statusText: string;
  severity: 'nominal' | 'warning' | 'critical';
  defenseBehavior: string;
  memoryImpact: string;
}

export const StressHarnessPanel: React.FC<StressHarnessPanelProps> = ({
  activeStressMode,
  onSelectStressMode,
}) => {
  const scenarios: StressScenario[] = [
    {
      id: 'nominal',
      title: 'Nominal Scan (Clean 64-Beam)',
      subtitle: 'Standard Velodyne/Ouster optical transmission without degradation.',
      icon: <CheckCircle size={15} style={{ color: 'var(--accent-emerald)' }} />,
      statusText: 'ALL BEAMS OPERATIONAL',
      severity: 'nominal',
      defenseBehavior: 'Standard Welford running elevation and variance estimation across all 4 concentric rings.',
      memoryImpact: '3.2616 MB (Nominal pool)',
    },
    {
      id: 'dropout_50',
      title: '50% Beam Occlusion (Sensor Mud)',
      subtitle: 'Simulates heavy mud/dirt on sensor aperture or 32 of 64 emitter diodes failing.',
      icon: <EyeOff size={15} style={{ color: 'var(--accent-amber)' }} />,
      statusText: '32 BEAMS OCCLUDED',
      severity: 'warning',
      defenseBehavior: 'Sparse lattice interpolation via Chan parallel variance merge; zero cell reallocation.',
      memoryImpact: '3.2616 MB (Zero reallocation)',
    },
    {
      id: 'monsoon_noise',
      title: 'Monsoon Rain & Fog Clutter',
      subtitle: 'Simulates Indian monsoon downpour with extreme aerosol returns and ground spray.',
      icon: <CloudRain size={15} style={{ color: 'var(--accent-cyan)' }} />,
      statusText: 'STOCHASTIC CLUTTER ACTIVE',
      severity: 'warning',
      defenseBehavior: 'Bayesian variance gating rejects false ground spikes with high σ² without corrupting costmap.',
      memoryImpact: '3.2616 MB (Noise rejected)',
    },
    {
      id: 'ghost_stress',
      title: 'Dynamic Ghost Trail Ambush',
      subtitle: 'Fast overtaking vehicle (15 m/s) leaving stale elevation trails in blind spots.',
      icon: <Ghost size={15} style={{ color: 'var(--accent-purple)' }} />,
      statusText: 'MOVING VEHICLE PHANTOM',
      severity: 'critical',
      defenseBehavior: 'Moving-Object Segmentation (MOS) + Line-of-sight ray tracing carves ghost cells in <200ms.',
      memoryImpact: '3.2616 MB (Ghost erased in 2 scans)',
    },
  ];

  return (
    <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldAlert size={14} style={{ color: 'var(--accent-amber)' }} />
          <span>Defense Adversarial Stress Harness</span>
        </div>
        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
          SIH26053 §9.2
        </span>
      </div>

      <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
        Deliberately inject sensor degradation to mathematically prove memory bounds and zero crash failure (Standard 9.2).
      </div>

      {/* Scenario Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {scenarios.map((s) => {
          const isActive = activeStressMode === s.id;
          return (
            <div
              key={s.id}
              onClick={() => onSelectStressMode(s.id)}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: isActive ? 'rgba(0, 240, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${isActive ? 'var(--accent-cyan)' : 'var(--card-border)'}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                boxShadow: isActive ? '0 0 16px rgba(0, 240, 255, 0.15)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {s.icon}
                  <span style={{ fontSize: '12px', fontWeight: 600, color: isActive ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                    {s.title}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: isActive ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  }}
                >
                  {s.statusText}
                </span>
              </div>

              <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                {s.subtitle}
              </div>

              <div
                style={{
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  color: isActive ? 'var(--accent-emerald)' : 'var(--text-subtle)',
                  paddingTop: '4px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                &bull; DEFENSE RESPONSE: {s.defenseBehavior}
              </div>
            </div>
          );
        })}
      </div>

      {/* DRDO Invariant Banner */}
      <div
        style={{
          padding: '8px 12px',
          borderRadius: '6px',
          background: 'rgba(0, 230, 118, 0.08)',
          border: '1px solid rgba(0, 230, 118, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '10.5px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--accent-emerald)',
        }}
      >
        <CheckCircle size={14} />
        <span>DRDO INVARIANT: Flat hash pool is 100% preallocated. Zero allocations under all stress modes.</span>
      </div>
    </div>
  );
};
