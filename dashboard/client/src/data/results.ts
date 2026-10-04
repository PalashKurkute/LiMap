import { useEffect, useState } from 'react';
import type { ResultEnvelope } from '../types/telemetry';
import { fetchJson } from './api';

export type ResultName = 'fidelity' | 'latency' | 'miou' | 'mos' | 'regret' | 'edge_profile';

const cache = new Map<string, Promise<ResultEnvelope | null>>();

/** Benchmark result file with provenance. Static copy first (works on the deployed site), API as fallback. */
export function loadResult<T = unknown>(name: ResultName): Promise<ResultEnvelope<T> | null> {
  let p = cache.get(name);
  if (!p) {
    p = fetchJson<ResultEnvelope>(`/data/results/${name}.json`, { timeoutMs: 8000 }).then(
      (r) => r ?? fetchJson<ResultEnvelope>(`/api/results/${name}`),
    );
    cache.set(name, p);
  }
  return p as Promise<ResultEnvelope<T> | null>;
}

export function useResult<T = unknown>(name: ResultName): { result: ResultEnvelope<T> | null; loading: boolean } {
  const [state, setState] = useState<{ result: ResultEnvelope<T> | null; loading: boolean }>({ result: null, loading: true });
  useEffect(() => {
    let live = true;
    loadResult<T>(name).then((result) => live && setState({ result, loading: false }));
    return () => {
      live = false;
    };
  }, [name]);
  return state;
}
