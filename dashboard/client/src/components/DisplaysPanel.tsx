import React from 'react';
import type { LayerVisibility } from '../types/telemetry';
import { Eye, Radio, RotateCcw } from 'lucide-react';

interface DisplaysPanelProps {
  layers: LayerVisibility;
  onToggleLayer: (layerKey: keyof LayerVisibility) => void;
  onResetLayers: () => void;
}

interface TopicConfig {
  key: keyof LayerVisibility;
  topic: string;
  type: string;
  label: string;
  badge: string;
  color: string;
}

export const DisplaysPanel: React.FC<DisplaysPanelProps> = ({
  layers,
  onToggleLayer,
  onResetLayers,
}) => {
  const topics: TopicConfig[] = [
    {
      key: 'demSurface',
      topic: '/foveated_grid/surface',
      type: 'fastdem_msgs/ContinuousDEM',
      label: 'Continuous DEM Surface',
      badge: '100+ Hz',
      color: 'var(--accent-cyan)',
    },
    {
      key: 'demVoxels',
      topic: '/foveated_grid/voxels',
      type: 'grid_map_msgs/GridMap',
      label: '2.5D Column Heightfield',
      badge: 'Instanced',
      color: 'var(--accent-emerald)',
    },
    {
      key: 'rawPoints',
      topic: '/points_raw',
      type: 'sensor_msgs/PointCloud2',
      label: 'Raw LiDAR Point Cloud',
      badge: '4,800 Pts',
      color: 'var(--accent-purple)',
    },
    {
      key: 'bridgeDeck',
      topic: '/overhang/bridge_deck',
      type: 'geometry_msgs/PolygonStamped',
      label: 'Dual-Elevation Canopy/Deck',
      badge: 'Δh Clearance',
      color: 'var(--accent-cyan)',
    },
    {
      key: 'trajectory',
      topic: '/nav2/trajectory_spline',
      type: 'nav_msgs/Path',
      label: 'Hybrid-A* Trajectory Spline',
      badge: 'Ackermann',
      color: 'var(--accent-cyan)',
    },
    {
      key: 'trackers',
      topic: '/mos/dynamic_trackers',
      type: 'vision_msgs/Detection3DArray',
      label: 'MOS Dynamic Bounding Boxes',
      badge: 'Kalman 10Hz',
      color: 'var(--accent-purple)',
    },
    {
      key: 'foveaRings',
      topic: '/fovea/nested_rings',
      type: 'visualization_msgs/MarkerArray',
      label: 'Concentric Resolution Lattice',
      badge: '5/10/25/50cm',
      color: 'var(--accent-amber)',
    },
    {
      key: 'sweepWave',
      topic: '/sensors/laser_sweep',
      type: 'sensor_msgs/LaserScan',
      label: 'Laser Pulse Scan Wave',
      badge: '600 RPM',
      color: 'var(--accent-cyan)',
    },
    {
      key: 'headlights',
      topic: '/ugv/headlights',
      type: 'sensor_msgs/Illuminance',
      label: 'Tactical Forward Spotlights',
      badge: 'Twin LED',
      color: '#ffffff',
    },
  ];

  return (
    <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Radio size={14} style={{ color: 'var(--accent-cyan)' }} />
          <span>ROS 2 Displays &amp; Topics Tree</span>
        </div>
        <button
          onClick={onResetLayers}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--card-border)',
            borderRadius: '4px',
            padding: '3px 7px',
            fontSize: '10px',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
          title="Reset All Displays to Default"
        >
          <RotateCcw size={11} />
          <span>Reset</span>
        </button>
      </div>

      <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
        Toggle individual ROS 2 perception topics and 3D rendering layers (inspired by pushpam2404 / RViz2 display trees).
      </div>

      {/* Topic List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {topics.map((t) => {
          const isVisible = layers[t.key];
          return (
            <div
              key={t.key}
              onClick={() => onToggleLayer(t.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '6px',
                background: isVisible ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                border: `1px solid ${isVisible ? 'rgba(0, 240, 255, 0.25)' : 'var(--card-border)'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    border: `1px solid ${isVisible ? t.color : 'rgba(255, 255, 255, 0.2)'}`,
                    background: isVisible ? `${t.color}22` : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isVisible && <Eye size={10} style={{ color: t.color }} />}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: isVisible ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {t.label}
                  </span>
                  <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {t.topic}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    padding: '2px 5px',
                    borderRadius: '3px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {t.badge}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', padding: '6px 8px', borderRadius: '4px', background: 'rgba(0, 230, 118, 0.08)', border: '1px solid rgba(0, 230, 118, 0.2)' }}>
        REP-103 COMPLIANT: Standard coordinate frames /map &rarr; /odom &rarr; /base_link &rarr; /lidar actively publishing.
      </div>
    </div>
  );
};
