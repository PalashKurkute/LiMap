import { readToken, type ResolvedTheme } from './theme';

/** Resolved 3D-scene colours/intensities for the active theme (read from the --scene-* CSS tokens). */
export interface SceneTokens {
  theme: ResolvedTheme;
  bg: string;
  gridMajor: string;
  gridMinor: string;
  ring: [string, string, string, string];
  reticle: string;
  path: string;
  ugv: string;
  ugvTrim: string;
  ugvAccent: string;
  prop: string;
  prop2: string;
  pole: string;
  track: string;
  ambient: number;
  key: number;
}

export function readSceneTokens(theme: ResolvedTheme): SceneTokens {
  const t = (name: string) => readToken(name, 'gray');
  const n = (name: string, fallback: number) => {
    const v = parseFloat(readToken(name));
    return Number.isFinite(v) ? v : fallback;
  };
  return {
    theme,
    bg: t('--scene-bg'),
    gridMajor: t('--scene-grid-major'),
    gridMinor: t('--scene-grid-minor'),
    ring: [t('--scene-ring-0'), t('--scene-ring-1'), t('--scene-ring-2'), t('--scene-ring-3')],
    reticle: t('--scene-reticle'),
    path: t('--scene-path'),
    ugv: t('--scene-ugv'),
    ugvTrim: t('--scene-ugv-trim'),
    ugvAccent: t('--scene-ugv-accent'),
    prop: t('--scene-prop'),
    prop2: t('--scene-prop-2'),
    pole: t('--scene-pole'),
    track: t('--scene-track'),
    ambient: n('--scene-ambient', 0.9),
    key: n('--scene-key', 1.2),
  };
}
