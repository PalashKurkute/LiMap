import React, { useEffect } from 'react';
import type { SceneId } from '../types/telemetry';
import { Shield } from 'lucide-react';

interface HeaderProps {
  activeScene: SceneId;
  onSelectScene: (scene: SceneId) => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({ activeScene, onSelectScene, isLoading }) => {
  const scenes: { id: SceneId; label: string; badge: string; key: string }[] = [
    { id: 'scene_a_bridge', label: 'Scene A: Bridge Underpass', badge: '2.5m Clearance', key: '1' },
    { id: 'scene_b_potholes', label: 'Scene B: Potholes & Craters', badge: 'Neg. Hazard', key: '2' },
    { id: 'scene_c_moving', label: 'Scene C: Dynamic Vehicle', badge: 'MOS 8 m/s', key: '3' },
    { id: 'scene_d_poles', label: 'Scene D: Thin Pole Array', badge: 'Foveation', key: '4' },
  ];

  // Hotkey listener (1-4 keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '1') onSelectScene('scene_a_bridge');
      else if (e.key === '2') onSelectScene('scene_b_potholes');
      else if (e.key === '3') onSelectScene('scene_c_moving');
      else if (e.key === '4') onSelectScene('scene_d_poles');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectScene]);

  return (
    <header style={{
      height: '56px',
      backgroundColor: 'rgba(10, 14, 22, 0.95)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--card-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      zIndex: 100,
    }}>
      {/* Brand & Client */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'linear-gradient(135deg, #00f0ff, #0077ff)',
          color: '#000',
          padding: '4px 10px',
          borderRadius: '4px',
          fontWeight: 800,
          fontSize: '11px',
          letterSpacing: '1.2px',
          fontFamily: 'var(--font-mono)'
        }}>
          <Shield size={13} strokeWidth={3} />
          FOVEAGRID 2.5D
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Adaptive Variable-Resolution LiDAR Perception
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            DEFENCE RESEARCH &amp; DEVELOPMENT ORGANISATION (DRDO) &bull; SIH26053
          </span>
        </div>
      </div>

      {/* Scenario Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {scenes.map((s) => {
          const isActive = activeScene === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelectScene(s.id)}
              disabled={isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: isActive ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${isActive ? 'var(--accent-cyan)' : 'var(--card-border)'}`,
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-primary)',
                boxShadow: isActive ? '0 0 12px rgba(0, 240, 255, 0.25)' : 'none',
              }}
            >
              <span style={{
                fontSize: '9px',
                padding: '1px 5px',
                borderRadius: '3px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--accent-cyan)',
                fontWeight: 700,
              }}>
                [{s.key}]
              </span>
              <span>{s.label}</span>
              <span style={{
                fontSize: '9px',
                padding: '1px 5px',
                borderRadius: '4px',
                backgroundColor: isActive ? 'rgba(0, 240, 255, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                color: isActive ? '#fff' : 'var(--text-muted)',
              }}>
                {s.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* System Status Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '16px',
          backgroundColor: 'rgba(0, 230, 118, 0.1)',
          border: '1px solid rgba(0, 230, 118, 0.3)',
          color: 'var(--accent-emerald)',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
        }}>
          <div className="pulsing-dot" />
          <span>REAL-TIME 10 HZ</span>
        </div>
      </div>
    </header>
  );
};
