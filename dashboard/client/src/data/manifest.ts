import type { PlannerManifest, VariantManifest } from '../types/telemetry';
import { fetchJson } from './api';

/** The parts of public/data/manifest.json the dashboard reads beyond the scene list. Each block may be absent. */
export interface DataManifest {
  variants?: VariantManifest;
  planner?: PlannerManifest;
}

let manifestPromise: Promise<DataManifest | null> | null = null;

/** One cached fetch of the manifest, shared by every loader that is gated on it (so a missing file never 404s). */
export function loadManifest(): Promise<DataManifest | null> {
  if (!manifestPromise) {
    manifestPromise = fetchJson<DataManifest>('/data/manifest.json', { timeoutMs: 8000 });
    manifestPromise.then((m) => {
      if (!m) manifestPromise = null; // let the next navigation retry
    });
  }
  return manifestPromise;
}
