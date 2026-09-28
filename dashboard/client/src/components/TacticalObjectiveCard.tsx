import React, { useState } from 'react';
import type { SceneId, CameraViewMode, ColorMapMode } from '../types/telemetry';
import {
  ChevronDown,
  ChevronUp,
  Camera,
  Palette,
} from 'lucide-react';

interface TacticalObjectiveCardProps {
  sceneId: SceneId;
  memoryMb?: number;
  cameraMode?: CameraViewMode;
  onCameraModeChange?: (mode: CameraViewMode) => void;
  colorMode?: ColorMapMode;
  onColorModeChange?: (mode: ColorMapMode) => void;
}

export const TacticalObjectiveCard: React.FC<TacticalObjectiveCardProps> = ({
  sceneId,
  memoryMb = 3.2616,
  cameraMode = 'orbit',
  onCameraModeChange,
  colorMode = 'elevation',
  onColorModeChange,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  return (
    <div className="absolute top-4 left-4 z-20 w-84 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg text-slate-800 transition-all select-none overflow-hidden">
      {/* Header with Status Pulse and Collapse Button */}
      <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-800">
            {sceneId === 'scene_a_bridge' && 'Bridge Underpass'}
            {sceneId === 'scene_b_potholes' && 'Potholes & Craters'}
            {sceneId === 'scene_c_moving' && 'Moving Traffic'}
            {sceneId === 'scene_d_poles' && 'Thin Slalom Poles'}
            {sceneId === 'real_seq08_f00' && 'SemanticKITTI 64-Beam'}
          </span>
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          title={isCollapsed ? 'Expand Panel' : 'Collapse Panel'}
        >
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="p-3 flex flex-col gap-2.5">
          {/* 1. SCENARIO PROOF & CLEAN TEXT-FREE DIAGRAM */}
          {sceneId === 'scene_a_bridge' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-slate-900">Bridge Clearance</span>
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  2.53m PASS
                </span>
              </div>

              {/* Clean Schematic without cluttered text inside SVG */}
              <div className="h-20 bg-slate-900 rounded-lg p-2 relative flex items-center justify-center border border-slate-800">
                <svg viewBox="0 0 200 60" className="w-full h-full">
                  <rect x="40" y="8" width="120" height="8" rx="2" fill="#64748b" />
                  <rect x="40" y="16" width="8" height="34" fill="#334155" />
                  <rect x="152" y="16" width="8" height="34" fill="#334155" />
                  <line x1="10" y1="50" x2="190" y2="50" stroke="#10b981" strokeWidth="2.5" />
                  <rect x="75" y="32" width="30" height="18" rx="2" fill="#0284c7" />
                  {/* Clearance Indicator Arrow */}
                  <line x1="125" y1="16" x2="125" y2="50" stroke="#00f0ff" strokeWidth="1.5" />
                  <polygon points="125,16 123,20 127,20" fill="#00f0ff" />
                  <polygon points="125,50 123,46 127,46" fill="#00f0ff" />
                </svg>
              </div>

              <div className="flex justify-between text-[11px] font-mono text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-200/80">
                <span>Standard 2D: <strong className="text-rose-600">Blocked</strong></span>
                <span>2.5D: <strong className="text-emerald-700">2.53m Clear</strong></span>
              </div>
            </div>
          )}

          {sceneId === 'scene_b_potholes' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-slate-900">Crater Depth &amp; Hazard</span>
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  3/3 AVOIDED
                </span>
              </div>

              {/* Clean Waveform without cluttered text */}
              <div className="h-20 bg-slate-900 rounded-lg p-2 relative flex items-center justify-center border border-slate-800">
                <svg viewBox="0 0 200 60" className="w-full h-full">
                  <line x1="10" y1="20" x2="190" y2="20" stroke="#475569" strokeWidth="1" strokeDasharray="3,2" />
                  <path
                    d="M 10 20 L 40 20 Q 60 20 70 48 Q 80 54 90 48 Q 100 20 120 20 Q 135 20 145 44 Q 152 48 160 44 Q 170 20 190 20"
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="2.2"
                  />
                  <path d="M 60 20 Q 70 48 80 54 Q 90 48 Q 100 20 Z" fill="rgba(244, 63, 94, 0.25)" />
                  <path d="M 135 20 Q 145 44 152 48 Q 160 44 Q 170 20 Z" fill="rgba(244, 63, 94, 0.25)" />
                </svg>
              </div>

              <div className="flex justify-between text-[11px] font-mono text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-200/80">
                <span>Crater Depth: <strong className="text-rose-600">-55 cm</strong></span>
                <span>Variance: <strong className="text-slate-900">σ² = 0.080</strong></span>
              </div>
            </div>
          )}

          {sceneId === 'scene_c_moving' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-slate-900">Anti-Ghosting (MOS)</span>
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  0.00s GHOST LAG
                </span>
              </div>

              <div className="h-20 bg-slate-900 rounded-lg p-2 relative flex items-center justify-around border border-slate-800">
                <svg viewBox="0 0 200 60" className="w-full h-full">
                  <line x1="20" y1="45" x2="180" y2="45" stroke="#334155" strokeWidth="2" />
                  <rect x="50" y="25" width="35" height="18" rx="2" fill="#38bdf8" />
                  <line x1="90" y1="34" x2="150" y2="34" stroke="#10b981" strokeWidth="2.5" />
                  <polygon points="150,34 142,30 142,38" fill="#10b981" />
                  <circle cx="160" cy="34" r="3" fill="#10b981" />
                </svg>
              </div>

              <div className="flex justify-between text-[11px] font-mono text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-200/80">
                <span>Target: <strong className="text-sky-600">45 km/h</strong></span>
                <span>Ghost Persistence: <strong className="text-emerald-700">0.00 s</strong></span>
              </div>
            </div>
          )}

          {sceneId === 'scene_d_poles' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-slate-900">Slalom Resolution</span>
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  0.00% SEAM GAP
                </span>
              </div>

              <div className="h-20 bg-slate-900 rounded-lg p-2 relative flex items-center justify-center border border-slate-800">
                <svg viewBox="0 0 200 60" className="w-full h-full">
                  <circle cx="100" cy="30" r="14" fill="none" stroke="#10b981" strokeWidth="1.5" />
                  <circle cx="100" cy="30" r="26" fill="none" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="3,2" />
                  <circle cx="100" cy="30" r="40" fill="none" stroke="#64748b" strokeWidth="1" strokeDasharray="4,3" />
                  {/* Bollards */}
                  <circle cx="85" cy="30" r="3" fill="#f59e0b" />
                  <circle cx="115" cy="24" r="3" fill="#f59e0b" />
                  <circle cx="100" cy="42" r="3" fill="#f59e0b" />
                </svg>
              </div>

              <div className="flex justify-between text-[11px] font-mono text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-200/80">
                <span>Ring 0: <strong className="text-emerald-700">5 cm res</strong></span>
                <span>Seam Error: <strong className="text-slate-900">0.00%</strong></span>
              </div>
            </div>
          )}

          {sceneId === 'real_seq08_f00' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-slate-900">Memory Footprint</span>
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  99.89% SAVED
                </span>
              </div>

              <div className="h-20 bg-slate-900 rounded-lg p-2.5 relative flex flex-col justify-around border border-slate-800">
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="w-full h-full bg-rose-500 rounded-full" />
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="w-[4%] min-w-1 h-full bg-amber-400 rounded-full" />
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="w-[1.2%] min-w-1 h-full bg-emerald-400 rounded-full" />
                </div>
              </div>

              <div className="flex justify-between text-[11px] font-mono text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-200/80">
                <span>Dense 3D: <strong className="text-rose-600">3,051 MB</strong></span>
                <span>FoveaGrid: <strong className="text-emerald-700">{memoryMb.toFixed(2)} MB</strong></span>
              </div>
            </div>
          )}

          {/* 2. INTEGRATED VIEW & PERSPECTIVE CONTROLS */}
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
            {/* Camera Perspective */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1 font-mono">
                <Camera size={11} className="text-slate-500" />
                <span>Angle:</span>
              </span>
              <div className="flex gap-1">
                {[
                  { id: 'orbit', label: 'Orbit' },
                  { id: 'chase', label: 'Follow' },
                  { id: 'bev', label: 'Top' },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onCameraModeChange?.(c.id as CameraViewMode)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
                      cameraMode === c.id
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Shading Metric */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1 font-mono">
                <Palette size={11} className="text-slate-500" />
                <span>Color:</span>
              </span>
              <div className="flex gap-1">
                {[
                  { id: 'elevation', label: 'Height' },
                  { id: 'traversability', label: 'Slope' },
                  { id: 'uncertainty', label: 'Density' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onColorModeChange?.(s.id as ColorMapMode)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
                      colorMode === s.id
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
