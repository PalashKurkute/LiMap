import { useSyncExternalStore } from 'react';

/**
 * Passive readiness signals ("the 3D view finished building", "the inspector drew cells" ...).
 * Emitting a signal costs nothing and nothing depends on it, but the tour and the tests wait on these
 * instead of sleeping. The set is mirrored to <html data-ready="a b c"> so Playwright can wait with
 * `[data-ready~="viewport-built"]`.
 */
export type ReadyKey = 'scene-data' | 'viewport-built' | 'inspector-drawn' | 'evidence-loaded' | 'variant' | 'planner';

const ready = new Set<ReadyKey>();
const listeners = new Set<() => void>();
let version = 0;

function publish(): void {
  version++;
  if (typeof document !== 'undefined') document.documentElement.dataset.ready = [...ready].join(' ');
  listeners.forEach((l) => l());
}

export function markReady(key: ReadyKey): void {
  if (ready.has(key)) return;
  ready.add(key);
  publish();
}

export function clearReady(key: ReadyKey): void {
  if (!ready.delete(key)) return;
  publish();
}

export function isReady(key: ReadyKey): boolean {
  return ready.has(key);
}

/** Resolves true once `key` is ready, or false after `ms`. Never rejects. */
export function waitReady(key: ReadyKey, ms = 10_000): Promise<boolean> {
  if (ready.has(key)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      listeners.delete(check);
      clearTimeout(timer);
      resolve(ok);
    };
    const check = () => {
      if (ready.has(key)) done(true);
    };
    const timer = setTimeout(() => done(false), ms);
    listeners.add(check);
  });
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useReady(key: ReadyKey): boolean {
  useSyncExternalStore(subscribe, () => version, () => 0);
  return ready.has(key);
}
