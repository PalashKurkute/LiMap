# Parked upstream work

Files from `origin/main` (commits 097298d..3634111, Oct 2026) that were **not wired into the app** when `ui/demo-ready`
was merged. They live outside `src/` so the token guard (`scripts/check-tokens.mjs`), `tsc -b` and the bundle ignore them.
Nothing here was deleted; the original commits are in git history.

| File(s) | What it is | Why it is parked |
|---|---|---|
| `traffic/*`, `components/CityDrivingViewport.tsx` | Procedural lane-graph + IDM traffic simulation drawn on the "Real City Driving" scene | Entirely **simulated**; it replaced the real SemanticKITTI pipeline output on a scene labelled real. ~140 raw colour literals (white theme), so it cannot follow the light/dark toggle. |
| `components/MatrixWalkthroughModal.tsx` | 4-step guide for the Data Matrix page | ~70 raw colour literals. |
| `pages/HomePage.tsx`, `pages/DataInspectionPage.tsx` | Page split of App.tsx | Never imported by anything upstream (dead code). |

Also not carried over from upstream's `DataInspectionScreen`: hard-coded "CAR #1 / CAR #2 / TRUCK #3 / TREE" 3D boxes drawn
on every scene (they ignore the data), the 2D/3D isometric toggle and the cell-size slider.

To bring a piece back: re-theme it with the semantic tokens (`bg-panel`, `text-fg`, `--scene-*`), import it from `src/`,
label anything simulated, and make `npm run build` pass.
