import React, { useEffect } from 'react';
import type { SceneId } from '../types/telemetry';
import { Menu } from 'lucide-react';

interface HeaderProps {
  onSelectScene: (scene: SceneId) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSelectScene,
  isSidebarOpen,
  onToggleSidebar,
}) => {
  // Global hotkey listener (1-4 scenes, T for telemetry drawer)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '1') onSelectScene('scene_a_bridge');
      else if (e.key === '2') onSelectScene('scene_b_potholes');
      else if (e.key === '3') onSelectScene('scene_c_moving');
      else if (e.key === '4') onSelectScene('scene_d_poles');
      else if (e.key === 't' || e.key === 'T') onToggleSidebar();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectScene, onToggleSidebar]);

  return (
    <header style={{
      height: '52px',
      backgroundColor: 'rgba(10, 14, 22, 0.95)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--card-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      zIndex: 100,
    }}>
      {/* Brand & Client + Hamburger Toggle (Exact Match to Reference Screenshot) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={onToggleSidebar}
          title={isSidebarOpen ? "Close Sidebar [T]" : "Open Sidebar [T]"}
          style={{
            background: isSidebarOpen ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${isSidebarOpen ? 'var(--accent-cyan)' : 'var(--card-border)'}`,
            borderRadius: '6px',
            color: isSidebarOpen ? 'var(--accent-cyan)' : 'var(--text-primary)',
            padding: '6px 8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
        >
          <Menu size={16} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.2px' }}>
            LiDAR 2.5D Mapper
          </span>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 8px',
            borderRadius: '12px',
            backgroundColor: 'rgba(0, 230, 118, 0.1)',
            border: '1px solid rgba(0, 230, 118, 0.25)',
            color: 'var(--accent-emerald)',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
          }}>
            <div className="pulsing-dot" />
            <span>WebSocket Connected (JSON)</span>
          </div>
        </div>
      </div>

      {/* Right Side: Clean FPS Badge (Exact Match to Reference Screenshot) */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{
          padding: '4px 10px',
          borderRadius: '4px',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(0, 230, 118, 0.25)',
          color: 'var(--accent-emerald)',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          letterSpacing: '0.5px',
        }}>
          60 FPS
        </div>
      </div>
    </header>
  );
};
