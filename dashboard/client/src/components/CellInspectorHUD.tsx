import React from 'react';
import { Crosshair } from 'lucide-react';

export interface CellHoverInfo {
  x: number;
  y: number;
  zGround: number;
  zCeiling: number | null;
  clearance: number | null;
  variance: number;
  tier: string;
  isOverhang: boolean;
  isCrater: boolean;
}

interface CellInspectorHUDProps {
  info: CellHoverInfo | null;
}

export const CellInspectorHUD: React.FC<CellInspectorHUDProps> = ({ info }) => {
  if (!info) return null;

  return (
    <div className="absolute bottom-12 left-4 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-3 shadow-2xl text-white font-mono text-xs w-72 select-none pointer-events-none transition-all animate-in fade-in duration-100">
      <div className="flex items-center justify-between border-b border-slate-700/70 pb-1.5 mb-2">
        <div className="flex items-center gap-1.5 text-sky-400 font-bold text-[11px]">
          <Crosshair size={13} />
          <span>2.5D CELL INSPECTOR</span>
        </div>
        <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
          64 B Cell
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-[11px] mb-2">
        <div className="bg-slate-800/80 p-1.5 rounded border border-slate-700/60">
          <span className="text-[9px] text-slate-400 block">COORDINATE</span>
          <span className="font-bold text-slate-200">
            X: {info.x.toFixed(2)}m
          </span>
        </div>
        <div className="bg-slate-800/80 p-1.5 rounded border border-slate-700/60">
          <span className="text-[9px] text-slate-400 block">LATERAL Y</span>
          <span className="font-bold text-slate-200">
            Y: {info.y.toFixed(2)}m
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1 text-[11px] mb-2">
        <div className="flex justify-between items-center bg-slate-800/60 px-2 py-1 rounded">
          <span className="text-slate-400">Ground Z (min):</span>
          <strong className="text-emerald-400">{info.zGround.toFixed(2)} m</strong>
        </div>

        {info.isOverhang && info.zCeiling !== null && (
          <>
            <div className="flex justify-between items-center bg-slate-800/60 px-2 py-1 rounded">
              <span className="text-slate-400">Canopy Z (max):</span>
              <strong className="text-amber-400">+{info.zCeiling.toFixed(2)} m</strong>
            </div>
            <div className="flex justify-between items-center bg-sky-950/80 border border-sky-800/80 px-2 py-1 rounded text-sky-300">
              <span>Overhang Clearance:</span>
              <strong className="font-bold text-sky-200">{info.clearance?.toFixed(2)} m [SAFE]</strong>
            </div>
          </>
        )}

        {info.isCrater && (
          <div className="flex justify-between items-center bg-rose-950/80 border border-rose-800/80 px-2 py-1 rounded text-rose-300">
            <span>Negative Depth:</span>
            <strong className="font-bold text-rose-200">{(info.zGround - (-1.73)).toFixed(2)} m [CRATER]</strong>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
        <span>Fovea: <strong className="text-slate-200">{info.tier}</strong></span>
        <span>Variance: <strong className="text-slate-200">σ² = {info.variance.toFixed(4)}</strong></span>
      </div>
    </div>
  );
};
