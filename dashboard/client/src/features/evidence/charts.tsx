import React from 'react';

/**
 * Hand-written chart primitives. Theming is just token classes, no chart library is shipped.
 * Rules: thin marks, one axis, direct labels on every mark (these charts have <= 6 marks), recessive grid.
 */

export interface BarItem {
  label: string;
  value: number | null;
  /** Text shown at the bar end. */
  valueLabel: string;
  tone?: 'ours' | 'baseline' | 'good' | 'critical';
  /** Optional second line under the label. */
  sub?: string;
}

const TONE_BG: Record<NonNullable<BarItem['tone']>, string> = {
  ours: 'bg-viz-ours',
  baseline: 'bg-viz-baseline',
  good: 'bg-good',
  critical: 'bg-critical',
};

/** Powers of ten between lo and hi (inclusive of surrounding decades), for log-axis ticks. */
function decades(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) out.push(10 ** e);
  return out;
}

/**
 * Horizontal bars on a LOG scale, so a 3 MB pool is visible next to a 3 GB baseline.
 * The axis is labelled, and every bar has its value written at its end.
 */
export const HBarLog: React.FC<{
  items: BarItem[];
  unit: string;
  ariaLabel: string;
  tickFormat?: (v: number) => string;
}> = ({ items, unit, ariaLabel, tickFormat }) => {
  const vals = items.map((i) => i.value).filter((v): v is number => v != null && v > 0);
  if (vals.length === 0) return <p className="text-xs text-fg-muted">No data.</p>;
  const lo = Math.min(...vals) / 3;
  const hi = Math.max(...vals);
  const pos = (v: number) => Math.max(1.5, ((Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * 100);
  const ticks = decades(lo, hi).filter((t) => t >= lo && t <= hi * 1.001);

  return (
    <div role="img" aria-label={ariaLabel} className="flex flex-col gap-2.5">
      {items.map((it) => (
        <div key={it.label} className="grid grid-cols-[minmax(0,10.5rem)_1fr] items-center gap-3">
          <div className="min-w-0">
            <div className={`truncate text-xs ${it.tone === 'ours' ? 'font-semibold text-fg' : 'text-fg-2'}`}>{it.label}</div>
            {it.sub && <div className="truncate text-[10px] text-fg-muted">{it.sub}</div>}
          </div>
          <div className="relative flex h-4 items-center">
            {it.value != null && it.value > 0 ? (
              <div className="flex w-full items-center gap-2">
                <div className="relative h-2 flex-1 rounded-full bg-subtle">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full ${TONE_BG[it.tone ?? 'baseline']}`}
                    style={{ width: `${pos(it.value)}%` }}
                  />
                </div>
                <span className={`w-24 shrink-0 text-right font-mono text-[11px] tabular-nums ${it.tone === 'ours' ? 'font-bold text-fg' : 'text-fg-2'}`}>
                  {it.valueLabel}
                </span>
              </div>
            ) : (
              <span className="font-mono text-[11px] text-fg-muted">{it.valueLabel}</span>
            )}
          </div>
        </div>
      ))}
      <div className="grid grid-cols-[minmax(0,10.5rem)_1fr] items-start gap-3">
        <span className="text-[10px] text-fg-muted">log scale ({unit})</span>
        <div className="flex w-full items-start gap-2">
          <div className="relative h-4 flex-1 border-t border-viz-grid">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute top-0.5 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-fg-muted"
                style={{ left: `${pos(t)}%` }}
              >
                {tickFormat ? tickFormat(t) : t.toLocaleString('en-US')}
              </span>
            ))}
          </div>
          <span className="w-24 shrink-0" />
        </div>
      </div>
    </div>
  );
};

export interface ColumnItem {
  label: string;
  sub?: string;
  value: number | null;
  valueLabel: string;
  tone?: 'ours' | 'good' | 'critical' | 'baseline';
  /** Shown instead of a bar when value is null, e.g. "no labels". */
  naLabel?: string;
}

/** Vertical bars from a zero baseline for an ordered set (e.g. the four resolution rings). Null renders as an explicit "n/a". */
export const ColumnBars: React.FC<{
  title: string;
  unit?: string;
  items: ColumnItem[];
  max: number;
  ariaLabel: string;
  height?: number;
}> = ({ title, unit, items, max, ariaLabel, height = 96 }) => (
  <div className="flex min-w-0 flex-col gap-1.5" role="img" aria-label={ariaLabel}>
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] font-semibold text-fg">{title}</span>
      {unit && <span className="font-mono text-[10px] text-fg-muted">{unit}</span>}
    </div>
    <div className="grid items-end gap-2 border-b border-viz-axis" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, height }}>
      {items.map((it) => {
        const h = it.value == null ? 0 : Math.max(2, (it.value / max) * (height - 18));
        return (
          <div key={it.label} className="flex flex-col items-center justify-end gap-1">
            <span className={`font-mono text-[10px] tabular-nums ${it.value == null ? 'text-fg-muted' : 'text-fg'}`}>
              {it.value == null ? (it.naLabel ?? 'n/a') : it.valueLabel}
            </span>
            {it.value != null ? (
              <div className={`w-full max-w-9 rounded-t-[3px] ${TONE_BG[it.tone ?? 'ours']}`} style={{ height: h }} />
            ) : (
              <div className="w-full max-w-9 border-t border-dashed border-viz-axis" />
            )}
          </div>
        );
      })}
    </div>
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0 text-center">
          <div className="truncate font-mono text-[10px] text-fg-2">{it.label}</div>
          {it.sub && <div className="truncate font-mono text-[9px] text-fg-muted">{it.sub}</div>}
        </div>
      ))}
    </div>
  </div>
);
