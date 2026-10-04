# LiMap dashboard (client)

React 19 + TypeScript + Vite 8 + Tailwind v4 + Three.js. Shows the FoveaGrid pipeline's output in 3D, an inspectable
top-down map of the grid cells, and an Evidence page with the benchmark results.

## Run

```bash
npm ci
npm run dev        # http://localhost:3000, proxies /api to the FastAPI server on :8000 (optional)
npm run build      # token guard -> tsc -> vite build -> honesty guard
npm run preview    # serve dist/
```

The app works **without any backend**: every scene is served from precomputed static snapshots. A running API is only
used as an optional upgrade (see Data below).

## What is on screen

| View | Contents |
|---|---|
| **3D Explore** | The pipeline's grid cells and raw returns for a scan (default), or a labelled hand-built concept illustration. Colour by height-above-ground, class, resolution ring or Welford variance. |
| **Map Inspector** | Canvas of every grid cell, top-down or **isometric** (heights and overhangs show). Click a cell for its ring, class, point count, mean height, variance and overhang clearance. A **foveation preset** switch re-draws the scan with the fine zone shifted for city or highway speed or a turn, with a dashed outline of where each ring sits. **Compare with uniform 5 cm** splits the canvas with a swipe divider: uniform grid on the left, FoveaGrid on the right, with occupied-cell and reserved-memory figures. |
| **Evidence** | Memory, grid fidelity by ring, segmentation accuracy by distance, speed, moving-object filtering and planner regret. Each figure is read from `benchmark/*.json` and tagged MEASURED / CALCULATED / DATASET. |

## Take the tour

A guided tour of every feature: a spotlight on the real UI plus a short popover, advanced **only** by the user (Next,
Enter, the right arrow; Back or the left arrow; Esc leaves). It is always available from the header button, first-time
visitors also see a dismissible callout, and `?tour=1` starts it directly (the flag is removed from the URL at once).
`limap.welcomeSeen` records that the callout was dismissed and `limap.tour.v1` records progress for "Resume tour".
Nothing else is ever written.

Design rules, enforced by `e2e/tour.spec.ts`:

- **Isolated.** `src/tour/TourRoot.tsx` is loaded lazily when a tour starts; only the header button and callout
  (`TourLauncher.tsx`) are in the main bundle. The app never imports the tour's engine and works identically without it.
- **Public actions only.** The tour changes the app through `AppActions` (`src/state/AppActions.tsx`), the same operations
  a user's clicks perform, via `src/tour/ensure.ts`.
- **Restores everything.** On start it captures `actions.getSnapshot()` (scene, view, modes, drawer, inspector state,
  theme preference) and on every exit path (Exit, Esc, Finish, a crash) it restores it. The theme step changes the theme
  without saving it (`setThemePreference(t, { persist: false })`).
- **Contained.** It takes the keyboard with `pushScope('tour')` (`src/lib/keyScope.ts`) and releases it in the effect
  cleanup, so app shortcuts return even if a step throws. A render error inside the tour is caught by its own error
  boundary, which exits the tour and restores the app.
- **Deterministic start.** Every tour begins from the bridge scene, 3D view, pipeline output, orbit camera, height
  colouring, drawer closed and default inspector state.

### Adding or changing a step

Steps are data in `src/tour/steps.ts`:

```ts
{
  id: 'ring-filter',
  anchor: '[data-tour="ring-filter"]',      // a data-tour attribute on the element (or an element id)
  title: 'Ring filter',
  body: (d) => 'One or two short sentences. Values come from `d` (loaded data), never typed.',
  interactive: true,                        // the highlighted element stays clickable
  optional: false,                          // true: skipped silently if the anchor is not on screen
  enter: ({ actions }) => ensure(actions, { scene: 'scene_a_bridge', view: 'data_inspection', inspector: { ringFilter: 0 } }),
}
```

- Each step's `enter` sets **everything it needs** through `ensure(...)`, so any step can be entered from any other
  (Back, Resume and Replay all rely on this) and waits on readiness signals, not timers.
- Keep copy to two short sentences. `scripts/check-honesty.mjs` fails the build on retired claims in `src/`, and on a
  typed number with a unit (`12 MB`, `3 FPS`, `40 ms`, `2.1x`, `99.5%`) in `src/tour/` or `src/features/inspector/`.
  Interpolate from data instead; `pickShowcaseCell` (`src/tour/showcase.ts`) picks the cell the "Inspect a cell" step shows.
- Put the anchor on the element with a `data-tour="..."` attribute. `data-tour` is separate from `data-region`, which the
  tests use.

## Architecture notes

- **App state.** `App.tsx` owns it as `useState`. `AppActions` (context) exposes the operations plus
  `getSnapshot()` / `restore()`; `AppData` (context) exposes the loaded scene data for copy that needs real values.
- **Inspector state** (colour, ring filter, selection, projection, guides, preset, compare, divider, focus request) lives
  in `src/state/inspector.ts`, a small external store, so it survives switching views and the tour can drive it. Pan and
  zoom stay local to the canvas, which centres on a cell when `focus` is set.
- **Readiness signals** (`src/state/readiness.ts`): `scene-data`, `viewport-built`, `inspector-drawn`, `evidence-loaded`
  and `variant` are set when each thing has finished and mirrored to `<html data-ready="...">`. The tour and the tests
  wait on these instead of sleeping. Emitting one costs nothing and nothing in the app depends on it.
- **Key scopes** (`src/lib/keyScope.ts`): app shortcuts (1-5, T, Shift+T, R, Space, arrows, B) only fire when no scope
  has been pushed.
- **Isometric projection** (`src/features/inspector/projection.ts`): world X forward, Y left, Z up. Top-down is
  `sx = ox - y*k`, `sy = oy - x*k`. Isometric (pitch 0.82 rad, yaw -0.32 rad) is
  `rotX = x*cosY - y*sinY`, `rotY = x*sinY + y*cosY`, `sx = ox - 1.05*k*rotY`,
  `sy = oy - k*sinP*rotX - (z - groundZ)*k*cosP*1.5`. `unproject` inverts it exactly on the ground plane and is what
  hit-testing and the cursor readout use. Cells are painted far to near.
- **Variant data** (foveation presets, the uniform reference): see [../../docs/DATA_VARIANTS.md](../../docs/DATA_VARIANTS.md).

## Data flow

1. `scripts/export_dashboard_data.py` runs the real pipeline offline and writes `public/data/` (committed):
   `scenes/<id>.json` (telemetry, cells, cross-section, points), `results/<name>.json` (benchmark files with sha256), `manifest.json`.
2. `src/data/useSceneData.ts` shows the snapshot immediately, then tries the live API (`POST /api/load_scene/<id>`).
   If the API answers with data the view upgrades in place; a deployed API without scene data answers 503 and the
   snapshot stays. If neither exists the UI says so. It never invents data.
3. The header chip states the source (Snapshot / Live API / No scene data).

Regenerate snapshots after changing the pipeline or the benchmark results (from the repo root):

```bash
.venv/Scripts/python scripts/export_dashboard_data.py           # write
.venv/Scripts/python scripts/export_dashboard_data.py --check   # fail if committed snapshots are stale
```

The real SemanticKITTI scene uses the full frame if `data/real/sequences/08/...` exists locally, otherwise the 5,000-point
sample bundled in `public/kitti_sample_08.json` (stated on screen as a sparse sample).

## Theming (light / dark)

All colours live in `src/theme/tokens.css` as CSS variables; `<html data-theme>` switches them. Components use semantic
utilities (`bg-panel`, `text-fg-muted`, `border-line`, `bg-accent`) and **never** raw colours. This is enforced:

- `scripts/check-tokens.mjs` (part of `npm run build`) fails on any hex/rgb colour, Three.js `0x…` colour or Tailwind
  palette utility (`bg-slate-900`, `text-white`, …). Data colormaps are allow-listed in `src/theme/colormaps.ts`.
- The 3D scene reads `--scene-*` tokens through `src/theme/sceneTheme.ts` and re-colours **in place** on a toggle.
  The map canvas and the on-canvas legends read the same tokens.
- Don't give cards or overlays a fixed dark fill: use `bg-panel` / `bg-subtle`, or they stay dark in light mode. Selected and
  primary controls use `bg-accent text-accent-on`.

## Honesty rules

- Every number is derived from data (API response, snapshot, or `benchmark/*.json`). Architectural constants live in
  `src/lib/constants.ts` only.
- `scripts/check-honesty.mjs` (part of `npm run build`) scans the source **and** the built bundle for retired claims
  ("DRDO bound", "PROVED", "99.89", …) and for benchmark numbers retyped as literals.
- Synthetic scenes and the concept view are labelled wherever they appear. Pass/fail verdicts need a stated criterion.

## Tests

```bash
npm run lint
npx playwright test                 # runs against `vite preview` with NO backend (like a cold Vercel deploy)
BASE_URL=https://<preview> npx playwright test e2e/smoke.spec.ts e2e/data.spec.ts   # against a deployed preview
```

| Spec | Proves |
|---|---|
| `theme.spec.ts` | Light/dark reach every surface, both canvases (real pixel sampling), modals, at load **and** after a live toggle; no flash on load. Includes negative controls. |
| `layout.spec.ts` | No overlap or overflow at 1366×768 and 1280×720, with and without the side panel. |
| `data.spec.ts` | Snapshot-first loading; missing snapshots, a 503 API and a hung API all degrade honestly; live upgrade works. |
| `evidence.spec.ts` | On-screen numbers equal the committed result files; provenance tags; failures are shown as failures. |
| `pipeline.spec.ts` | The 3D view draws pipeline output, legends follow colour modes, concept view is labelled, theme re-colours cells. |
| `smoke.spec.ts` / `matrix.spec.ts` | Every scene × view × theme loads with no console errors; the first-visit callout shows once. |
| `features.spec.ts` | Isometric projection maths and picking in both projections; the cursor readout; each foveation preset's outline and statistics against the exported JSON on disk; the uniform comparison's figures and keyboard-operable divider; inspector state survives leaving the view. |
| `tour.spec.ts` | Every tour step shows its anchor with the spotlight on it and the popover on screen; nothing advances by itself; Esc, Finish and Back; the app and its saved settings are exactly as before; shortcuts are inert during the tour; resume after a reload; honest copy. |

`e2e/PARITY.md` lists every feature that existed before the overhaul and where it lives now. `e2e/__baseline__/` holds
screenshots of the app before the overhaul.

The headless browser software-renders WebGL, so Playwright runs with `reducedMotion: 'reduce'`. The app honours that
setting (no autoplay, no turret spin, throttled idle rendering), which keeps tests fast and deterministic.

## Layout

```
src/
  theme/        tokens.css, theme store, scene tokens, data colormaps
  data/         api helper, snapshot + result loaders, useSceneData, result types
  features/     evidence/ (page, charts, primitives), viewport/ (legend), inspector/ (projection, draw)
  components/   Header, ThreeViewport, DataInspectionScreen, scene card, drawer panels
  state/        AppActions (context), inspector (store), readiness (signals)
  tour/         TourLauncher (header button, callout), TourRoot (engine, lazy), steps, ensure, showcase, storage
  ui/           Segmented (one-of-N control), placement (popover placement)
  lib/          constants, format, motion, keyScope, disposeObject
scripts/        check-tokens.mjs, check-honesty.mjs
e2e/            Playwright specs
public/data/    precomputed snapshots (generated, committed)
```

## Known follow-ups

- `ThreeViewport.tsx` is still one large effect; splitting it into per-layer modules with OrbitControls and render-on-demand
  is the main remaining refactor.
- The 3D view is rebuilt when you return to it from the inspector (it unmounts); keeping it mounted would keep the camera.
- `App.tsx` still holds its state as separate `useState` calls; a reducer and a split into explore / drawer / status-bar
  components was designed but not needed for the tour.
- The Evidence view and the inspector are not code-split (one JS chunk).
- A command palette and a `?` shortcut sheet were not built.
- Upstream UI work that was not wired in (a simulated traffic view and others) is kept in `parked-upstream/`.
