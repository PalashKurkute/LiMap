import { createContext, useContext } from 'react';
import type {
  SceneData,
  CameraViewMode,
  ColorMapMode,
  DEMDisplayMode,
  RenderMode,
  SceneId,
  StressModeId,
} from '../types/telemetry';
import type { ThemePreference } from '../theme/theme';
import type { InspectorState } from './inspector';

/**
 * The app's public control surface. These are the same operations a user's clicks perform; anything that drives
 * the app programmatically (the guided tour) must go through here and nowhere else, so it can never put the app
 * in a state a user could not reach.
 */
export type AppView = 'hook_3d' | 'data_inspection' | 'evidence';
export type DrawerTab = 'displays' | 'telemetry' | 'proofs' | 'stress';

/** Everything the tour changes, captured so it can be restored exactly. */
export interface AppSnapshot {
  scene: SceneId;
  view: AppView;
  viewMode: RenderMode;
  cameraMode: CameraViewMode;
  displayMode: DEMDisplayMode;
  colorMode: ColorMapMode;
  drawerOpen: boolean;
  drawerTab: DrawerTab;
  stressMode: StressModeId;
  playing: boolean;
  frame: number;
  inspector: InspectorState;
  theme: ThemePreference;
}

export interface AppActions {
  selectScene: (id: SceneId) => void;
  setView: (view: AppView) => void;
  changeViewMode: (mode: RenderMode) => void;
  setColorMode: (mode: ColorMapMode) => void;
  setCameraMode: (mode: CameraViewMode) => void;
  setDisplayMode: (mode: DEMDisplayMode) => void;
  openDrawer: (tab?: DrawerTab) => void;
  closeDrawer: () => void;
  setPlaying: (playing: boolean) => void;
  seekFrame: (frame: number) => void;
  setStressMode: (mode: StressModeId) => void;
  /** Current app state (read through a ref, so it is never stale). */
  getSnapshot: () => AppSnapshot;
  /** Put the app back exactly as `getSnapshot` captured it. Does not write any saved preference. */
  restore: (snapshot: AppSnapshot) => void;
}

export const AppActionsContext = createContext<AppActions | null>(null);

export function useAppActions(): AppActions {
  const actions = useContext(AppActionsContext);
  if (!actions) throw new Error('useAppActions must be used inside <App>');
  return actions;
}

/** Loaded data for the active scene, for anything that needs to put real values into text (the tour's copy). */
export interface AppData {
  scene: SceneId;
  sceneData: SceneData | null;
}

export const AppDataContext = createContext<AppData>({ scene: 'scene_a_bridge', sceneData: null });

export function useAppData(): AppData {
  return useContext(AppDataContext);
}
