import React, { useEffect } from 'react';
import type { SceneId } from '../types/telemetry';
import { HelpCircle, HardDrive } from 'lucide-react';
import { POOL_MB } from '../lib/constants';

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
    <header className="h-13 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30 select-none">
      {/* Left: Brand + Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold tracking-tight text-slate-900">
            LiMap 2.5D
          </span>
          <span className="text-[10px] font-mono font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded">
            2.5D DEM
          </span>
          <span className="text-xs text-slate-400 font-normal">|</span>
          <span className="text-xs text-slate-600 font-medium">
            Adaptive LiDAR Perception for DRDO SIH26053
          </span>
        </div>
      </div>

      {/* Center: Two-Tier Architecture Switcher (Hook vs Data Inspection) */}
      <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-mono">
        <button
          onClick={() => onViewChange?.('hook_3d')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
            currentView === 'hook_3d'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>1. 3D Hook (Cinematic)</span>
        </button>
        <button
          onClick={() => onViewChange?.('data_inspection')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
            currentView === 'data_inspection'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>2. Data-Inspection Matrix (Real Proofs)</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        </button>
      </div>

      {/* Right: Clean Memory Proof + Live Backend Link + Onboarding */}
      <div className="flex items-center gap-3">
        {/* Live Backend Connection Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono">
          <div className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="text-slate-600 font-medium">
            {backendConnected ? `API online (${backendPingMs}ms)` : 'API offline'}
          </span>
        </div>

        {/* The 3.26 MB Invariant Badge */}
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono">
          <HardDrive size={13} className="text-slate-600" />
          <span className="text-slate-500 font-medium">Memory:</span>
          <strong className="text-slate-900 font-bold">{memoryMb.toFixed(4)} MB</strong>
          <span className="text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200/80">
            Fixed pool
          </span>
        </div>


        {/* Guided Walkthrough For Judge */}
        <button
          onClick={onOpenOnboarding}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95"
          title="Open interactive architectural walkthrough for DRDO evaluators"
        >
          <HelpCircle size={14} />
          <span>Judge Walkthrough</span>
        </button>
      </div>
    </header>
  );
};
