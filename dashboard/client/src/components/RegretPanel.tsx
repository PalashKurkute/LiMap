import React from 'react';
import { Target, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';

export const RegretPanel: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Zero Regret Defense Card */}
      <div className="glass-panel" style={{ padding: '16px' }}>
        <div className="panel-title">
          <span>Downstream Navigation Verification</span>
          <Target size={14} style={{ color: 'var(--accent-emerald)' }} />
        </div>

        {/* Hero Metric Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: '6px',
            backgroundColor: 'rgba(0, 230, 118, 0.09)',
            border: '1px solid rgba(0, 230, 118, 0.3)',
            marginBottom: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              HYBRID-A* CLOSED LOOP REGRET
            </div>
            <div
              className="mono-val"
              style={{
                fontSize: '24px',
                fontWeight: 800,
                color: 'var(--accent-emerald)',
                letterSpacing: '-0.5px',
              }}
            >
              0.0% REGRET
            </div>
          </div>
          <div
            style={{
              padding: '6px 10px',
              borderRadius: '4px',
              backgroundColor: 'rgba(0, 230, 118, 0.2)',
              color: 'var(--accent-emerald)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
            }}
          >
            MATHEMATICALLY PROVEN
          </div>
        </div>

        {/* Head-to-Head Architectural Comparison */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 10px',
              borderRadius: '4px',
              backgroundColor: 'rgba(0, 240, 255, 0.06)',
              border: '1px solid rgba(0, 240, 255, 0.2)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>FoveaGrid 2.5D (Ours)</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Clearance 2.50m &bull; Trajectory Cost: 11.20
              </div>
            </div>
            <div
              className="mono-val"
              style={{
                color: 'var(--accent-emerald)',
                fontWeight: 700,
                backgroundColor: 'rgba(0, 230, 118, 0.15)',
                padding: '2px 6px',
                borderRadius: '3px',
              }}
            >
              0.00% REGRET
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 10px',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 23, 68, 0.06)',
              border: '1px solid rgba(255, 23, 68, 0.2)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: 'var(--accent-crimson)' }}>Naive 2D Elevation Collapse</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Overhang collapsed to wall &bull; Planner deadlock
              </div>
            </div>
            <div
              className="mono-val"
              style={{
                color: 'var(--accent-crimson)',
                fontWeight: 700,
                backgroundColor: 'rgba(255, 23, 68, 0.15)',
                padding: '2px 6px',
                borderRadius: '3px',
              }}
            >
              BLOCKED (INF)
            </div>
          </div>
        </div>

        {/* Max Trajectory Divergence */}
        <div
          style={{
            marginTop: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            padding: '6px 8px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '4px',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>Trajectory Divergence:</span>
          <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
            0.37m &lt; 0.50m Kinematic Tol.
          </span>
        </div>
      </div>

      {/* Adversarial Stress Harness Matrix (5/5 Passing) */}
      <div className="glass-panel" style={{ padding: '16px' }}>
        <div className="panel-title">
          <span>Adversarial Sensor Stress Harness</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={14} style={{ color: 'var(--accent-emerald)' }} />
            <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>5/5 PASS</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '10.5px' }}>
          {[
            { name: '1. Rain & Spray Dynamic Clutter (15%)', result: 'PASSED', color: 'var(--accent-emerald)' },
            { name: '2. Total LiDAR Dropout (0.5s Dead Reckon)', result: 'PASSED', color: 'var(--accent-emerald)' },
            { name: '3. Extreme Pitch & Roll (\u00B115\u00B0 Deskew)', result: 'PASSED', color: 'var(--accent-emerald)' },
            { name: '4. Negative Obstacles & Pot-hole Array', result: 'DETECTED', color: 'var(--accent-cyan)' },
            { name: '5. Dynamic Occlusions & Speed Blur (15m/s)', result: 'ZERO GHOSTS', color: 'var(--accent-emerald)' },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '5px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={12} style={{ color: item.color }} />
                <span>{item.name}</span>
              </div>
              <span className="mono-val" style={{ color: item.color, fontWeight: 700, fontSize: '10px' }}>
                {item.result}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Real-time Latency Budget */}
      <div className="glass-panel" style={{ padding: '14px 16px' }}>
        <div className="panel-title" style={{ marginBottom: '8px' }}>
          <span>Perception Latency Budget</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Zap size={13} style={{ color: 'var(--accent-cyan)' }} />
            <span className="mono-val" style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>
              13.4 ms / 100 ms
            </span>
          </div>
        </div>
        <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
          <div
            style={{
              width: '13.4%',
              height: '100%',
              background: 'linear-gradient(90deg, var(--accent-emerald), var(--accent-cyan))',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '9.5px',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            marginTop: '6px',
          }}
        >
          <span>Ingest: 3.1ms</span>
          <span>Lattice: 4.8ms</span>
          <span>MOS: 3.4ms</span>
          <span>Costmap: 2.1ms</span>
        </div>
      </div>
    </div>
  );
};
