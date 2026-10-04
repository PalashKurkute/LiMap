/** Small fetch helper: JSON or null, with a timeout, never throws. */
export async function fetchJson<T>(url: string, opts: { timeoutMs?: number; method?: string; signal?: AbortSignal } = {}): Promise<T | null> {
  const { timeoutMs = 2500, method = 'GET', signal } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { method, signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
