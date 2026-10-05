import { useEffect, useState } from 'react';
import type { SceneId, VariantData, VariantFile, VariantId, VariantManifest } from '../types/telemetry';
import type { FoveaPresetId } from '../state/inspector';
import { fetchJson } from './api';
import { loadManifest } from './manifest';
import { decodeCells } from './snapshots';
import { clearReady, markReady } from '../state/readiness';

/**
 * Variant snapshots (see docs/DATA_VARIANTS.md): the same scan re-run with a foveation preset, or on a uniform 5 cm
 * reference grid. Static files like the scene snapshots. The manifest is read first and only files it lists are
 * fetched, so a missing variant is "unavailable" instead of a 404 in the console.
 */
export function loadVariantManifest(): Promise<VariantManifest | null> {
  return loadManifest().then((m) => m?.variants ?? null);
}

/** NOMINAL is the scene's base snapshot, so it has no variant file. */
export function presetVariantId(preset: FoveaPresetId): VariantId | null {
  switch (preset) {
    case 'CITY_CRUISE':
      return 'fovea_city_cruise';
    case 'HIGHWAY_EXTENDED':
      return 'fovea_highway_extended';
    case 'TURNING_LEFT':
      return 'fovea_turning_left';
    case 'TURNING_RIGHT':
      return 'fovea_turning_right';
    default:
      return null;
  }
}

const cache = new Map<string, Promise<VariantData | null>>();

export function loadVariant(scene: SceneId, id: VariantId): Promise<VariantData | null> {
  const key = `${scene}/${id}`;
  let p = cache.get(key);
  if (!p) {
    p = loadVariantManifest().then(async (manifest) => {
      const entry = manifest?.[scene]?.[id];
      if (!entry) return null;
      const file = await fetchJson<VariantFile>(`/data/${entry.file}`, { timeoutMs: 20000 });
      if (!file || file.schema !== 'limap.variant/1' || !file.cells || !file.meta) return null;
      return {
        meta: file.meta,
        cells: decodeCells(file.cells, file.meta.lattice),
        totalActive: file.cells.total_active,
        cellsSampled: file.cells.sampled,
      };
    });
    cache.set(key, p);
    p.then((v) => {
      if (!v) cache.delete(key);
    });
  }
  return p;
}

export type VariantStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

/** Loads one variant (or nothing when `id` is null). Never shows another scene's or variant's data. */
export function useVariant(scene: SceneId, id: VariantId | null): { data: VariantData | null; status: VariantStatus } {
  const [state, setState] = useState<{ key: string; data: VariantData | null; status: VariantStatus }>({
    key: '',
    data: null,
    status: 'idle',
  });
  const key = id ? `${scene}/${id}` : '';

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setState({ key, data: null, status: 'loading' });
    clearReady('variant');
    loadVariant(scene, id).then((data) => {
      if (cancelled) return;
      setState({ key, data, status: data ? 'ready' : 'unavailable' });
      if (data) markReady('variant');
    });
    return () => {
      cancelled = true;
      clearReady('variant');
    };
  }, [scene, id, key]);

  if (!id) return { data: null, status: 'idle' };
  if (state.key !== key) return { data: null, status: 'loading' };
  return { data: state.data, status: state.status };
}

/** Which variant files exist for a scene (from the manifest). Empty until the manifest has loaded. */
export function useVariantAvailability(scene: SceneId): Partial<Record<VariantId, boolean>> {
  const [state, setState] = useState<{ scene: SceneId; manifest: VariantManifest | null }>({ scene, manifest: null });
  useEffect(() => {
    let cancelled = false;
    loadVariantManifest().then((manifest) => {
      if (!cancelled) setState({ scene, manifest });
    });
    return () => {
      cancelled = true;
    };
  }, [scene]);
  const entry = state.manifest?.[scene];
  const out: Partial<Record<VariantId, boolean>> = {};
  if (entry) for (const k of Object.keys(entry) as VariantId[]) out[k] = true;
  return out;
}
