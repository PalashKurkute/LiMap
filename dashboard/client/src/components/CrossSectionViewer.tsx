import React, { useState } from 'react';
import type { CrossSectionResponse, CrossSectionPoint } from '../types/telemetry';
import { Layers, ArrowDownUp, AlertTriangle, CheckCircle } from 'lucide-react';

interface CrossSectionViewerProps {
  data: CrossSectionResponse | null;
  sceneId: string;
}

export const CrossSectionViewer: React.FC<CrossSectionViewerProps> = ({ data, sceneId }) => {
  const [hoveredPt, setHoveredPt] = useState<CrossSectionPoint | null>(null);

  // Fallback synthetic cross section for Scene A Bridge if data is loading
  const profile = data?.profile ?? Array.from({ length: 60 }, (_, i) => {
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
  const height = 170;
  const padL = 36;
  const padR = 14;
  const padT = 18;
  const padB = 26;

  const minX = 0;
  const maxX = 25; // meters along profile
  const minZ = -2.4;
  const maxZ = 1.6;

  const scaleX = (d: number) => padL + ((d - minX) / (maxX - minX)) * (width - padL - padR);
  const scaleZ = (z: number) => padT + ((maxZ - z) / (maxZ - minZ)) * (height - padT - padB);

  // Generate SVG path strings
  let groundPath = '';
  let overhangPath = '';
  let overhangActive = false;

  profile.forEach((pt, i) => {
    const sx = scaleX(pt.distance_m);
    const syG = scaleZ(pt.z_ground);

    if (i === 0) groundPath += `M ${sx.toFixed(1)} ${syG.toFixed(1)}`;
    else groundPath += ` L ${sx.toFixed(1)} ${syG.toFixed(1)}`;

    if (pt.z_overhang !== null) {
      const syO = scaleZ(pt.z_overhang);
      if (!overhangActive) {
        overhangPath += `M ${sx.toFixed(1)} ${syO.toFixed(1)}`;
        overhangActive = true;
      } else {
        overhangPath += ` L ${sx.toFixed(1)} ${syO.toFixed(1)}`;
      }
    } else {
      overhangActive = false;
    }
  });

  const hasClearance = profile.some((p) => p.clearance_m !== null && p.clearance_m >= 2.0);
  const hasNegativeHazard = profile.some((p) => p.z_ground < -1.85);

  return (
    <div className="glass-panel" style={{ padding: '16px' }}>
      <div className="panel-title">
        <span>Dual-Elevation Cross-Section</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Layers size={13} style={{ color: 'var(--accent-cyan)' }} />
          <span style={{ color: 'var(--accent-cyan)' }} className="mono-val">
            X: 5.0m &rarr; 28.0m
          </span>
        </div>
      </div>

      {/* SVG Canvas Profile */}
      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          onMouseLeave={() => setHoveredPt(null)}
        >
          {/* Subtle grid lines */}
          {[-2.0, -1.0, 0.0, 1.0].map((zVal) => {
            const yPos = scaleZ(zVal);
            return (
              <g key={zVal}>
                <line
                  x1={padL}
                  y1={yPos}
                  x2={width - padR}
                  y2={yPos}
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeDasharray="2 2"
                />
                <text
                  x={padL - 4}
                  y={yPos + 3}
                  fill="var(--text-muted)"
                  fontSize="8"
                  textAnchor="end"
                  fontFamily="var(--font-mono)"
                >
                  {zVal.toFixed(1)}m
                </text>
              </g>
            );
          })}

          {/* Ego vehicle reference clearance ceiling (Z = -0.13m -> 1.6m height above road -1.73m) */}
          <line
            x1={padL}
            y1={scaleZ(-0.13)}
            x2={width - padR}
            y2={scaleZ(-0.13)}
            stroke="rgba(255, 171, 0, 0.35)"
            strokeDasharray="4 3"
          />
          <text
            x={width - padR - 2}
            y={scaleZ(-0.13) - 3}
            fill="var(--accent-amber)"
            fontSize="8"
            textAnchor="end"
            fontFamily="var(--font-mono)"
          >
            Vehicle Max Ht (1.6m)
          </text>

          {/* Ground elevation path */}
          <path
            d={groundPath}
            fill="none"
            stroke="var(--accent-emerald)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Overhang deck path (Scene A Bridge) */}
          {overhangPath && (
            <path
              d={overhangPath}
              fill="none"
              stroke="var(--accent-cyan)"
              strokeWidth="3.0"
              strokeLinecap="round"
            />
          )}

          {/* Vertical Clearance Dimension Arrow at Center Bridge (d = 15m) */}
          {hasClearance && (
            <g>
              <line
                x1={scaleX(15)}
                y1={scaleZ(-1.73)}
                x2={scaleX(15)}
                y2={scaleZ(0.77)}
                stroke="var(--accent-cyan)"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
              <circle cx={scaleX(15)} cy={scaleZ(-1.73)} r="2.5" fill="var(--accent-emerald)" />
              <circle cx={scaleX(15)} cy={scaleZ(0.77)} r="2.5" fill="var(--accent-cyan)" />
              <rect
                x={scaleX(15) + 4}
                y={scaleZ(-0.48) - 8}
                width="64"
                height="15"
                rx="3"
                fill="rgba(10, 14, 22, 0.85)"
                stroke="var(--accent-cyan)"
                strokeWidth="0.8"
              />
              <text
                x={scaleX(15) + 7}
                y={scaleZ(-0.48) + 3}
                fill="var(--accent-cyan)"
                fontSize="8.5"
                fontFamily="var(--font-mono)"
                fontWeight="700"
              >
                &Delta;h = 2.50m
              </text>
            </g>
          )}

          {/* Negative Obstacle Indicator (Pothole at d = 3m) */}
          {hasNegativeHazard && (
            <g>
              <circle cx={scaleX(3)} cy={scaleZ(-1.98)} r="4" fill="var(--accent-amber)" />
              <rect
                x={scaleX(3) + 6}
                y={scaleZ(-1.98) - 16}
                width="84"
                height="14"
                rx="3"
                fill="rgba(10, 14, 22, 0.85)"
                stroke="var(--accent-amber)"
                strokeWidth="0.8"
              />
              <text
                x={scaleX(3) + 9}
                y={scaleZ(-1.98) - 6}
                fill="var(--accent-amber)"
                fontSize="8"
                fontFamily="var(--font-mono)"
                fontWeight="700"
              >
                Depth: -0.25m Crater
              </text>
            </g>
          )}

          {/* Interactive invisible hit circles for tooltip */}
          {profile.map((pt, i) => (
            <circle
              key={i}
              cx={scaleX(pt.distance_m)}
              cy={scaleZ(pt.z_ground)}
              r="7"
              fill="transparent"
              style={{ cursor: 'crosshair' }}
              onMouseEnter={() => setHoveredPt(pt)}
            />
          ))}

          {/* Distance Axis Label */}
          <text
            x={width / 2}
            y={height - 5}
            fill="var(--text-muted)"
            fontSize="8.5"
            textAnchor="middle"
            fontFamily="var(--font-mono)"
          >
            Forward Distance along X-axis (m)
          </text>
        </svg>

        {/* Dynamic Tooltip */}
        {hoveredPt && (
          <div
            style={{
              position: 'absolute',
              top: '4px',
              right: '8px',
              padding: '6px 10px',
              backgroundColor: 'rgba(7, 10, 18, 0.92)',
              border: '1px solid var(--accent-cyan)',
              borderRadius: '5px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              lineHeight: '1.4',
              pointerEvents: 'none',
              boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
            }}
          >
            <div>Dist: {hoveredPt.distance_m.toFixed(1)}m (x={hoveredPt.x}m)</div>
            <div style={{ color: 'var(--accent-emerald)' }}>
              z_ground: {hoveredPt.z_ground.toFixed(2)}m
            </div>
            {hoveredPt.z_overhang !== null && (
              <div style={{ color: 'var(--accent-cyan)' }}>
                z_overhang: {hoveredPt.z_overhang.toFixed(2)}m
              </div>
            )}
            {hoveredPt.clearance_m !== null && (
              <div style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                Clearance: {hoveredPt.clearance_m.toFixed(2)}m
              </div>
            )}
          </div>
        )}
      </div>

      {/* Traversal Decision Card */}
      <div
        style={{
          marginTop: '10px',
          padding: '8px 10px',
          borderRadius: '5px',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: hasClearance
            ? 'rgba(0, 240, 255, 0.08)'
            : hasNegativeHazard
            ? 'rgba(255, 171, 0, 0.08)'
            : 'rgba(0, 230, 118, 0.08)',
          border: `1px solid ${
            hasClearance
              ? 'rgba(0, 240, 255, 0.3)'
              : hasNegativeHazard
              ? 'rgba(255, 171, 0, 0.3)'
              : 'rgba(0, 230, 118, 0.3)'
          }`,
        }}
      >
        {hasClearance ? (
          <>
            <CheckCircle size={15} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
            <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
              TRAVERSABLE OVERHANG: &Delta;h = 2.50m &ge; 2.0m threshold &bull; Costmap Clear
            </span>
          </>
        ) : hasNegativeHazard ? (
          <>
            <AlertTriangle size={15} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
            <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>
              NEGATIVE HAZARD DETECTED: Depth 25cm &bull; High Roughness Cost Inflated
            </span>
          </>
        ) : (
          <>
            <ArrowDownUp size={15} style={{ color: 'var(--accent-emerald)', flexShrink: 0 }} />
            <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>
              NOMINAL SURFACE: Gradient &lt; 5% &bull; Welford Bayesian &sigma;&sup2; &lt; 0.005
            </span>
          </>
        )}
      </div>
    </div>
  );
};
