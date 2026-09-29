import React, { useEffect } from 'react';
import type { SceneId } from '../types/telemetry';
import { HelpCircle, HardDrive } from 'lucide-react';

interface HeaderProps {
  onSelectScene: (scene: SceneId) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenOnboarding: () => void;
  backendConnected?: boolean;
  backendPingMs?: number;
  memoryMb?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onSelectScene,
  isSidebarOpen: _isSidebarOpen,
  onToggleSidebar,
  onOpenOnboarding,
  backendConnected = false,
  backendPingMs = 0,
  memoryMb = 3.2616,
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
            FoveaGrid 2.5D
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

      {/* Right: Clean Memory Proof + Live Backend Link + Onboarding */}
      <div className="flex items-center gap-3">
        {/* Live Backend Connection Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono">
          <div className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="text-slate-600 font-medium">
            {backendConnected ? `API:8000 LIVE (${backendPingMs}ms)` : 'API: STANDBY'}
          </span>
        </div>

        {/* The 3.26 MB Invariant Badge */}
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono">
          <HardDrive size={13} className="text-slate-600" />
          <span className="text-slate-500 font-medium">Memory:</span>
          <strong className="text-slate-900 font-bold">{memoryMb.toFixed(4)} MB</strong>
          <span className="text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200/80">
            O(1) Bound
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
