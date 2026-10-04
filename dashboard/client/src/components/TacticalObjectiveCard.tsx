import React, { useState } from 'react';
import type { SceneId, CameraViewMode, ColorMapMode, TelemetryData, BaselineMetrics } from '../types/telemetry';
import { POOL_MB } from '../lib/constants';
import {
  ChevronDown,
  ChevronUp,
  Camera,
  Palette,
} from 'lucide-react';

interface TacticalObjectiveCardProps {
  sceneId: SceneId;
  memoryMb?: number;
  baselines?: BaselineMetrics | null;
  tacticalSummary?: TelemetryData['tactical_summary'];
  cameraMode?: CameraViewMode;
  onCameraModeChange?: (mode: CameraViewMode) => void;
  colorMode?: ColorMapMode;
  onColorModeChange?: (mode: ColorMapMode) => void;
}

export const TacticalObjectiveCard: React.FC<TacticalObjectiveCardProps> = ({
  sceneId,
  memoryMb = POOL_MB,
  baselines,
  tacticalSummary,
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
                <span className="text-xs font-bold text-slate-900">Proof: Bridge Clearance</span>
                <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-300">
                  {tacticalSummary?.min_clearance_m != null ? `MIN CLEARANCE ${tacticalSummary.min_clearance_m} m` : 'NO CLEARANCE DATA'}
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

              {/* Simple Data Comparison */}
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                <div className="bg-rose-50 text-rose-800 p-1.5 rounded border border-rose-200 flex flex-col">
                  <span className="text-[9px] uppercase text-rose-500 font-bold">Standard 2D Grid</span>
                  <span className="font-bold">Blind to Overhangs</span>
                </div>
                <div className="bg-emerald-50 text-emerald-800 p-1.5 rounded border border-emerald-200 flex flex-col">
                  <span className="text-[9px] uppercase text-emerald-600 font-bold">2.5D LiMap</span>
                  <span className="font-bold">
                    {tacticalSummary?.min_clearance_m != null 
                      ? `${tacticalSummary.min_clearance_m}m Safe ✓` 
                      : 'Scanning...'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {sceneId === 'scene_b_potholes' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-slate-900">Proof: Negative Obstacles</span>
                <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-300">
                  {tacticalSummary?.max_variance_m2 != null ? `MAX VARIANCE ${tacticalSummary.max_variance_m2} m²` : 'NO VARIANCE DATA'}
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
                  <path d="M 60 20 Q 70 48 80 54 Q 90 48 100 20 Z" fill="rgba(244, 63, 94, 0.25)" />
                  <path d="M 135 20 Q 145 44 152 48 Q 160 44 170 20 Z" fill="rgba(244, 63, 94, 0.25)" />
                </svg>
              </div>

              {/* Simple Data Comparison */}
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                <div className="bg-rose-50 text-rose-800 p-1.5 rounded border border-rose-200 flex flex-col">
                  <span className="text-[9px] uppercase text-rose-500 font-bold">Standard 2D Grid</span>
                  <span className="font-bold">Variance Blind</span>
                </div>
                <div className="bg-emerald-50 text-emerald-800 p-1.5 rounded border border-emerald-200 flex flex-col">
                  <span className="text-[9px] uppercase text-emerald-600 font-bold">2.5D LiMap</span>
                  <span className="font-bold">
                    {tacticalSummary?.max_variance_m2 != null
                      ? `Var: ${tacticalSummary.max_variance_m2}m² ✓`
                      : 'Scanning...'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {sceneId === 'scene_c_moving' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-slate-900">Proof: Moving Object Filter</span>
                <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-300">
                  {tacticalSummary?.mos_active ? 'DYNAMIC CELLS PRESENT' : 'NO DYNAMIC CELLS'}
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

              {/* Simple Data Comparison */}
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                <div className="bg-rose-50 text-rose-800 p-1.5 rounded border border-rose-200 flex flex-col">
                  <span className="text-[9px] uppercase text-rose-500 font-bold">Temporal Grids</span>
                  <span className="font-bold">Decay Ghosting</span>
                </div>
                <div className="bg-emerald-50 text-emerald-800 p-1.5 rounded border border-emerald-200 flex flex-col">
                  <span className="text-[9px] uppercase text-emerald-600 font-bold">2.5D LiMap</span>
                  <span className="font-bold">
                    {tacticalSummary?.mos_active ? 'Dynamic Trk ✓' : 'Clear ✓'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {sceneId === 'scene_d_poles' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-slate-900">Proof: Variable Resolution</span>
                <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-300">
                  {tacticalSummary?.core_res_m != null ? `${tacticalSummary.core_res_m * 100} cm CORE CELLS` : 'NO RESOLUTION DATA'}
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

              {/* Simple Data Comparison */}
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                <div className="bg-rose-50 text-rose-800 p-1.5 rounded border border-rose-200 flex flex-col">
                  <span className="text-[9px] uppercase text-rose-500 font-bold">Fixed Resolution</span>
                  <span className="font-bold">Misses Thin Objects</span>
                </div>
                <div className="bg-emerald-50 text-emerald-800 p-1.5 rounded border border-emerald-200 flex flex-col">
                  <span className="text-[9px] uppercase text-emerald-600 font-bold">2.5D LiMap</span>
                  <span className="font-bold">
                    {tacticalSummary?.core_res_m != null ? `${tacticalSummary.core_res_m * 100}cm Core Res ✓` : 'Scanning...'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {sceneId === 'real_seq08_f00' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-slate-900">Proof: Deterministic Memory</span>
                <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-300">
                  {baselines ? `${baselines.reduction_vs_3d} CAPACITY` : 'NO BASELINE DATA'}
                </span>
              </div>

              {/* Simple Data Comparison (capacity figures are calculated, see Proofs > Memory) */}
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                <div className="bg-rose-50 text-rose-800 p-1.5 rounded border border-rose-200 flex flex-col">
                  <span className="text-[9px] uppercase text-rose-500 font-bold">Dense 3D Voxel (calc.)</span>
                  <span className="font-bold">{baselines ? `${baselines.dense_3d_voxel_mb.toFixed(1)} MB` : 'n/a'}</span>
                </div>
                <div className="bg-emerald-50 text-emerald-800 p-1.5 rounded border border-emerald-200 flex flex-col">
                  <span className="text-[9px] uppercase text-emerald-600 font-bold">2.5D LiMap</span>
                  <span className="font-bold">{memoryMb.toFixed(4)} MB Bounded ✓</span>
                </div>
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
                  { id: 'uncertainty', label: 'Lateral' },
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

            {/* Dynamic Color Meaning / Legend Badge */}
            <div className="text-[10px] font-mono px-2 py-1 rounded bg-slate-100/90 text-slate-600 border border-slate-200 flex items-center justify-between">
              <span className="text-slate-500 font-semibold">Active Filter:</span>
              {colorMode === 'elevation' && (
                <span className="text-sky-700 font-bold">Turbo Height: Blue (Low) &rarr; Red (High)</span>
              )}
              {colorMode === 'traversability' && (
                <span className="text-emerald-700 font-bold">Slope: Green (Flat) &rarr; Red (Hazard)</span>
              )}
              {colorMode === 'uncertainty' && (
                <span className="text-purple-700 font-bold">Lateral distance (illustrative): Green (centre) &rarr; Violet (edge)</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
