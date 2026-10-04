import type { CameraViewMode, ColorMapMode, RenderMode, SceneId, StressModeId } from '../types/telemetry';
import type { AppActions, AppView, DrawerTab } from '../state/AppActions';
import { INSPECTOR_DEFAULTS, replaceInspector, setInspector, type InspectorState } from '../state/inspector';
import { waitReady } from '../state/readiness';

/**
 * Helpers the tour's steps use to put the app in a known state through the app's PUBLIC actions, then wait for it
 * to settle (readiness signals, never fixed sleeps). Each step calls `ensure` with everything it needs, so any step
 * can be entered from any other: Back, Resume and Replay all work.
 */
const SETTLE_MS = 15_000;

export const frames = (n = 2) =>
  new Promise<void>((resolve) => {
    const tick = (left: number) => (left <= 0 ? resolve() : requestAnimationFrame(() => tick(left - 1)));
    tick(n);
  });

async function until(cond: () => boolean, ms = 5000): Promise<boolean> {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    if (cond()) return true;
    await frames(1);
  }
  return cond();
}

export interface Want {
  scene?: SceneId;
  view?: AppView;
  viewMode?: RenderMode;
  colour?: ColorMapMode;
  camera?: CameraViewMode;
  /** A tab to open, or null to close the drawer. */
  drawer?: DrawerTab | null;
  stress?: StressModeId;
  inspector?: Partial<InspectorState>;
}

export async function ensure(a: AppActions, w: Want): Promise<void> {
  if (w.scene && a.getSnapshot().scene !== w.scene) {
    a.selectScene(w.scene);
    await until(() => a.getSnapshot().scene === w.scene);
    await frames(2);
  }
  if (w.view) a.setView(w.view);
  if (w.viewMode && a.getSnapshot().viewMode !== w.viewMode) a.changeViewMode(w.viewMode);
  if (w.colour) a.setColorMode(w.colour);
  if (w.camera) a.setCameraMode(w.camera);
  if (w.stress) a.setStressMode(w.stress);
  if (w.drawer === null) a.closeDrawer();
  else if (w.drawer) a.openDrawer(w.drawer);
  if (w.inspector) setInspector(w.inspector);

  await frames(3);
  await waitReady('scene-data', SETTLE_MS);
  const view = a.getSnapshot().view;
  if (view === 'hook_3d') await waitReady('viewport-built', SETTLE_MS);
  else if (view === 'data_inspection') await waitReady('inspector-drawn', SETTLE_MS);
  else await waitReady('evidence-loaded', SETTLE_MS);
  // NOMINAL has no variant file (it is the scene's own snapshot), so only wait when a variant is really being loaded.
  const wantsVariant = (!!w.inspector?.preset && w.inspector.preset !== 'NOMINAL') || w.inspector?.compare === true;
  if (wantsVariant) {
    await frames(3);
    await waitReady('variant', SETTLE_MS);
  }
  await frames(2);
}

/** The state every tour starts from, so a recording always begins identically. */
export async function resetToStart(a: AppActions): Promise<void> {
  replaceInspector(INSPECTOR_DEFAULTS);
  await ensure(a, {
    scene: 'scene_a_bridge',
    view: 'hook_3d',
    viewMode: 'pipeline',
    colour: 'elevation',
    camera: 'orbit',
    drawer: null,
    stress: 'nominal',
  });
}
