import React, { useEffect } from 'react';
import type { SceneId } from '../types/telemetry';
import { HelpCircle, HardDrive, Sparkles } from 'lucide-react';

interface HeaderProps {
  onSelectScene: (scene: SceneId) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenOnboarding: () => void;
  onOpenMatrixGuide?: () => void;
  backendConnected?: boolean;
  backendPingMs?: number;
  memoryMb?: number;
  currentView?: 'hook_3d' | 'data_inspection';
  onViewChange?: (view: 'hook_3d' | 'data_inspection') => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSelectScene,
  isSidebarOpen: _isSidebarOpen,
  onToggleSidebar,
  onOpenOnboarding,
  onOpenMatrixGuide,
  backendConnected = false,
  backendPingMs = 0,
  memoryMb = 3.2616,
  currentView = 'hook_3d',
  onViewChange,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '1') onSelectScene('scene_a_bridge');
      else if (e.key === '2') onSelectScene('scene_b_potholes');
      else if (e.key === '3') onSelectScene('scene_c_moving');
      else if (e.key === '4') onSelectScene('scene_d_poles');
      else if (e.key === '5') onSelectScene('real_seq08_f00');
      else if (e.key === 't' || e.key === 'T') onToggleSidebar();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectScene, onToggleSidebar]);

  return (
    <header className="h-11 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 flex items-center justify-between z-30 select-none whitespace-nowrap shrink-0">
      {/* Left: Brand + Status */}
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="text-xs font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
          <span>LiMap 2.5D</span>
          <span className="text-[9px] font-mono font-bold bg-slate-900 text-white px-1.5 py-0.2 rounded tracking-wide">
            2.5D DEM
          </span>
        </span>
        <span className="text-slate-300 text-xs font-normal">|</span>
        <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
          Adaptive LiDAR Perception &bull; DRDO SIH26053
        </span>
      </div>

      {/* Center: Sleek & Broadened Segmented Switcher (3D Mission vs Data Matrix) */}
      <nav className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/90 text-xs font-mono shrink-0 gap-1 shadow-2xs">
        <button
          onClick={() => onViewChange?.('hook_3d')}
          className={`flex items-center gap-1.5 px-4 py-1 rounded-lg font-semibold transition-all ${
            currentView === 'hook_3d'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
          title="Switch to 3D Cinematic Mission Control (Homepage)"
        >
          <span>1. 3D Mission</span>
        </button>
        <button
          onClick={() => onViewChange?.('data_inspection')}
          className={`flex items-center gap-2 px-4 py-1 rounded-lg font-semibold transition-all ${
            currentView === 'data_inspection'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
          title="Switch to Data-Inspection Matrix (Real Proofs Page)"
        >
          <span>2. Data Matrix</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
        </button>
      </nav>

      {/* Right: Low-Profile Telemetry Badges + Judge Walkthrough */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Live Backend Connection Indicator */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 border border-slate-200/80 rounded-md text-[11px] font-mono">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${backendConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="text-slate-600 font-medium">
            {backendConnected ? `LIVE (${backendPingMs}ms)` : 'API STANDBY'}
          </span>
        </div>

        {/* 3.26 MB O(1) Invariant Badge */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100/80 border border-slate-200/80 rounded-md text-[11px] font-mono">
          <HardDrive size={11} className="text-slate-500 shrink-0" />
          <strong className="text-slate-900 font-bold">{memoryMb.toFixed(2)} MB</strong>
          <span className="text-[9px] text-slate-500 bg-white px-1 py-0.2 rounded border border-slate-200/80">
            O(1)
          </span>
        </div>

        {/* Top-Right Open Guide Trigger */}
        {currentView === 'data_inspection' ? (
          <button
            onClick={onOpenMatrixGuide}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold rounded-md shadow-2xs transition-all active:scale-95 border border-slate-800"
            title="Open interactive 4-step walkthrough for 2.5D Data Matrix"
          >
            <Sparkles size={12} className="text-amber-400 shrink-0" />
            <span>Open Guide</span>
            <span className="text-[9px] bg-slate-800 text-slate-200 border border-slate-700 px-1.5 py-0.2 rounded font-mono font-bold">
              4 Steps
            </span>
          </button>
        ) : (
          <button
            onClick={onOpenOnboarding}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold rounded-md shadow-2xs transition-all active:scale-95"
            title="Open interactive architectural walkthrough for DRDO evaluators"
          >
            <HelpCircle size={12} className="shrink-0" />
            <span>Open Guide</span>
          </button>
        )}
      </div>
    </header>
  );
};
