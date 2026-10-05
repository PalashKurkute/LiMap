# LiMap dashboard (client): developer notes

React 19 + TypeScript + Vite 8 + Tailwind v4 + Three.js. What the product does is in the [root README](../../README.md); the
presenter's tour walk-through is [docs/DEMO_RECORDING.md](../../docs/DEMO_RECORDING.md). This file holds the rules for
changing the code.

## Run

```bash
npm ci
npm run dev        # http://localhost:3000, proxies /api to the FastAPI server on :8000 (optional)
npm run build      # token guard -> tsc -> vite build -> honesty guard
npm run preview    # serve dist/
npm run lint       # oxlint
```

The app needs **no backend**: every scene is a precomputed static snapshot.

## Home screen, dashboard and the "?" help

Two plain HTML pages (a multi-page Vite build, no router), so any static host serves them:

- `/` is the **home screen** (`index.html`, `src/home/`): LiMap mark, one paragraph, team logo, two buttons. It imports
  nothing from the dashboard and carries no figures. An old `/?tour=1` redirects to `/dashboard/?tour=1`.
- **How it fits a robot** (`src/home/RobotFit.tsx`, below the first screen): the four stages from scan to route, each with what
  is real here and what is only described, plus what is not done. Every sentence comes from
  `docs/reference/KNOWN_LIMITATIONS.md`, `ARCHITECTURE.md` or the code. No figures.
- `/dashboard/` is the **dashboard** (`dashboard/index.html`, `src/main.tsx`); its header logo leads home.
- The logo is `src/brand/LogoMark.tsx` (theme tokens `--brand-*`); `scripts/make-logo.mjs` writes `public/favicon.svg` and
  `public/brand/limap-logo.svg` from the same petal numbers. The team logos are in `public/brand/` (dark and light).

The **?** icons are `src/ui/HelpTip.tsx`; the words are one list in `src/help/topics.ts`. A tip opens on hover (after a short
delay) and on focus, can be moved onto, closes on Esc, on leaving and on an outside click, and uses `aria-describedby`. To add
one: add a topic and put `<HelpTip topic="..." />` beside the control (outside any `inert` group). `e2e/help.spec.ts` fails on
an unused topic or a tip that does not fit the window.

## Analyze your own scan

`src/components/AnalyzeScan.tsx` and `src/data/uploadScan.ts` send a SemanticKITTI / Velodyne `.bin` to
`POST /api/analyze_scan`; the server builds the same snapshot the exporter writes (shared code in `dashboard/server/app.py`).
The result is the "Your scan" scene (`SceneId` `'upload'`, not in the numbered list), in memory only (`registerUpload` in
`src/data/snapshots.ts`). The button is disabled unless the health ping says the API is online; the size limit comes from
`/api/health` (`max_scan_bytes`), never typed. Features that need variant or planner snapshots say why they are unavailable.

## The tour

15 steps, advanced **only** by the user (Next, Enter, right arrow; Back or left arrow; Esc leaves). Each step lights up what it
names (`anchor` plus `also`); lit controls stay clickable on `interactive` steps. `/dashboard/?tour=1` starts it (the flag is
removed at once). `limap.welcomeSeen` (callout dismissed) and `limap.tour.v2` (progress for "Resume tour") are the only
storage. The popover says "Getting ready..." while a step loads, then glides (`src/tour/useGlide.ts`; instant under reduced
motion). The overlay is one SVG with a hole per spotlight (`TourRoot.tsx`).

Rules, enforced by `e2e/tour.spec.ts` and `e2e/tour-recovery.spec.ts`:

- **Isolated.** `TourRoot.tsx` loads lazily; only the header button and callout (`TourLauncher.tsx`) are in the main bundle.
- **Public actions only.** It changes the app through `AppActions` via `src/tour/ensure.ts`.
- **Restores everything.** It captures `actions.getSnapshot()` on start and restores it on every exit (Exit, Esc, Finish, a
  crash). The theme step does not save the theme (`setThemePreference(t, { persist: false })`).
- **Contained.** `pushScope('tour')` (`src/lib/keyScope.ts`) is released in the effect cleanup; its error boundary exits and
  restores; a failed code download shows a Reload message; a step whose data never arrives shows after 15 s.
- **Deterministic start.** Bridge scene, 3D view, pipeline output, orbit camera, height colouring, drawer closed.
- **Click wording.** App shortcuts are off during the tour, so copy says "click", never "press 3"; keys are named only as
  working outside the tour.

Steps are data in `src/tour/steps.ts`:

```ts
{
  id: 'ring-filter',
  anchor: '[data-tour="ring-filter"]',      // a data-tour attribute (or an element id)
  also: ['[data-tour="inspector-colour"]'], // more elements to light up; any not on screen are skipped
  title: 'Ring filter',
  body: (d) => 'A few short sentences. Values come from `d` (loaded data), never typed.',
  interactive: true,                        // highlighted elements stay clickable
  optional: false,                          // true: skipped silently if the anchor is not on screen
  enter: ({ actions }) => ensure(actions, { scene: 'scene_a_bridge', view: 'data_inspection', inspector: { ringFilter: 0 } }),
}
```

- `enter` sets **everything the step needs** through `ensure(...)`, so any step can be entered from any other (Back, Resume,
  Replay), and waits on readiness signals, not timers.
- Copy: a few short sentences naming each lit thing; figures interpolated from data (`pickShowcaseCell` in
  `src/tour/showcase.ts` picks the "Inspect a cell" cell). Anchors are `data-tour` attributes, separate from `data-region`.
- A step change also updates the root README, this file and `docs/DEMO_RECORDING.md`.

## Architecture notes

- **State.** `App.tsx` owns app state as `useState`. `AppActions` (context) exposes operations plus `getSnapshot()` /
  `restore()`; `AppData` exposes loaded scene data for copy that needs real values. Inspector state is the external store
  `src/state/inspector.ts`, so it survives view switches and the tour can drive it; `setInspector` enforces mode rules
  (underpass turns compare off and forces top-down; Isometric turns underpass off). Pan and zoom stay local to the canvas.
- **Readiness** (`src/state/readiness.ts`): `scene-data`, `viewport-built`, `inspector-drawn`, `evidence-loaded`, `variant`,
  mirrored to `<html data-ready>`. The tour and tests wait on these, not timers.
- **Key scopes** (`src/lib/keyScope.ts`): shortcuts (1-5, T, Shift+T, R, Space, arrows, B, ?) fire only when no scope is
  pushed; the tour and `ShortcutsSheet.tsx` each push one while open.
- **Lazy views** (`lazyViews.tsx`, `viewLoaders.ts`): the 3D view (three.js), Map Inspector and Evidence are separate chunks,
  prefetched when idle. Nothing outside them may import them statically (that pulls three.js into the main chunk; hence the
  height colour range in `src/data/pipeline.ts`). Each sits in a `ViewBoundary`: a failed chunk shows a Reload message.
- **Isometric projection** (`features/inspector/projection.ts`): X forward, Y left, Z up. Top-down `sx = ox - y*k`,
  `sy = oy - x*k`. Isometric uses pitch 0.82 rad and yaw -0.32 rad, with height drawn as `(z - groundZ)*k*cosP*1.5`.
  `unproject` inverts it on the ground plane (hit-testing, cursor readout). Cells are painted far to near.
- **Data files.** Variants (presets, uniform reference): [docs/DATA_VARIANTS.md](../../docs/DATA_VARIANTS.md). Planner
  (`src/data/planner.ts`, schema `limap.planner/1`): the bridge underpass replayed through the real costmap generator and
  Hybrid-A*; `manifest.ts` is the one manifest fetch both loaders share.
- **Underpass** (`features/inspector/underpass.ts`): `drawInspector` once per pane with a clip and overlay callback, shared pan
  and zoom. **Fly-through** (`features/viewport/flythrough.ts`): time-based, still pose under reduced motion, ended by any input.

## Data flow

1. `scripts/export_dashboard_data.py` runs the real pipeline offline and writes `public/data/` (committed): `scenes/`,
   `results/` (benchmark files with sha256), `variants/`, `planner/`, `manifest.json`.
2. `src/data/useSceneData.ts` shows the snapshot, then tries the live API (`POST /api/load_scene/<id>`) and upgrades in place;
   an API without scene data answers 503 and the snapshot stays; with neither the UI says so. It never invents data.
   The header chip states the source (Snapshot / Live API / No scene data).

After changing the pipeline or a results file, from the repo root: `.venv/Scripts/python scripts/export_dashboard_data.py`
(add `--check` to fail on stale snapshots). The real scene uses the full frame if `data/real/sequences/08/...` exists
locally, else the 5,000-point `public/kitti_sample_08.json` (stated on screen as a sparse sample).

## Theming (light / dark)

All colours are CSS variables in `src/theme/tokens.css`; `<html data-theme>` switches them. Use semantic utilities
(`bg-panel`, `text-fg-muted`, `border-line`, `bg-accent`), never raw colours. `scripts/check-tokens.mjs` (in `npm run build`)
fails on hex/rgb, Three.js `0x...` and Tailwind palette utilities (`bg-slate-900`, `text-white`); data colormaps are
allow-listed in `src/theme/colormaps.ts`. The 3D scene reads `--scene-*` through `src/theme/sceneTheme.ts` and re-colours in
place. No fixed dark fills: use `bg-panel` / `bg-subtle`; selected controls use `bg-accent text-accent-on`.

## Honesty rules

- **Every number comes from data** (API response, snapshot, `benchmark/*.json`); architectural constants live only in
  `src/lib/constants.ts`.
- **Real, labelled or removed.** An element with a real source is wired to it; one without is labelled on screen (synthetic,
  illustration, sample) or removed. No panel shows a silently generated mock.
- **"Live" is earned.** It appears only next to something polled or computed in that session; otherwise Replay, Simulated,
  Staged or Snapshot.
- **Verdicts state their criterion**, and figures carry a MEASURED, CALCULATED, ESTIMATE or DATASET tag.
- `scripts/check-honesty.mjs` (in `npm run build`) scans `src/` **and the built bundle** for retired claims and retyped
  benchmark numbers (its `STALE` list: add a figure when one is corrected), and `src/tour/`, `src/features/inspector/`,
  `src/home/`, `src/help/` for typed numbers with units (`12 MB`, `3 FPS`, `40 ms`, `2.1x`, `99.5%`). Rebuild after a fix: a stale
  string can survive in the bundle.

## Tests

```bash
npx playwright test                 # against `vite preview` with NO backend (like a cold Vercel deploy)
BASE_URL=https://<preview> npx playwright test e2e/smoke.spec.ts e2e/data.spec.ts   # a deployed preview
```

Playwright runs with `reducedMotion: 'reduce'` (software-rendered WebGL), which the app honours.

| Spec | Proves |
|---|---|
| `theme` | Light/dark reach every surface and both canvases (pixel sampling), at load and after a toggle. |
| `layout` | No overlap or overflow at 1366x768 and 1280x720. |
| `data` | Snapshot-first loading; missing snapshots, a 503 and a hung API degrade honestly; live upgrade works. |
| `evidence` | On-screen numbers equal the committed result files; provenance tags; failures shown as failures. |
| `pipeline` | 3D view draws pipeline output; legends follow colour modes; concept view labelled. |
| `resilience` | A view whose code fails to load shows a Reload message; the rest keeps working. |
| `underpass` | Both panes draw the exported costmaps, only 2.5D has the path; card equals `planner/scene_a_bridge.json`. |
| `flythrough` | Route maths; bridge pipeline view only; still shot under reduced motion; input ends it. |
| `shortcuts` | `?` sheet opens, holds focus, lists only handled keys, stays out of the tour. |
| `quality` | One `main`, h1 and banner per view; badge contrast in both themes; health ping backs off. |
| `upload` | API mocked: disabled offline, raw POST, "Your scan" shown, errors keep the scene, reload drops it. |
| `home` | Logos, landmarks, buttons, redirect, no overflow at 1280 and 390 px; "How it fits a robot" stages and link. |
| `help` | Every "?" opens on hover or focus inside the window; Esc closes only the tip; every topic is used. |
| `smoke` / `matrix` | Every scene x view x theme loads with no console errors; `matrix` writes `e2e/__out__/` shots. |
| `features` | Isometric maths, picking, readout; presets against the exported JSON; uniform comparison; state kept. |
| `tour` | Each step's anchor, spotlight and popover on screen; no auto-advance; exits restore the app; shortcuts inert; resume; honest copy. |
| `tour-recovery` | Tour code failing to load, or a step's data never arriving, leaves the app working. Helpers: `tour-helpers.ts`. |
| `shots` | Review aid, no assertions: screenshots of the 3D pipeline view (four colourings), concept view and scenes 2, 4, 5, light and dark, into `e2e/__out__/` (gitignored). |

## Layout

```
index.html, dashboard/index.html   the two pages (home, dashboard)
src/
  home/         home screen (main.tsx, HomePage, RobotFit)
  help/         topics.ts: the words behind every "?" icon
  brand/        LogoMark.tsx
  theme/        tokens.css, theme store, scene tokens, data colormaps
  data/         api, snapshot and result loaders, useSceneData, uploadScan, planner, manifest, variants
  features/     evidence/, viewport/ (legend, flythrough), inspector/ (projection, draw, underpass)
  components/   Header, ThreeViewport, DataInspectionScreen, AnalyzeScan, ShortcutsSheet, ViewBoundary
  state/        AppActions, inspector (store), readiness
  tour/         TourLauncher, TourRoot (lazy), steps, ensure, showcase, storage, useGlide
  ui/           HelpTip, Segmented, placement
  lib/          constants, format, motion, keyScope, pollDelay
scripts/        check-tokens.mjs, check-honesty.mjs
e2e/            Playwright specs
public/         data/ (generated, committed), brand/, favicon.svg, kitti_sample_08.json
```

## Known follow-ups

- `ThreeViewport.tsx` is one large effect; per-layer modules with render-on-demand are the main refactor left.
- The 3D view is rebuilt when you return from the inspector (the camera resets).
- `App.tsx` keeps separate `useState` calls (a reducer was not needed). No command palette.
- Code parked during the UI overhaul (simulated traffic view, old pages) was removed; see commits 097298d..3634111. It was a
  procedural traffic simulation drawn over the real-scan scene, a Data Matrix walkthrough modal and two unused page splits,
  all with raw colour literals. Its isometric view, readout, guides and hints were ported into the Map Inspector; its
  hard-coded car, truck, tree and curb boxes were not.
