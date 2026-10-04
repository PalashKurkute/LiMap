import { useSyncExternalStore } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'limap.theme';

function readStored(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system'; // storage blocked (private window etc.)
  }
}

function systemTheme(): ResolvedTheme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let preference: ThemePreference = readStored();
let resolved: ResolvedTheme = preference === 'system' ? systemTheme() : preference;
const listeners = new Set<() => void>();

function apply(next: ResolvedTheme): void {
  const root = document.documentElement;
  // One frame without transitions so surfaces switch together instead of sweeping.
  root.setAttribute('data-theme-switching', '');
  root.dataset.theme = next;
  root.style.colorScheme = next;
  requestAnimationFrame(() => requestAnimationFrame(() => root.removeAttribute('data-theme-switching')));
}

function emit(): void {
  listeners.forEach((l) => l());
}

/**
 * `persist: false` changes the theme for this session only (the tour uses it so it never overwrites the user's
 * saved choice). Restore with setThemePreference(getThemePreference()) captured beforehand.
 */
export function setThemePreference(next: ThemePreference, opts: { persist?: boolean } = {}): void {
  preference = next;
  if (opts.persist !== false) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore: preference just won't persist */
    }
  }
  const nextResolved = next === 'system' ? systemTheme() : next;
  if (nextResolved !== resolved || document.documentElement.dataset.theme !== nextResolved) {
    resolved = nextResolved;
    apply(resolved);
  }
  emit();
}

export function getThemePreference(): ThemePreference {
  return preference;
}

export function toggleTheme(): void {
  setThemePreference(resolved === 'dark' ? 'light' : 'dark');
}

if (typeof matchMedia === 'function') {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (preference !== 'system') return;
    const next = systemTheme();
    if (next !== resolved) {
      resolved = next;
      apply(resolved);
      emit();
    }
  });
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useTheme(): { theme: ResolvedTheme; preference: ThemePreference } {
  const theme = useSyncExternalStore(subscribe, () => resolved, () => 'light' as ResolvedTheme);
  const pref = useSyncExternalStore(subscribe, () => preference, () => 'system' as ThemePreference);
  return { theme, preference: pref };
}

/** Reads a CSS custom property from <html>, e.g. readToken('--scene-bg'). Falls back to `fallback`. */
export function readToken(name: string, fallback = ''): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Makes sure the DOM attribute matches the store (the inline script in index.html normally did this already). */
export function initTheme(): void {
  if (document.documentElement.dataset.theme !== resolved) apply(resolved);
}
