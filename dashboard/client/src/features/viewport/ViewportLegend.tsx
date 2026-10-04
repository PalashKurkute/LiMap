import React, { useMemo } from 'react';
import type { ColorMapMode, GridCellData, RenderMode } from '../../types/telemetry';
import { useTheme } from '../../theme/theme';
import { PIPE_REL_MIN, PIPE_REL_SPAN } from '../../components/ThreeViewport';
import {
  getTraversabilityColor,
  getTurboColor,
  getVarianceColor,
  gradientCss,
  semanticColor,
  semanticName,
} from '../../theme/colormaps';

interface ViewportLegendProps {
  renderMode: RenderMode;
  colorMode: ColorMapMode;
  cells: GridCellData[];
}

const RING_LABELS = ['R0 · 5 cm', 'R1 · 10 cm', 'R2 · 25 cm', 'R3 · 50 cm'];

/** On-canvas legend for the active colour mode. Every colour here comes from the same functions that paint the scene. */
export const ViewportLegend: React.FC<ViewportLegendProps> = ({ renderMode, colorMode, cells }) => {
  const { theme } = useTheme();
  const topClasses = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of cells) m.set(c.sem_id, (m.get(c.sem_id) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [cells]);

  let title = '';
  let body: React.ReactNode = null;

  const strip = (ramp: (t: number) => { r: number; g: number; b: number }, lo: string, hi: string) => (
    <div className="flex flex-col gap-1">
      <div className="h-2 w-40 rounded" style={{ background: gradientCss(ramp) }} />
      <div className="flex w-40 justify-between font-mono text-[10px] text-fg-muted">
        <span>{lo}</span>
        <span>{hi}</span>
      </div>
    </div>
  );

  if (colorMode === 'elevation') {
    title = renderMode === 'pipeline' ? 'Height above ground' : 'Height';
    body = renderMode === 'pipeline' ? strip(getTurboColor, `${PIPE_REL_MIN} m`, `+${(PIPE_REL_MIN + PIPE_REL_SPAN).toFixed(1)} m`) : strip(getTurboColor, 'low', 'high');
  } else if (colorMode === 'semantics' && renderMode === 'pipeline') {
    title = 'Class';
    body = (
      <ul className="flex flex-col gap-0.5">
        {topClasses.map(([id]) => (
          <li key={id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: semanticColor(id, theme) }} />
            <span className="truncate">{semanticName(id)}</span>
          </li>
        ))}
      </ul>
    );
  } else if (colorMode === 'ring') {
    title = 'Resolution ring';
    body = (
      <ul className="flex flex-col gap-0.5">
        {RING_LABELS.map((l, i) => (
          <li key={l} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: `var(--scene-ring-${i})` }} />
            <span>{l}</span>
          </li>
        ))}
      </ul>
    );
  } else if (colorMode === 'variance') {
    title = 'Welford variance';
    body = strip(getVarianceColor, '0', '0.05 m² +');
  } else if (colorMode === 'traversability') {
    title = 'Slope (illustrative)';
    body = strip((t) => getTraversabilityColor(t * 15), 'flat', 'steep');
  } else if (colorMode === 'uncertainty') {
    title = 'Lateral distance (illustrative)';
    body = strip((t) => ({ r: 0.05 + 0.6 * t, g: 0.92 - 0.55 * t, b: 0.52 + 0.4 * t }), 'centre', 'edge');
  }

  if (!body) return null;
  return (
    <div
      data-region="viewport-legend"
      className="pointer-events-auto absolute bottom-4 left-4 z-20 flex max-w-52 flex-col gap-1.5 rounded-xl border border-line bg-panel/90 p-2.5 text-[10px] text-fg-2 shadow-md backdrop-blur-md"
    >
      <span className="font-mono font-bold uppercase tracking-wider text-fg-muted">{title}</span>
      {body}
    </div>
  );
};
