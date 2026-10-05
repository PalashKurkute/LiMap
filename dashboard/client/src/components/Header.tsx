import { HelpTip } from '../ui/HelpTip';
import React, { useEffect } from 'react';
import type { DataSource, SceneId, SnapshotMeta } from '../types/telemetry';
import type { SceneStatus } from '../data/useSceneData';
import { Database, Moon, SlidersHorizontal, Sun } from 'lucide-react';
import { TourLauncher } from '../tour/TourLauncher';
import LogoMark from '../brand/LogoMark';
import { sceneByKey } from '../data/scenes';
import { isAppScope } from '../lib/keyScope';
import { toggleTheme, useTheme } from '../theme/theme';
import type { AppView } from '../state/AppActions';

export type { AppView };

interface HeaderProps {
  onSelectScene: (scene: SceneId) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  dataSource?: DataSource | null;
  dataStatus?: SceneStatus;
  snapshotMeta?: SnapshotMeta | null;
  currentView?: AppView;
  onViewChange?: (view: AppView) => void;
}

const VIEWS: { id: AppView; label: string }[] = [
  { id: 'hook_3d', label: '3D Explore' },
  { id: 'data_inspection', label: 'Map Inspector' },
  { id: 'evidence', label: 'Evidence' },
];

export const Header: React.FC<HeaderProps> = ({
  onSelectScene,
  isSidebarOpen,
  onToggleSidebar,
  dataSource = null,
  dataStatus = 'loading',
  snapshotMeta = null,
  currentView = 'hook_3d',
  onViewChange,
}) => {
  const { theme } = useTheme();

  // Global shortcuts: 1-5 pick a scene, T toggles the Controls drawer, Shift+T toggles the theme.
  // They only fire while the main app owns the keyboard (not during the tour or a dialog).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !isAppScope()) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const scene = sceneByKey(e.key);
      if (scene) onSelectScene(scene.id);
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
        <a
          href="/"
          title="Home"
          aria-label="LiMap home"
          className="flex items-center gap-2 rounded-md text-sm font-bold tracking-tight text-fg whitespace-nowrap hover:text-accent-text"
        >
          <LogoMark size={26} />
          <span>LiMap</span>
        </a>
        <span className="text-[10px] font-mono font-bold bg-accent text-accent-on px-1.5 py-0.5 rounded">2.5D</span>
        <span className="hidden xl:inline text-xs text-fg-muted font-medium truncate">
          Adaptive variable-resolution LiDAR mapping
        </span>
      </div>

      <nav data-tour="views" aria-label="Views" className="flex items-center bg-subtle p-1 rounded-xl border border-line text-xs">
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
          data-region="data-source"
          data-tour="data-source"
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-subtle border border-line rounded-lg text-xs font-mono"
          title={
            dataSource && snapshotMeta
              ? `Source: ${
                  dataSource === 'live' ? 'live API' : dataSource === 'upload' ? 'a scan you analysed here, kept in this tab only' : 'precomputed pipeline snapshot'
                } · generated ${snapshotMeta.generated_at.slice(0, 10)} · commit ${snapshotMeta.git_sha} · labels: ${snapshotMeta.label_source}`
              : 'No scene data loaded'
          }
        >
          <Database size={13} className="text-fg-2" aria-hidden="true" />
          <span className="text-fg-2 font-medium whitespace-nowrap">
            {dataSource === 'live'
              ? 'Live API'
              : dataSource === 'upload'
                ? 'Your upload'
                : dataSource === 'snapshot' && snapshotMeta
                  ? `Snapshot · ${snapshotMeta.generated_at.slice(0, 10)}`
                  : dataStatus === 'loading'
                    ? 'Loading…'
                    : 'No scene data'}
          </span>
          <HelpTip topic="data-source" />
        </div>

        <button
          data-tour="controls-button"
          onClick={onToggleSidebar}
          aria-expanded={isSidebarOpen}
          aria-controls="controls-drawer"
          title="Controls (T)"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
            isSidebarOpen
              ? 'bg-accent-subtle border-accent text-accent-text'
              : 'bg-subtle border-line-strong text-fg-2 hover:text-fg hover:bg-line'
          }`}
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          <span className="hidden lg:inline">Controls</span>
        </button>

        <button
          data-tour="theme"
          onClick={toggleTheme}
          aria-pressed={theme === 'dark'}
          aria-label={theme === 'dark' ? 'Dark theme (switch to light)' : 'Light theme (switch to dark)'}
          title="Toggle light / dark theme (Shift+T)"
          className="p-2 rounded-lg border border-line-strong bg-subtle text-fg-2 hover:text-fg hover:bg-line transition-colors"
        >
          {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
        </button>

        <TourLauncher showNudge={currentView === 'hook_3d'} />
      </div>
    </header>
  );
};
