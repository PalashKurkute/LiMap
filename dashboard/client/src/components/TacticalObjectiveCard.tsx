import React, { useState } from 'react';
import type { SceneId, CameraViewMode, ColorMapMode, TelemetryData, BaselineMetrics, RenderMode } from '../types/telemetry';
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
  renderMode?: RenderMode;
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
  renderMode = 'concept',
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  return (
    <div data-region="scene-card" className="pointer-events-auto w-80 max-w-full bg-panel/95 backdrop-blur-md border border-line/90 rounded-2xl shadow-lg text-fg transition-all select-none overflow-hidden">
      {/* Header with Status Pulse and Collapse Button */}
      <div className="px-3.5 py-2.5 border-b border-line flex items-center justify-between bg-subtle/70">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-good animate-pulse" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-fg">
            {sceneId === 'scene_a_bridge' && 'Bridge Underpass'}
            {sceneId === 'scene_b_potholes' && 'Potholes & Craters'}
            {sceneId === 'scene_c_moving' && 'Moving Traffic'}
            {sceneId === 'scene_d_poles' && 'Thin Slalom Poles'}
            {sceneId === 'real_seq08_f00' && 'SemanticKITTI 64-Beam'}
          </span>
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded text-fg-muted hover:text-fg-2 hover:bg-line/60 transition-colors"
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
              <div className="flex flex-wrap justify-between items-baseline gap-x-2 gap-y-1">
                <span className="text-xs font-bold text-fg">Proof: Bridge Clearance</span>
                <span className="text-[10px] font-mono font-bold text-fg-2 bg-subtle px-1.5 py-0.2 rounded border border-line-strong">
                  {tacticalSummary?.min_clearance_m != null ? `MIN CLEARANCE ${tacticalSummary.min_clearance_m} m` : 'NO CLEARANCE DATA'}
                </span>
              </div>

              {/* Clean Schematic without cluttered text inside SVG */}
              <div className="h-20 bg-subtle rounded-lg p-2 relative flex items-center justify-center border border-line-strong">
                <span className="absolute right-1.5 top-1 font-mono text-[8px] uppercase tracking-wider text-fg-muted">diagram</span>
                <svg viewBox="0 0 200 60" className="w-full h-full">
                  <rect x="40" y="8" width="120" height="8" rx="2" className="fill-viz-baseline" />
                  <rect x="40" y="16" width="8" height="34" className="fill-scene-prop" />
                  <rect x="152" y="16" width="8" height="34" className="fill-scene-prop" />
                  <line x1="10" y1="50" x2="190" y2="50" className="stroke-scene-track" strokeWidth="2.5" />
                  <rect x="75" y="32" width="30" height="18" rx="2" className="fill-accent" />
                  {/* Clearance Indicator Arrow */}
                  <line x1="125" y1="16" x2="125" y2="50" className="stroke-accent" strokeWidth="1.5" />
                  <polygon points="125,16 123,20 127,20" className="fill-accent" />
                  <polygon points="125,50 123,46 127,46" className="fill-accent" />
                </svg>
              </div>

              {/* Simple Data Comparison */}
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                <div className="bg-critical-bg text-critical-fg p-1.5 rounded border border-critical-line flex flex-col">
                  <span className="text-[9px] uppercase text-critical-fg font-bold">Standard 2D Grid</span>
                  <span className="font-bold">Blind to Overhangs</span>
                </div>
                <div className="bg-good-bg text-good-fg p-1.5 rounded border border-good-line flex flex-col">
                  <span className="text-[9px] uppercase text-good-fg font-bold">2.5D LiMap</span>
                  <span className="font-bold">
                    {tacticalSummary?.min_clearance_m != null 
                      ? `${tacticalSummary.min_clearance_m} m min clearance`
                      : 'no overhang recorded'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {sceneId === 'scene_b_potholes' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap justify-between items-baseline gap-x-2 gap-y-1">
                <span className="text-xs font-bold text-fg">Proof: Negative Obstacles</span>
                <span className="text-[10px] font-mono font-bold text-fg-2 bg-subtle px-1.5 py-0.2 rounded border border-line-strong">
                  {tacticalSummary?.max_variance_m2 != null ? `MAX VARIANCE ${tacticalSummary.max_variance_m2} m²` : 'NO VARIANCE DATA'}
                </span>
              </div>

              {/* Clean Waveform without cluttered text */}
              <div className="h-20 bg-subtle rounded-lg p-2 relative flex items-center justify-center border border-line-strong">
                <span className="absolute right-1.5 top-1 font-mono text-[8px] uppercase tracking-wider text-fg-muted">diagram</span>
                <svg viewBox="0 0 200 60" className="w-full h-full">
                  <line x1="10" y1="20" x2="190" y2="20" className="stroke-scene-prop-2" strokeWidth="1" strokeDasharray="3,2" />
                  <path
                    d="M 10 20 L 40 20 Q 60 20 70 48 Q 80 54 90 48 Q 100 20 120 20 Q 135 20 145 44 Q 152 48 160 44 Q 170 20 190 20"
                    fill="none"
                    strokeWidth="2.2" className="stroke-critical" />
                  <path d="M 60 20 Q 70 48 80 54 Q 90 48 100 20 Z" className="fill-critical/25" />
                  <path d="M 135 20 Q 145 44 152 48 Q 160 44 170 20 Z" className="fill-critical/25" />
                </svg>
              </div>

              {/* Simple Data Comparison */}
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                <div className="bg-critical-bg text-critical-fg p-1.5 rounded border border-critical-line flex flex-col">
                  <span className="text-[9px] uppercase text-critical-fg font-bold">Standard 2D Grid</span>
                  <span className="font-bold">Variance Blind</span>
                </div>
                <div className="bg-good-bg text-good-fg p-1.5 rounded border border-good-line flex flex-col">
                  <span className="text-[9px] uppercase text-good-fg font-bold">2.5D LiMap</span>
                  <span className="font-bold">
                    {tacticalSummary?.max_variance_m2 != null
                      ? `max variance ${tacticalSummary.max_variance_m2} m²`
                      : 'no variance data'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {sceneId === 'scene_c_moving' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap justify-between items-baseline gap-x-2 gap-y-1">
                <span className="text-xs font-bold text-fg">Proof: Moving Object Filter</span>
                <span className="text-[10px] font-mono font-bold text-fg-2 bg-subtle px-1.5 py-0.2 rounded border border-line-strong">
                  {tacticalSummary?.mos_active ? 'DYNAMIC CELLS PRESENT' : 'NO DYNAMIC CELLS'}
                </span>
              </div>

              <div className="h-20 bg-subtle rounded-lg p-2 relative flex items-center justify-around border border-line-strong">
                <span className="absolute right-1.5 top-1 font-mono text-[8px] uppercase tracking-wider text-fg-muted">diagram</span>
                <svg viewBox="0 0 200 60" className="w-full h-full">
                  <line x1="20" y1="45" x2="180" y2="45" className="stroke-scene-prop" strokeWidth="2" />
                  <rect x="50" y="25" width="35" height="18" rx="2" className="fill-accent" />
                  <line x1="90" y1="34" x2="150" y2="34" className="stroke-scene-track" strokeWidth="2.5" />
                  <polygon points="150,34 142,30 142,38" className="fill-scene-track" />
                  <circle cx="160" cy="34" r="3" className="fill-scene-track" />
                </svg>
              </div>

              {/* Simple Data Comparison */}
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                <div className="bg-critical-bg text-critical-fg p-1.5 rounded border border-critical-line flex flex-col">
                  <span className="text-[9px] uppercase text-critical-fg font-bold">Temporal Grids</span>
                  <span className="font-bold">Decay Ghosting</span>
                </div>
                <div className="bg-good-bg text-good-fg p-1.5 rounded border border-good-line flex flex-col">
                  <span className="text-[9px] uppercase text-good-fg font-bold">2.5D LiMap</span>
                  <span className="font-bold">
                    {tacticalSummary?.mos_active ? 'dynamic cells flagged' : 'no dynamic cells'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {sceneId === 'scene_d_poles' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap justify-between items-baseline gap-x-2 gap-y-1">
                <span className="text-xs font-bold text-fg">Proof: Variable Resolution</span>
                <span className="text-[10px] font-mono font-bold text-fg-2 bg-subtle px-1.5 py-0.2 rounded border border-line-strong">
                  {tacticalSummary?.core_res_m != null ? `${tacticalSummary.core_res_m * 100} cm CORE CELLS` : 'NO RESOLUTION DATA'}
                </span>
              </div>

              <div className="h-20 bg-subtle rounded-lg p-2 relative flex items-center justify-center border border-line-strong">
                <span className="absolute right-1.5 top-1 font-mono text-[8px] uppercase tracking-wider text-fg-muted">diagram</span>
                <svg viewBox="0 0 200 60" className="w-full h-full">
                  <circle cx="100" cy="30" r="14" fill="none" strokeWidth="1.5" className="stroke-scene-track" />
                  <circle cx="100" cy="30" r="26" fill="none" strokeWidth="1.2" strokeDasharray="3,2" className="stroke-accent" />
                  <circle cx="100" cy="30" r="40" fill="none" strokeWidth="1" strokeDasharray="4,3" className="stroke-viz-baseline" />
                  {/* Bollards */}
                  <circle cx="85" cy="30" r="3" className="fill-scene-pole" />
                  <circle cx="115" cy="24" r="3" className="fill-scene-pole" />
                  <circle cx="100" cy="42" r="3" className="fill-scene-pole" />
                </svg>
              </div>

              {/* Simple Data Comparison */}
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                <div className="bg-critical-bg text-critical-fg p-1.5 rounded border border-critical-line flex flex-col">
                  <span className="text-[9px] uppercase text-critical-fg font-bold">Fixed Resolution</span>
                  <span className="font-bold">Misses Thin Objects</span>
                </div>
                <div className="bg-good-bg text-good-fg p-1.5 rounded border border-good-line flex flex-col">
                  <span className="text-[9px] uppercase text-good-fg font-bold">2.5D LiMap</span>
                  <span className="font-bold">
                    {tacticalSummary?.core_res_m != null ? `${tacticalSummary.core_res_m * 100} cm finest cells` : 'no resolution data'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {sceneId === 'real_seq08_f00' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap justify-between items-baseline gap-x-2 gap-y-1">
                <span className="text-xs font-bold text-fg">Proof: Deterministic Memory</span>
                <span className="text-[10px] font-mono font-bold text-fg-2 bg-subtle px-1.5 py-0.2 rounded border border-line-strong">
                  {baselines ? `${baselines.reduction_vs_3d} CAPACITY` : 'NO BASELINE DATA'}
                </span>
              </div>

              {/* Simple Data Comparison (capacity figures are calculated; see Evidence) */}
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                <div className="bg-critical-bg text-critical-fg p-1.5 rounded border border-critical-line flex flex-col">
                  <span className="text-[9px] uppercase text-critical-fg font-bold">Dense 3D Voxel (calc.)</span>
                  <span className="font-bold">{baselines ? `${baselines.dense_3d_voxel_mb.toFixed(1)} MB` : 'n/a'}</span>
                </div>
                <div className="bg-good-bg text-good-fg p-1.5 rounded border border-good-line flex flex-col">
                  <span className="text-[9px] uppercase text-good-fg font-bold">2.5D LiMap</span>
                  <span className="font-bold">{memoryMb.toFixed(4)} MB fixed pool</span>
                </div>
              </div>
            </div>
          )}

          {/* 2. INTEGRATED VIEW & PERSPECTIVE CONTROLS */}
          <div className="pt-2 border-t border-line flex flex-col gap-2">
            {/* Camera Perspective */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-fg-2 uppercase flex items-center gap-1 font-mono">
                <Camera size={11} className="text-fg-muted" />
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
                        ? 'bg-accent text-accent-on shadow-2xs'
                        : 'bg-subtle text-fg-2 hover:bg-line/70'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Shading Metric */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-fg-2 uppercase flex items-center gap-1 font-mono">
                <Palette size={11} className="text-fg-muted" />
                <span>Color:</span>
              </span>
              <div className="flex gap-1">
                {(renderMode === 'pipeline'
                  ? [
                      { id: 'elevation', label: 'Height' },
                      { id: 'semantics', label: 'Class' },
                      { id: 'ring', label: 'Ring' },
                      { id: 'variance', label: 'Var.' },
                    ]
                  : [
                      { id: 'elevation', label: 'Height' },
                      { id: 'traversability', label: 'Slope' },
                      { id: 'uncertainty', label: 'Lateral' },
                    ]
                ).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onColorModeChange?.(s.id as ColorMapMode)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
                      colorMode === s.id
                        ? 'bg-accent text-accent-on shadow-2xs'
                        : 'bg-subtle text-fg-2 hover:bg-line/70'
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
