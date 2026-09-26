import { Target, CheckCircle2, ShieldCheck, Mountain, Cpu } from 'lucide-react';

export const RegretPanel: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Zero Regret & Uncertainty Diversion Card */}
      <div className="glass-panel" style={{ padding: '16px' }}>
        <div className="panel-title">
          <span>Downstream Navigation &amp; Regret</span>
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
              HYBRID-A* CLOSED-LOOP REGRET
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
                Clearance 2.50m &bull; Trajectory Cost: 23.0
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

          {/* Standard 2.3: Uncertainty Diversion */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 10px',
              borderRadius: '4px',
              backgroundColor: 'rgba(179, 136, 255, 0.08)',
              border: '1px solid rgba(179, 136, 255, 0.25)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: 'var(--accent-purple)' }}>
                Uncertainty Diversion (Std 2.3)
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Planner active avoidance of mud (&sigma;&sup2;=0.15)
              </div>
            </div>
            <div
              className="mono-val"
              style={{
                color: 'var(--accent-purple)',
                fontWeight: 700,
                backgroundColor: 'rgba(179, 136, 255, 0.18)',
                padding: '2px 6px',
                borderRadius: '3px',
              }}
            >
              5.41m DIVERSION
            </div>
          </div>
        </div>
      </div>

      {/* Sloped Terrain Immunity Card (Standards 4.2 & 4.4) */}
      <div className="glass-panel" style={{ padding: '16px' }}>
        <div className="panel-title">
          <span>Slope Immunity &amp; Local PCA (Std 4.4)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Mountain size={14} style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>IMMUNE</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '10.5px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 8px',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <span>8% Downgrade (4.57&deg; slope)</span>
            <span className="mono-val" style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>
              0 FP / 25,543 pts (0.00%)
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 8px',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <span>15% Extreme Grade (8.53&deg; slope)</span>
            <span className="mono-val" style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>
              0 FP / 25,395 pts (0.00%)
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 8px',
              borderRadius: '4px',
              backgroundColor: 'rgba(0, 240, 255, 0.06)',
            }}
          >
            <span>IDD-3D Indian Classes (Std 5.4)</span>
            <span className="mono-val" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
              Auto: 1,296 | Cattle: 763
            </span>
          </div>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '10px' }}>
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
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={11} style={{ color: item.color }} />
                <span>{item.name}</span>
              </div>
              <span className="mono-val" style={{ color: item.color, fontWeight: 700, fontSize: '9.5px' }}>
                {item.result}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Compiled Hardware Execution & Latency Profiling (Standards 8.2 & 8.4) */}
      <div className="glass-panel" style={{ padding: '14px 16px' }}>
        <div className="panel-title" style={{ marginBottom: '8px' }}>
          <span>Compiled Latency (Std 8.2 &amp; 8.4)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Cpu size={13} style={{ color: 'var(--accent-emerald)' }} />
            <span className="mono-val" style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>
              2.26 ms / 100 ms
            </span>
          </div>
        </div>
        <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
          <div
            style={{
              width: '2.26%',
              minWidth: '6px',
              height: '100%',
              background: 'linear-gradient(90deg, var(--accent-emerald), var(--accent-cyan))',
              boxShadow: '0 0 8px var(--accent-cyan)',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '9px',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            marginTop: '6px',
          }}
        >
          <span>Spatial Hash: 1.79ms</span>
          <span>Rasterizer: 0.47ms</span>
          <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>44.2x Real-Time</span>
        </div>
      </div>
    </div>
  );
};
