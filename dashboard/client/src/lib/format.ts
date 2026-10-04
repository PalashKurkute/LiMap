/** Number formatting helpers (display only; values always come from data). */

export const fmt = (v: number | null | undefined, digits = 1): string =>
  v == null || !Number.isFinite(v) ? 'n/a' : v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtInt = (v: number | null | undefined): string =>
  v == null || !Number.isFinite(v) ? 'n/a' : Math.round(v).toLocaleString('en-US');

export const fmtMs = (v: number | null | undefined): string => {
  if (v == null || !Number.isFinite(v)) return 'n/a';
  return v >= 1000 ? `${(v / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 })} s` : `${fmt(v, v < 100 ? 1 : 0)} ms`;
};

/** Megabytes in the repository's own unit (MiB). No GB conversion, so labels match the docs. */
export const fmtMb = (v: number | null | undefined): string => {
  if (v == null || !Number.isFinite(v)) return 'n/a';
  return `${v.toLocaleString('en-US', { minimumFractionDigits: v < 10 ? 4 : 1, maximumFractionDigits: v < 10 ? 4 : 1 })} MB`;
};

/** FPS derived from a frame time in milliseconds. */
export const fpsFromMs = (ms: number): number => 1000 / ms;

/** Shows a value at the precision it has in the data (up to `max` decimals, trailing zeros trimmed): 47.65 -> "47.65", 61.6 -> "61.6". */
export const fmtExact = (v: number | null | undefined, max = 3): string =>
  v == null || !Number.isFinite(v) ? 'n/a' : Number(v.toFixed(max)).toLocaleString('en-US', { maximumFractionDigits: max });
