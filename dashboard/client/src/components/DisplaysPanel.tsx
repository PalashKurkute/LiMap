import React from 'react';
import type { LayerVisibility } from '../types/telemetry';
import { Eye, EyeOff, RotateCcw, Layers } from 'lucide-react';

interface DisplaysPanelProps {
  layers: LayerVisibility;
  onToggleLayer: (layerKey: keyof LayerVisibility) => void;
  onResetLayers: () => void;
}

interface OverlayConfig {
  key: keyof LayerVisibility;
  label: string;
  description: string;
}

export const DisplaysPanel: React.FC<DisplaysPanelProps> = ({
  layers,
  onToggleLayer,
  onResetLayers,
}) => {
  const overlays: OverlayConfig[] = [
    {
      key: 'trajectory',
      label: 'Planned Path',
      description: 'Collision-free trajectory curve computed by planner',
    },
    {
      key: 'bridgeDeck',
      label: 'Bridge Canopy',
      description: 'Overhead roof structure for 2.5m vertical clearance',
    },
    {
      key: 'trackers',
      label: 'Traffic Vectors',
      description: 'Dynamic vehicles with Kalman motion prediction',
    },
    {
      key: 'foveaRings',
      label: 'Range Rings',
      description: '10m, 25m, and 50m distance boundaries',
    },
  ];

  return (
    <div className="bg-panel border border-line rounded-xl p-4 shadow-sm flex flex-col gap-3 text-fg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line pb-2">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-fg-2" />
          <span className="text-xs font-semibold uppercase tracking-wider text-fg-2">
            Perception Overlays
          </span>
        </div>
        <button
          onClick={onResetLayers}
          className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border border-line text-fg-2 hover:bg-subtle transition-colors"
          title="Reset overlays to default"
        >
          <RotateCcw size={10} />
          <span>Reset</span>
        </button>
      </div>

      {/* Simplified, Clean Overlay List */}
      <div className="flex flex-col divide-y divide-line">
        {overlays.map((item) => {
          const isVisible = layers[item.key];
          return (
            <div
              key={item.key}
              onClick={() => onToggleLayer(item.key)}
              className="py-2.5 px-2 flex items-center justify-between cursor-pointer hover:bg-subtle/80 transition-colors rounded-lg group"
            >
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                    isVisible
                      ? 'bg-accent border-line-strong text-accent-on'
                      : 'bg-panel border-line-strong text-fg-muted group-hover:border-line-strong'
                  }`}
                >
                  {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>

                <div className="flex flex-col">
                  <span className={`text-xs font-medium ${isVisible ? 'text-fg' : 'text-fg-muted'}`}>
                    {item.label}
                  </span>
                  <span className="text-[11px] text-fg-muted leading-tight">
                    {item.description}
                  </span>
                </div>
              </div>

              <span className={`text-[11px] font-mono font-medium ${isVisible ? 'text-good-fg' : 'text-fg-muted'}`}>
                {isVisible ? 'ON' : 'OFF'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
