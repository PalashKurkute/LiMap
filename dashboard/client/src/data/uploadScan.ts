import type { SceneSnapshot } from '../types/telemetry';
import { isSnapshot } from './snapshots';

/**
 * "Analyze your own scan": POST the raw .bin to the local API and get a SceneSnapshot back.
 *
 * This does not use fetchJson, because that helper swallows error bodies and the server explains what was wrong with
 * the file ({detail: {code, message}}). Contract: POST /api/analyze_scan?name=<url-encoded file name>, the file as the
 * body with Content-Type application/octet-stream; 200 = a snapshot (+ timing_ms), 400/413 = {detail: {code, message}}.
 */
export const GENERIC_ANALYZE_ERROR = 'Could not analyze this file.';

/** A first request can include a compile step on the server, so this is generous. */
const ANALYZE_TIMEOUT_MS = 180_000;

export type AnalyzeResult = { ok: true; snapshot: SceneSnapshot } | { ok: false; message: string };

/** The server's own words when it sent a {detail: {message}} body; otherwise null. */
function serverMessage(body: unknown): string | null {
  const detail = (body as { detail?: unknown } | null)?.detail;
  const message = (detail as { message?: unknown } | null | undefined)?.message;
  return typeof message === 'string' && message.trim() ? message : null;
}

export async function analyzeScan(file: File, opts: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<AnalyzeResult> {
  const { timeoutMs = ANALYZE_TIMEOUT_MS, signal } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(`/api/analyze_scan?name=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
      signal: ctrl.signal,
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok) return { ok: false, message: serverMessage(body) ?? GENERIC_ANALYZE_ERROR };
    if (!isSnapshot(body)) return { ok: false, message: GENERIC_ANALYZE_ERROR };
    if (body.cells.n === 0) return { ok: false, message: 'The scan produced no grid cells, so there is nothing to show.' };
    return { ok: true, snapshot: body };
  } catch {
    return { ok: false, message: GENERIC_ANALYZE_ERROR };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** "8 MB", "512 KB": a byte count in words, so no limit is ever typed into the interface. */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const text = i === 0 ? String(Math.round(v)) : v >= 10 || Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(1);
  return `${text} ${units[i]}`;
}

/** Shown instead of uploading when the file is over the limit the API published in /api/health. */
export function tooLargeMessage(fileBytes: number, maxBytes: number): string {
  let file = formatBytes(fileBytes);
  let max = formatBytes(maxBytes);
  if (file === max) {
    // Barely over: rounded sizes would read as equal, so say it in bytes.
    file = `${fileBytes.toLocaleString()} bytes`;
    max = `${maxBytes.toLocaleString()} bytes`;
  }
  return `This file is ${file}, which is over the limit of ${max} for one scan.`;
}
