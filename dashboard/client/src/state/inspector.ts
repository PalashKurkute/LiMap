import { useSyncExternalStore } from 'react';

/**
 * Map Inspector state, kept outside the component so it survives switching views and so the tour can drive
 * it through the same setters a user's clicks use. Pan and zoom stay local to the canvas; the canvas reacts
 * to `focus` to centre on a cell.
 */
export type InspectorColorBy = 'ring' | 'semantics' | 'elevation' | 'variance' | 'overhang';
export type InspectorProjection = '2d' | 'iso';
export type FoveaPresetId = 'NOMINAL' | 'CITY_CRUISE' | 'HIGHWAY_EXTENDED' | 'TURNING_LEFT' | 'TURNING_RIGHT';

export interface InspectorState {
  colorBy: InspectorColorBy;
  ringFilter: number | 'all';
  /** "ix:iy:ring" of the selected cell, or null. Resolved against the loaded cells, so it survives data upgrades. */
  selectedKey: string | null;
  projection: InspectorProjection;
  guides: boolean;
  preset: FoveaPresetId;
  compare: boolean;
  /** Underpass comparison: two costmaps side by side (one-height grid vs 2.5D), top-down only. Excludes `compare`. */
  underpass: boolean;
  /** Swipe divider position for the uniform-vs-FoveaGrid comparison, 0..1 from the left. */
  divider: number;
  /** Ask the canvas to centre on a world point; `nonce` makes repeated requests distinct. */
  focus: { x: number; y: number; z?: number; zoom: number; nonce: number } | null;
}

export const INSPECTOR_DEFAULTS: InspectorState = {
  colorBy: 'semantics',
  ringFilter: 'all',
  selectedKey: null,
  projection: '2d',
  guides: true,
  preset: 'NOMINAL',
  compare: false,
  underpass: false,
  divider: 0.5,
  focus: null,
};

let state: InspectorState = INSPECTOR_DEFAULTS;
const listeners = new Set<() => void>();

export function getInspector(): InspectorState {
  return state;
}

export function setInspector(patch: Partial<InspectorState>): void {
  const next = { ...state, ...patch };
  // The two comparisons share the canvas, and the underpass costmaps are flat. Whichever the caller turns on wins; a
  // caller that sets both explicitly is trusted. Keeping this here means a click, a key and the tour all behave alike.
  if (patch.underpass === true) {
    if (patch.compare === undefined) next.compare = false;
    if (patch.projection === undefined) next.projection = '2d';
  }
  if (patch.compare === true && patch.underpass === undefined) next.underpass = false;
  if (patch.projection === 'iso' && patch.underpass === undefined) next.underpass = false;
  state = next;
  listeners.forEach((l) => l());
}

export function replaceInspector(next: InspectorState): void {
  state = next;
  listeners.forEach((l) => l());
}

export function resetInspector(): void {
  replaceInspector(INSPECTOR_DEFAULTS);
}

export function cellKey(c: { ix: number; iy: number; ring_id: number }): string {
  return `${c.ix}:${c.iy}:${c.ring_id}`;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useInspector(): InspectorState {
  return useSyncExternalStore(subscribe, getInspector, () => INSPECTOR_DEFAULTS);
}
