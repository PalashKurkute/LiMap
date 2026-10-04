import React, { lazy } from 'react';
import { load3D, loadEvidence, loadInspector } from './viewLoaders';

// The three heavy views load on demand, so the first paint only needs the shell (see viewLoaders.ts).

export const ThreeViewport = lazy(() => load3D().then((m) => ({ default: m.ThreeViewport })));
export const DataInspectionScreen = lazy(() => loadInspector().then((m) => ({ default: m.DataInspectionScreen })));
export const EvidenceView = lazy(() => loadEvidence().then((m) => ({ default: m.EvidenceView })));

/** Shown for the moment a view's code is being fetched. */
export const ViewLoading: React.FC<{ label: string }> = ({ label }) => (
  <div
    role="status"
    className="absolute inset-0 flex items-center justify-center text-xs font-mono text-fg-muted"
    style={{ backgroundColor: 'var(--bg-primary)' }}
  >
    {label}
  </div>
);
