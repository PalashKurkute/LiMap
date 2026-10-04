// Dynamic imports of the three heavy views. Kept apart from lazyViews.tsx (components only) so Fast Refresh keeps working.
// three.js lives in the 3D view's chunk, the Evidence page and the Map Inspector in theirs.

export const load3D = () => import('./ThreeViewport');
export const loadInspector = () => import('./DataInspectionScreen');
export const loadEvidence = () => import('../features/evidence/EvidenceView');

/**
 * Fetch the chunks the user is not looking at once the browser is idle, so switching views (or the tour) does not wait.
 * A failed prefetch is ignored: nothing depends on it, and opening the view reports any failure where the user can see it.
 */
export function prefetchViews(): void {
  const run = () => {
    for (const load of [loadInspector, loadEvidence]) load().catch(() => undefined);
  };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 4000 });
  else window.setTimeout(run, 1500);
}
