import { useEffect, useState } from 'react';
import type { PlannerFile, SceneId } from '../types/telemetry';
import { fetchJson } from './api';
import { loadManifest } from './manifest';
import { clearReady, markReady } from '../state/readiness';

/**
 * Planner snapshots (docs/DATA_VARIANTS.md, schema limap.planner/1): the bridge underpass replayed through the real
 * costmap generator and Hybrid-A*. Static files like the scene snapshots. The manifest is read first and only a file it
 * lists is fetched, so a scene without one is "unavailable" instead of a 404 in the console.
 */
const cache = new Map<string, Promise<PlannerFile | null>>();

export function loadPlanner(scene: SceneId): Promise<PlannerFile | null> {
  let p = cache.get(scene);
  if (!p) {
    p = loadManifest().then(async (manifest) => {
      const entry = manifest?.planner?.[scene];
      if (!entry) return null;
      const file = await fetchJson<PlannerFile>(`/data/${entry.file}`, { timeoutMs: 20000 });
      if (!file || file.schema !== 'limap.planner/1' || !file.meta || !file.maps || !file.results) return null;
      return file;
    });
    cache.set(scene, p);
    p.then((v) => {
      if (!v) cache.delete(scene);
    });
  }
  return p;
}

export type PlannerStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

/** Loads the planner snapshot for a scene when `enabled`. Never shows another scene's data. */
export function usePlanner(scene: SceneId, enabled: boolean): { data: PlannerFile | null; status: PlannerStatus } {
  const [state, setState] = useState<{ key: string; data: PlannerFile | null; status: PlannerStatus }>({
    key: '',
    data: null,
    status: 'idle',
  });
  const key = enabled ? scene : '';

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    clearReady('planner');
    loadPlanner(scene).then((data) => {
      if (cancelled) return;
      setState({ key, data, status: data ? 'ready' : 'unavailable' });
      if (data) markReady('planner');
    });
    return () => {
      cancelled = true;
      clearReady('planner');
    };
  }, [scene, enabled, key]);

  if (!enabled) return { data: null, status: 'idle' };
  if (state.key !== key) return { data: null, status: 'loading' };
  return { data: state.data, status: state.status };
}

/** Whether the manifest lists a planner snapshot for this scene; null until the manifest has loaded. */
export function usePlannerAvailability(scene: SceneId): boolean | null {
  const [state, setState] = useState<{ scene: SceneId; available: boolean | null }>({ scene, available: null });
  useEffect(() => {
    let cancelled = false;
    loadManifest().then((m) => {
      if (!cancelled) setState({ scene, available: !!m?.planner?.[scene] });
    });
    return () => {
      cancelled = true;
    };
  }, [scene]);
  return state.scene === scene ? state.available : null;
}
