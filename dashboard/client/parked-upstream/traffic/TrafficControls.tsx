// traffic/TrafficControls.tsx
// Traffic simulation control panel styled to match the existing white
// TacticalObjectiveCard aesthetic. Positioned absolute top-left.

import React from "react";
import type { SimVehicle, EventFeedItem, TrafficSimState } from "./types";

interface Props {
  density: number;
  onDensityChange: (v: number) => void;
  simSpeed: number;
  onSimSpeedChange: (v: number) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
  onRestart: () => void;
  showModels: boolean;
  onShowModelsChange: (v: boolean) => void;
  showBBoxes: boolean;
  onShowBBoxesChange: (v: boolean) => void;
  showVelocityVectors: boolean;
  onShowVelocityVectorsChange: (v: boolean) => void;
  showTrails: boolean;
  onShowTrailsChange: (v: boolean) => void;
  showRoadLabels: boolean;
  onShowRoadLabelsChange: (v: boolean) => void;
  followEgo: boolean;
  onFollowEgoChange: (v: boolean) => void;
  cameraMode: "topdown" | "tilted";
  onCameraModeChange: (v: "topdown" | "tilted") => void;
  selectedVehicle: SimVehicle | null;
  onClearSelection: () => void;
  eventFeed: EventFeedItem[];
  simState: TrafficSimState | null;
}



function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="flex items-center gap-2 text-left w-full"
      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}
    >
      <div
        style={{
          width: 26,
          height: 14,
          borderRadius: 7,
          background: checked ? "#1e293b" : "#e2e8f0",
          position: "relative",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 14 : 2,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.15s",
            boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
          }}
        />
      </div>
      <span style={{ fontSize: 11, fontWeight: 500, color: checked ? "#0f172a" : "#64748b" }}>{label}</span>
    </button>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: accent ?? "#0f172a" }}>{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b" }}>
      {children}
    </span>
  );
}

const STATE_COLORS: Record<string, string> = {
  driving: "#16a34a", braking: "#d97706", stopped: "#dc2626",
  turning: "#0284c7", uncertain: "#7c3aed",
};
const EVENT_ICONS: Record<string, string> = {
  entered_range: "◉", exited_range: "○", stopped_intersection: "▪",
  lane_change: "↔", collision_risk: "⚠", braking_event: "⏹",
};
const EVENT_COLORS: Record<string, string> = {
  entered_range: "#0284c7", exited_range: "#94a3b8", stopped_intersection: "#d97706",
  lane_change: "#16a34a", collision_risk: "#dc2626", braking_event: "#d97706",
};

export const TrafficControls: React.FC<Props> = ({
  density, onDensityChange,
  simSpeed: _simSpeed, onSimSpeedChange: _onSimSpeedChange,
  isPlaying: _isPlaying, onPlayPause: _onPlayPause, onRestart: _onRestart,
  showModels, onShowModelsChange,
  showBBoxes, onShowBBoxesChange,
  showVelocityVectors, onShowVelocityVectorsChange,
  showTrails, onShowTrailsChange,
  showRoadLabels, onShowRoadLabelsChange,
  followEgo, onFollowEgoChange,
  cameraMode, onCameraModeChange,
  selectedVehicle, onClearSelection,
  eventFeed,
  simState,
}) => {
  const vehicleCount = simState?.vehicles.length ?? 0;
  const inRangeCount = simState?.vehicles.filter((v) => v.inLidarRange).length ?? 0;

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 20,
        width: 320,
        maxHeight: "calc(100vh - 120px)",
        overflowY: "auto",
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(226,232,240,0.9)",
        borderRadius: 16,
        boxShadow: "0 8px 24px rgba(15,23,42,0.10)",
        color: "#1e293b",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 12,
        scrollbarWidth: "thin",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: "10px 14px",
        borderBottom: "1px solid #f1f5f9",
        background: "rgba(248,250,252,0.7)",
        borderRadius: "16px 16px 0 0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.08em", textTransform: "uppercase", color: "#0f172a" }}>
              Urban Traffic Sim
            </div>
            <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 1 }}>SIMULATED · PROCEDURAL CITY</div>
          </div>
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b", textAlign: "right" }}>
          <div style={{ fontWeight: 700, color: "#0f172a" }}>{vehicleCount} veh</div>
          <div style={{ color: "#16a34a" }}>{inRangeCount} tracked</div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>


        {/* Density */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <SectionLabel>Traffic Density</SectionLabel>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: "#0f172a" }}>
              {Math.round(30 + density * 70)} veh
            </span>
          </div>
          <input
            type="range" min={0} max={1} step={0.01} value={density}
            onChange={(e) => onDensityChange(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "#1e293b", height: 4 }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#94a3b8", fontFamily: "monospace" }}>
            <span>Sparse</span><span>Dense</span>
          </div>
        </div>

        {/* Camera */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SectionLabel>Camera</SectionLabel>
          <div style={{ display: "flex", gap: 4 }}>
            {(["topdown", "tilted"] as const).map((m) => (
              <button
                key={m}
                onClick={() => onCameraModeChange(m)}
                style={{
                  flex: 1, padding: "5px 0", borderRadius: 8,
                  border: "1px solid",
                  borderColor: cameraMode === m ? "#1e293b" : "#e2e8f0",
                  background: cameraMode === m ? "#1e293b" : "#f8fafc",
                  color: cameraMode === m ? "#fff" : "#64748b",
                  cursor: "pointer", fontSize: 10, fontWeight: 600,
                }}
              >
                {m === "topdown" ? "Top-Down" : "Tilted"}
              </button>
            ))}
          </div>
          <Toggle label="Follow Ego Vehicle" checked={followEgo} onChange={() => onFollowEgoChange(!followEgo)} />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "#f1f5f9" }} />

        {/* Overlays */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <SectionLabel>Overlays</SectionLabel>
          <Toggle label="Vehicle Models"   checked={showModels}          onChange={() => onShowModelsChange(!showModels)} />
          <Toggle label="Bounding Boxes"   checked={showBBoxes}          onChange={() => onShowBBoxesChange(!showBBoxes)} />
          <Toggle label="Velocity Vectors" checked={showVelocityVectors} onChange={() => onShowVelocityVectorsChange(!showVelocityVectors)} />
          <Toggle label="Selected Trail"   checked={showTrails}          onChange={() => onShowTrailsChange(!showTrails)} />
          <Toggle label="Road Labels"      checked={showRoadLabels}      onChange={() => onShowRoadLabelsChange(!showRoadLabels)} />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "#f1f5f9" }} />

        {/* Legend */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <SectionLabel>Legend</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 8px" }}>
            {[
              ["#06b6d4", "Ego Vehicle"],
              ["#22c55e", "In LiDAR Range"],
              ["#f59e0b", "Stopped / Braking"],
              ["#ef4444", "Collision Risk"],
              ["#a855f7", "Uncertain Track"],
              ["#fbbf24", "Selected"],
            ].map(([color, label]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: "#64748b" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected vehicle telemetry */}
        {selectedVehicle && (
          <>
            <div style={{ height: 1, background: "#f1f5f9" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <SectionLabel>Selected Vehicle</SectionLabel>
                <button
                  onClick={onClearSelection}
                  style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12, padding: 0 }}
                >✕</button>
              </div>
              <div style={{
                background: "#f8fafc", border: "1px solid #e2e8f0",
                borderRadius: 10, padding: "8px 10px",
                display: "flex", flexDirection: "column", gap: 4,
              }}>
                <Row label="ID"       value={selectedVehicle.id} />
                <Row label="Type"     value={selectedVehicle.type} />
                <Row label="Speed"    value={`${(selectedVehicle.speed * 3.6).toFixed(1)} km/h`} />
                <Row label="State"    value={selectedVehicle.state.toUpperCase()} accent={STATE_COLORS[selectedVehicle.state]} />
                <Row label="In Range" value={selectedVehicle.inLidarRange ? "YES" : "NO"} accent={selectedVehicle.inLidarRange ? "#16a34a" : "#dc2626"} />
                <Row label="Gap Ahead" value={selectedVehicle.gapAhead >= 0 ? `${selectedVehicle.gapAhead.toFixed(1)} m` : "—"} />
              </div>
            </div>
          </>
        )}

        {/* Event Feed */}
        <div style={{ height: 1, background: "#f1f5f9" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <SectionLabel>Events</SectionLabel>
          <div style={{
            maxHeight: 110, overflowY: "auto",
            display: "flex", flexDirection: "column", gap: 3,
            scrollbarWidth: "thin",
          }}>
            {eventFeed.length === 0 && (
              <div style={{ fontSize: 10, color: "#94a3b8" }}>Awaiting events…</div>
            )}
            {[...eventFeed].reverse().slice(0, 10).map((ev) => (
              <div key={ev.id} style={{ fontSize: 10, color: "#475569", display: "flex", alignItems: "flex-start", gap: 5 }}>
                <span style={{ color: EVENT_COLORS[ev.type], flexShrink: 0, fontSize: 11 }}>{EVENT_ICONS[ev.type]}</span>
                <span style={{ lineHeight: 1.4 }}>{ev.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          fontSize: 9, color: "#94a3b8", textAlign: "center",
          borderTop: "1px solid #f1f5f9", paddingTop: 8,
          fontFamily: "monospace", letterSpacing: "0.05em",
        }}>
          SIMULATED · NOT REAL SENSOR DATA
        </div>
      </div>
    </div>
  );
};
