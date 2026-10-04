import React, { useEffect } from 'react';
import type { SceneId } from '../types/telemetry';
import { HelpCircle, HardDrive, Moon, Sun } from 'lucide-react';
import { POOL_MB } from '../lib/constants';
import { toggleTheme, useTheme } from '../theme/theme';

interface HeaderProps {
  onSelectScene: (scene: SceneId) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenOnboarding: () => void;
  backendConnected?: boolean;
  backendPingMs?: number;
  memoryMb?: number;
  currentView?: 'hook_3d' | 'data_inspection';
  onViewChange?: (view: 'hook_3d' | 'data_inspection') => void;
}

const VIEWS: { id: 'hook_3d' | 'data_inspection'; label: string }[] = [
  { id: 'hook_3d', label: '3D Explore' },
  { id: 'data_inspection', label: 'Map Inspector' },
];

export const Header: React.FC<HeaderProps> = ({
  onSelectScene,
  isSidebarOpen: _isSidebarOpen,
  onToggleSidebar,
  onOpenOnboarding,
  backendConnected = false,
  backendPingMs = 0,
  memoryMb = POOL_MB,
  currentView = 'hook_3d',
  onViewChange,
}) => {
  const { theme } = useTheme();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === '1') onSelectScene('scene_a_bridge');
      else if (e.key === '2') onSelectScene('scene_b_potholes');
      else if (e.key === '3') onSelectScene('scene_c_moving');
      else if (e.key === '4') onSelectScene('scene_d_poles');
      else if (e.key === '5') onSelectScene('real_seq08_f00');
      else if (e.key === 'T') toggleTheme(); // Shift+T
      else if (e.key === 't') onToggleSidebar();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectScene, onToggleSidebar]);

  return (
    <header
      data-region="header"
      className="h-13 shrink-0 bg-panel border-b border-line px-4 flex items-center justify-between gap-3 z-30 select-none"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-sm font-bold tracking-tight text-fg whitespace-nowrap">LiMap</span>
        <span className="text-[10px] font-mono font-bold bg-accent text-accent-on px-1.5 py-0.5 rounded">2.5D</span>
        <span className="hidden xl:inline text-xs text-fg-muted font-medium truncate">
          Adaptive LiDAR perception · SIH26053
        </span>
      </div>

      <nav aria-label="Views" className="flex items-center bg-subtle p-1 rounded-xl border border-line text-xs">
        {VIEWS.map((v) => {
          const active = currentView === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onViewChange?.(v.id)}
              aria-current={active ? 'page' : undefined}
              className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap transition-all ${
                active ? 'bg-accent text-accent-on shadow-xs' : 'text-fg-2 hover:text-fg'
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 bg-subtle border border-line rounded-lg text-xs font-mono"
          title={backendConnected ? 'Backend API reachable' : 'Backend API not reachable'}
        >
          <span className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-good' : 'bg-warn'}`} aria-hidden="true" />
          <span className="text-fg-2 font-medium whitespace-nowrap">
            {backendConnected ? `API online (${backendPingMs}ms)` : 'API offline'}
          </span>
        </div>

        <div className="hidden xl:flex items-center gap-2 px-3 py-1 bg-subtle border border-line rounded-lg text-xs font-mono">
          <HardDrive size={13} className="text-fg-2" />
          <span className="text-fg-muted font-medium">Pool</span>
          <strong className="text-fg font-bold tabular-nums">{memoryMb.toFixed(4)} MB</strong>
        </div>

        <button
          onClick={toggleTheme}
          aria-pressed={theme === 'dark'}
          aria-label={theme === 'dark' ? 'Dark theme (switch to light)' : 'Light theme (switch to dark)'}
          title="Toggle light / dark theme (Shift+T)"
          className="p-2 rounded-lg border border-line-strong bg-subtle text-fg-2 hover:text-fg hover:bg-line transition-colors"
        >
          {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
        </button>

        <button
          onClick={onOpenOnboarding}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent/90 text-accent-on text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95 whitespace-nowrap"
          title="Open the guided walkthrough"
        >
          <HelpCircle size={14} />
          <span className="hidden lg:inline">Walkthrough</span>
        </button>
      </div>
    </header>
  );
};
