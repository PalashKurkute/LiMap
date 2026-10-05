import type { ColumnarCells, GridCellData, LatticeRing, SceneSnapshot } from '../types/telemetry';
import { fetchJson } from './api';

const cache = new Map<string, Promise<SceneSnapshot | null>>();

/** The id the analysed upload is stored under. It has no static file, so it is never fetched. */
export const UPLOAD_ID = 'upload';

/**
 * Keeps an analysed upload under the id 'upload', replacing any earlier one. Memory only: nothing is written to
 * localStorage, sessionStorage or IndexedDB, so a reload clears it.
 */
export function registerUpload(snapshot: SceneSnapshot): void {
  cache.set(UPLOAD_ID, Promise.resolve(snapshot));
}

/** Loads the precomputed pipeline snapshot for a scene (served statically, so no backend is needed). */
export function loadSceneSnapshot(sceneId: string): Promise<SceneSnapshot | null> {
  // An upload exists only in memory: with none registered there is nothing to fetch (and no file that could 404).
  if (sceneId === UPLOAD_ID) return cache.get(UPLOAD_ID) ?? Promise.resolve(null);
  let p = cache.get(sceneId);
  if (!p) {
    p = fetchJson<SceneSnapshot>(`/data/scenes/${sceneId}.json`, { timeoutMs: 15000 }).then((s) => (isSnapshot(s) ? s : null));
    cache.set(sceneId, p);
    // Don't cache failures forever: let the next navigation retry.
    p.then((s) => {
      if (!s) cache.delete(sceneId);
    });
  }
  return p;
}

export function isSnapshot(s: unknown): s is SceneSnapshot {
  const o = s as SceneSnapshot | null;
  return !!o && !!o.meta && !!o.telemetry?.telemetry && !!o.cells && Array.isArray(o.cells.ix) && Array.isArray(o.meta.lattice);
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function decodeCells(c: ColumnarCells, lattice: LatticeRing[]): GridCellData[] {
  const resByRing = new Map(lattice.map((r) => [r.ring_id, r.res_m]));
  const out: GridCellData[] = new Array(c.n);
  for (let i = 0; i < c.n; i++) {
    const ring = c.ring[i];
    const res = resByRing.get(ring) ?? 0.1;
    out[i] = {
      ix: c.ix[i],
      iy: c.iy[i],
      ring_id: ring,
      res_m: res,
      x_m: round2(c.ix[i] * res + res * 0.5),
      y_m: round2(c.iy[i] * res + res * 0.5),
      sem_id: c.sem[i],
      count: c.count[i],
      mean_z: c.z[i],
      variance: c.var[i],
      min_z: c.zmin[i],
      max_z: c.zmax[i],
      overhang_z: c.oh[i],
      clearance: c.cl[i],
    };
  }
  return out;
}

/** Warm the cache for scenes the user is likely to open next. */
export function prefetchSnapshots(ids: string[]): void {
  const run = () => ids.forEach((id) => void loadSceneSnapshot(id));
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (ric) ric(run);
  else setTimeout(run, 1500);
}
