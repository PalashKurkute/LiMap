/**
 * Data colours (colormaps and class colours). This file is allow-listed by scripts/check-tokens.mjs:
 * it is the one place besides tokens.css where raw colour values may live.
 *
 * Data colours keep their IDENTITY across themes (a "road" is the same hue in light and dark) but get a
 * per-theme STEP so they stay legible against each surface.
 */
import type { ResolvedTheme } from './theme';

// ---------------------------------------------------------------------------
// Continuous ramps (return linear 0..1 RGB for Three.js vertex colours)
// ---------------------------------------------------------------------------

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Turbo-style elevation ramp: maps normalised z in [0, 1] to RGB (blue low -> red high). */
export function getTurboColor(normZ: number): Rgb {
  const t = Math.min(Math.max(normZ, 0.0), 1.0);
  if (t < 0.15) {
    const f = t / 0.15;
    return { r: 0.15 * (1 - f) + 0.1 * f, g: 0.1 * (1 - f) + 0.35 * f, b: 0.75 * (1 - f) + 1.0 * f };
  } else if (t < 0.35) {
    const f = (t - 0.15) / 0.2;
    return { r: 0.1 * (1 - f) + 0.0 * f, g: 0.35 * (1 - f) + 0.9 * f, b: 1.0 * (1 - f) + 0.95 * f };
  } else if (t < 0.6) {
    const f = (t - 0.35) / 0.25;
    return { r: 0.0, g: 0.9 * (1 - f) + 0.92 * f, b: 0.95 * (1 - f) + 0.3 * f };
  } else if (t < 0.82) {
    const f = (t - 0.6) / 0.22;
    return { r: 1.0 * f, g: 0.92 * (1 - f) + 0.75 * f, b: 0.3 * (1 - f) };
  }
  const f = (t - 0.82) / 0.18;
  return { r: 1.0, g: 0.75 * (1 - f) + 0.09 * f, b: 0.27 * f };
}

/** Slope-based traversability: green (flat) -> amber -> red (untraversable). */
export function getTraversabilityColor(slopeDeg: number): Rgb {
  if (slopeDeg < 5.0) return { r: 0.0, g: 0.9, b: 0.46 };
  if (slopeDeg < 12.0) {
    const f = (slopeDeg - 5.0) / 7.0;
    return { r: 1.0 * f, g: 0.9 * (1 - f) + 0.75 * f, b: 0.46 * (1 - f) };
  }
  return { r: 1.0, g: 0.09, b: 0.27 };
}

/** Lateral-distance ramp (illustrative; NOT a measured uncertainty). */
export function getLateralColor(absY: number): Rgb {
  if (absY < 3.5) return { r: 0.05, g: 0.92, b: 0.52 };
  if (absY < 7.5) return { r: 0.15, g: 0.72, b: 0.95 };
  return { r: 0.65, g: 0.35, b: 0.92 };
}

/** Variance ramp: low (cool teal) -> high (hot magenta/orange). `normV` is 0..1. */
export function getVarianceColor(normV: number): Rgb {
  const v = Math.min(Math.max(normV, 0), 1);
  return { r: 0.05 * (1 - v) + 1.0 * v, g: 0.7 * (1 - v) + 0.1 * v, b: 0.9 * (1 - v) + 0.3 * v };
}

export function rgbToCss({ r, g, b }: Rgb): string {
  const c = (v: number) => Math.round(Math.min(Math.max(v, 0), 1) * 255);
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

// ---------------------------------------------------------------------------
// SemanticKITTI classes. Names follow the official label map; each class has a
// light-theme step (darker) and a dark-theme step (lighter).
// ---------------------------------------------------------------------------

export interface SemanticClass {
  name: string;
  light: string;
  dark: string;
}

export const SEMANTIC_CLASSES: Record<number, SemanticClass> = {
  0: { name: 'Unlabeled', light: '#64748b', dark: '#94a3b8' },
  10: { name: 'Car / Vehicle', light: '#0369a1', dark: '#38bdf8' },
  11: { name: 'Bicycle', light: '#be123c', dark: '#fb7185' },
  15: { name: 'Motorcycle', light: '#c2410c', dark: '#fb923c' },
  18: { name: 'Truck', light: '#075985', dark: '#0ea5e9' },
  20: { name: 'Other Vehicle', light: '#0284c7', dark: '#7dd3fc' },
  30: { name: 'Person', light: '#be123c', dark: '#f43f5e' },
  40: { name: 'Road / Drivable', light: '#475569', dark: '#8795a8' },
  44: { name: 'Parking', light: '#64748b', dark: '#94a3b8' },
  48: { name: 'Sidewalk', light: '#7c8ba1', dark: '#cbd5e1' },
  49: { name: 'Other Ground', light: '#64748b', dark: '#94a3b8' },
  50: { name: 'Building / Wall', light: '#a16207', dark: '#e2c27a' },
  51: { name: 'Fence / Barrier', light: '#7e22ce', dark: '#c084fc' },
  70: { name: 'Vegetation', light: '#15803d', dark: '#22c55e' },
  71: { name: 'Trunk / Tree', light: '#166534', dark: '#16a34a' },
  72: { name: 'Terrain / Grass', light: '#4d7c0f', dark: '#84cc16' },
  80: { name: 'Pole / Bollard', light: '#a16207', dark: '#eab308' },
  81: { name: 'Traffic Sign', light: '#b45309', dark: '#f59e0b' },
  99: { name: 'Pothole (synthetic)', light: '#b45309', dark: '#fbbf24' },
  252: { name: 'Moving Object (MOS)', light: '#b91c1c', dark: '#ef4444' },
};

export function semanticName(id: number): string {
  return SEMANTIC_CLASSES[id]?.name ?? `Class ${id}`;
}

export function semanticColor(id: number, theme: ResolvedTheme): string {
  const c = SEMANTIC_CLASSES[id] ?? SEMANTIC_CLASSES[0];
  return theme === 'dark' ? c.dark : c.light;
}

/** Linear RGB for Three.js vertex colours from a class id. */
export function semanticRgb(id: number, theme: ResolvedTheme): Rgb {
  const hex = semanticColor(id, theme).slice(1);
  const n = parseInt(hex, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

const KNOWN_CLASS_IDS = new Set(Object.keys(SEMANTIC_CLASSES).map(Number).filter((id) => id !== 0 && id !== 99));

/**
 * Point colour for the real LiDAR cloud: the class colour when the label is a known SemanticKITTI class,
 * otherwise a height ramp so unlabeled returns still carry information.
 */
export function pointColorForClass(classId: number, z: number, theme: ResolvedTheme): Rgb {
  if (KNOWN_CLASS_IDS.has(classId)) return semanticRgb(classId, theme);
  const normZ = Math.min(Math.max((z + 3.0) / 4.7, 0), 1);
  return getTurboColor(normZ);
}

// ---------------------------------------------------------------------------
// BEV (Canvas2D) per-cell colours
// ---------------------------------------------------------------------------

export function elevationCss(meanZ: number): string {
  const normZ = Math.min(1, Math.max(0, (meanZ + 2.0) / 4.0));
  return rgbToCss(getTurboColor(normZ));
}

/** CSS linear-gradient for a legend strip, sampled from a ramp function over t in [0, 1]. */
export function gradientCss(ramp: (t: number) => Rgb, steps = 12): string {
  const stops = Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return `${rgbToCss(ramp(t))} ${(t * 100).toFixed(0)}%`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

export function varianceCss(variance: number): string {
  return rgbToCss(getVarianceColor(variance / 0.05));
}

/** Dual-elevation view: overhang present vs open sky. */
export function overhangCss(hasOverhang: boolean, theme: ResolvedTheme): string {
  if (hasOverhang) return theme === 'dark' ? '#f472b6' : '#be185d';
  return theme === 'dark' ? '#059669' : '#0f766e';
}
