import { useEffect, useState } from 'react';
import type { CrossSectionResponse, GridCellData, SceneData, SceneId, TelemetryResponse } from '../types/telemetry';
import { fetchJson } from './api';
import { decodeCells, loadSceneSnapshot, prefetchSnapshots } from './snapshots';

export type SceneStatus = 'loading' | 'ready' | 'unavailable';

const ALL_SCENES: SceneId[] = ['scene_a_bridge', 'scene_b_potholes', 'scene_c_moving', 'scene_d_poles', 'real_seq08_f00'];
const LIVE_CELL_LIMIT = 20000;

interface LiveCells {
  total_active: number;
  sampled?: boolean;
  cells: GridCellData[];
}

/**
 * Data for the active scene.
 *  1. The precomputed pipeline snapshot is shown immediately (static file, no backend needed).
 *  2. If the API is reachable AND has the scene's data, the view upgrades to live data in place.
 * Nothing is ever invented: with neither source the status is 'unavailable'.
 */
export function useSceneData(sceneId: SceneId): { data: SceneData | null; status: SceneStatus } {
  const [state, setState] = useState<{ sceneId: SceneId; data: SceneData | null; status: SceneStatus }>({
    sceneId,
    data: null,
    status: 'loading',
  });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ sceneId, data: s.sceneId === sceneId ? s.data : null, status: 'loading' }));

    (async () => {
      const snap = await loadSceneSnapshot(sceneId);
      if (cancelled) return;

      let snapshotData: SceneData | null = null;
      if (snap) {
        snapshotData = {
          source: 'snapshot',
          meta: snap.meta,
          telemetry: snap.telemetry,
          crossSection: snap.cross_section,
          cells: decodeCells(snap.cells, snap.meta.lattice),
          totalActive: snap.cells.total_active,
          cellsSampled: snap.cells.sampled,
          points: snap.points,
        };
        setState({ sceneId, data: snapshotData, status: 'ready' });
        prefetchSnapshots(ALL_SCENES.filter((id) => id !== sceneId));
      } else {
        setState({ sceneId, data: null, status: 'unavailable' });
      }

      // Best-effort upgrade to the live API. A deployed API without scene data answers 503 and we stay on the snapshot.
      const loaded = await fetchJson<{ status: string; label_source?: 'gt' | 'onnx' | 'heuristic' }>(
        `/api/load_scene/${sceneId}`,
        { method: 'POST', timeoutMs: 8000 },
      );
      if (cancelled || !loaded || loaded.status !== 'SUCCESS') return;
      const [telemetry, crossSection, live] = await Promise.all([
        fetchJson<TelemetryResponse>('/api/telemetry'),
        fetchJson<CrossSectionResponse>('/api/cross_section'),
        fetchJson<LiveCells>(`/api/grid_cells?limit=${LIVE_CELL_LIMIT}`, { timeoutMs: 8000 }),
      ]);
      if (cancelled || !telemetry || !live || live.cells.length === 0 || telemetry.telemetry.active_cells === 0) return;

      setState({
        sceneId,
        status: 'ready',
        data: {
          source: 'live',
          meta: snapshotData?.meta ? { ...snapshotData.meta, label_source: loaded.label_source ?? snapshotData.meta.label_source } : null,
          telemetry,
          crossSection: crossSection ?? snapshotData?.crossSection ?? null,
          cells: live.cells,
          totalActive: live.total_active,
          cellsSampled: !!live.sampled,
          points: snapshotData?.points ?? null,
        },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [sceneId]);

  // While switching scenes, never show the previous scene's data as if it were the new one.
  if (state.sceneId !== sceneId) return { data: null, status: 'loading' };
  return { data: state.data, status: state.status };
}
