import { HelpTip } from '../ui/HelpTip';
import React from 'react';
import type { LayerVisibility, RenderMode } from '../types/telemetry';
import { Eye, EyeOff, RotateCcw, Layers } from 'lucide-react';

interface DisplaysPanelProps {
  layers: LayerVisibility;
  renderMode: RenderMode;
  onToggleLayer: (layerKey: keyof LayerVisibility) => void;
  onResetLayers: () => void;
}

interface OverlayConfig {
  key: keyof LayerVisibility;
  label: string;
  description: string;
  /** Hand-built illustration items only exist in the concept view. */
  conceptOnly?: boolean;
}

const OVERLAYS: OverlayConfig[] = [
  { key: 'foveaRings', label: 'Range rings', description: 'Boundaries between the resolution rings' },
  { key: 'trajectory', label: 'Illustrative path', description: 'Hand-built curve for the illustrative drive, not planner output', conceptOnly: true },
  { key: 'bridgeDeck', label: 'Bridge deck', description: 'Hand-built illustration of the overhead structure', conceptOnly: true },
  { key: 'trackers', label: 'Moving-vehicle box', description: 'Hand-built illustration of a tracked vehicle', conceptOnly: true },
];

export const DisplaysPanel: React.FC<DisplaysPanelProps> = ({ layers, renderMode, onToggleLayer, onResetLayers }) => {
  const overlays = OVERLAYS.filter((o) => !o.conceptOnly || renderMode === 'concept');

  return (
    <div data-tour="overlays" className="bg-panel border border-line rounded-xl p-4 shadow-sm flex flex-col gap-3 text-fg">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-fg-2" />
          <span className="text-xs font-semibold uppercase tracking-wider text-fg-2">Overlays</span>
          <HelpTip topic="overlays" side="left" />
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

      <div className="flex flex-col divide-y divide-line">
        {overlays.map((item) => {
          const isVisible = layers[item.key];
          return (
            <button
              key={item.key}
              type="button"
              role="switch"
              aria-checked={isVisible}
              onClick={() => onToggleLayer(item.key)}
              className="py-2.5 px-2 flex items-center justify-between gap-3 text-left hover:bg-subtle/80 transition-colors rounded-lg group"
            >
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={`w-5 h-5 shrink-0 rounded-md flex items-center justify-center border transition-all ${
                    isVisible ? 'bg-accent border-line-strong text-accent-on' : 'bg-panel border-line-strong text-fg-muted'
                  }`}
                >
                  {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                </span>

                <div className="flex flex-col">
                  <span className={`text-xs font-medium ${isVisible ? 'text-fg' : 'text-fg-muted'}`}>{item.label}</span>
                  <span className="text-[11px] text-fg-muted leading-tight">{item.description}</span>
                </div>
              </div>

              <span className={`text-[11px] font-mono font-medium ${isVisible ? 'text-good-fg' : 'text-fg-muted'}`}>
                {isVisible ? 'ON' : 'OFF'}
              </span>
            </button>
          );
        })}
      </div>

      {renderMode === 'pipeline' && (
        <p className="text-[11px] text-fg-muted leading-relaxed">
          The path, bridge and vehicle overlays are hand-built illustrations and only appear in the Concept view.
        </p>
      )}
    </div>
  );
};
