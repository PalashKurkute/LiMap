/**
 * The tour's only persisted state: `limap.tour.v1` (progress) and `limap.welcomeSeen` (the first-visit callout
 * was dismissed or a tour was started). Nothing else is ever written by the tour.
 */
const KEY = 'limap.tour.v1';
const SEEN_KEY = 'limap.welcomeSeen';

export interface TourProgress {
  /** Index of the step the user last reached; resume offers to continue here. */
  lastStep: number;
  total: number;
  done: boolean;
}

export function readProgress(): TourProgress | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<TourProgress>;
    return typeof p.lastStep === 'number' ? { lastStep: p.lastStep, total: typeof p.total === 'number' ? p.total : 0, done: !!p.done } : null;
  } catch {
    return null;
  }
}

export function writeProgress(p: TourProgress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: the tour still works, it just cannot offer to resume */
  }
}

export function hasSeenIntro(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markIntroSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
}
