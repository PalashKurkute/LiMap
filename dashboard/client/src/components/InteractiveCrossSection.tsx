import React, { useState } from 'react';
import type { CrossSectionResponse, CrossSectionPoint } from '../types/telemetry';
import { Layers } from 'lucide-react';

interface InteractiveCrossSectionProps {
  data: CrossSectionResponse | null;
  sceneId: string;
}

export const InteractiveCrossSection: React.FC<InteractiveCrossSectionProps> = ({ data, sceneId }) => {
  const [sliceOffset, setSliceOffset] = useState<number>(18.0); // Meters along path

  // Generate or read profile data
  const profile: CrossSectionPoint[] = data?.profile ?? Array.from({ length: 60 }, (_, i) => {
    const x = 5.0 + (i / 59) * 23.0;
    const isBridge = x >= 15.0 && x <= 25.0;
    const isPothole = sceneId === 'scene_b_potholes' && Math.abs(x - 8.0) < 0.8;
    return {
      distance_m: Number((x - 5.0).toFixed(2)),
      x: Number(x.toFixed(2)),
      y: 0.0,
      z_ground: isPothole ? -1.98 : -1.73,
      z_overhang: isBridge ? 0.77 : null,
      clearance_m: isBridge ? 2.50 : null,
      variance: 0.002,
      sem_id: isBridge ? 15 : 40,
    };
  });

  const width = 360;
  const height = 150;
  const padL = 36;
  const padR = 14;
  const padT = 16;
  const padB = 24;

  const minX = 0;
  const maxX = 25;
  const minZ = -2.4;
  const maxZ = 1.6;

  const scaleX = (d: number) => padL + ((d - minX) / (maxX - minX)) * (width - padL - padR);
  const scaleZ = (z: number) => padT + ((maxZ - z) / (maxZ - minZ)) * (height - padT - padB);

  // Active slice point
  const currentPt = profile.reduce((prev, curr) => 
    Math.abs(curr.x - sliceOffset) < Math.abs(prev.x - sliceOffset) ? curr : prev, profile[0]
  );

  return (
    <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-sm flex flex-col gap-3">
      {/* Title & Coordinates */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-slate-700" />
          <span className="text-xs font-bold tracking-tight text-slate-900 uppercase">
            Interactive Cross-Section Slicer
          </span>
        </div>
        <span className="text-[11px] font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
          X = {sliceOffset.toFixed(1)}m
        </span>
      </div>

      {/* SVG Slicer Canvas */}
      <div className="relative w-full overflow-hidden bg-slate-50 border border-slate-100 rounded-lg p-1">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto block select-none">
          {/* Elevation Reference Gridlines */}
          {[-2.0, -1.0, 0.0, 1.0].map((zVal) => {
            const yPos = scaleZ(zVal);
            return (
              <g key={zVal}>
                <line x1={padL} y1={yPos} x2={width - padR} y2={yPos} stroke="#E2E8F0" strokeDasharray="2,2" strokeWidth="1" />
                <text x={padL - 6} y={yPos + 3} fill="#94A3B8" fontSize="8" fontFamily="var(--font-mono)" textAnchor="end">
                  {zVal > 0 ? `+${zVal.toFixed(1)}` : zVal.toFixed(1)}m
                </text>
              </g>
            );
          })}

          {/* Ground Curve */}
          <path
            d={profile.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.distance_m).toFixed(1)} ${scaleZ(p.z_ground).toFixed(1)}`).join(' ')}
            fill="none"
            stroke="#0F172A"
            strokeWidth="2"
          />

          {/* Overhang Canopy (Scene A) */}
          {profile.some(p => p.z_overhang !== null) && (
            <path
              d={profile.filter(p => p.z_overhang !== null).map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.distance_m).toFixed(1)} ${scaleZ(p.z_overhang!).toFixed(1)}`).join(' ')}
              fill="none"
              stroke="#2563EB"
              strokeWidth="2.5"
            />
          )}

          {/* Dynamic Interactive Slicer Bar */}
          {currentPt && (
            <g>
              <line
                x1={scaleX(currentPt.distance_m)}
                y1={padT}
                x2={scaleX(currentPt.distance_m)}
                y2={height - padB}
                stroke="#0F172A"
                strokeWidth="1.5"
                strokeDasharray="3,2"
              />
              <circle
                cx={scaleX(currentPt.distance_m)}
                cy={scaleZ(currentPt.z_ground)}
                r="3.5"
                fill="#0F172A"
              />
              {currentPt.z_overhang !== null && (
                <>
                  <circle
                    cx={scaleX(currentPt.distance_m)}
                    cy={scaleZ(currentPt.z_overhang)}
                    r="3.5"
                    fill="#2563EB"
                  />
                  {/* Clearance Line */}
                  <line
                    x1={scaleX(currentPt.distance_m)}
                    y1={scaleZ(currentPt.z_ground)}
                    x2={scaleX(currentPt.distance_m)}
                    y2={scaleZ(currentPt.z_overhang)}
                    stroke="#2563EB"
                    strokeWidth="1.5"
                  />
                </>
              )}
            </g>
          )}
        </svg>
      </div>

      {/* Direct Manipulation Slider Control */}
      <div className="flex flex-col gap-1.5 pt-1">
        <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
          <span>DRAG SLICE PLANE:</span>
          <span className="font-semibold text-slate-800">
            Clearance: {currentPt.clearance_m ? `${currentPt.clearance_m.toFixed(2)}m (PASS)` : 'N/A (Open Sky)'}
          </span>
        </div>
        <input
          type="range"
          min={5.0}
          max={28.0}
          step={0.2}
          value={sliceOffset}
          onChange={(e) => setSliceOffset(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
        />
        <div className="flex justify-between text-[9px] font-mono text-slate-400">
          <span>5.0m (Entry)</span>
          <span>16.5m (Bridge Deck)</span>
          <span>28.0m (Exit)</span>
        </div>
      </div>
    </div>
  );
};
