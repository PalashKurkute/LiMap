/**
 * Delay before the next API health ping. 10 s while the API answers; after consecutive misses it doubles (10, 20, 40 s)
 * up to 60 s, so a static deploy with no backend does not log a failed request every 10 s.
 */
export const pollDelayMs = (misses: number): number => Math.min(60_000, 10_000 * 2 ** Math.max(0, misses - 1));
