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
| **3D Explore** | The pipeline's grid cells and raw returns for a scan (default), or a labelled hand-built concept illustration. Colour by height-above-ground, class, resolution ring or Welford variance. On the bridge scene, **Fly under the bridge** (scene card) is a camera shot along the route the planner found; dragging, scrolling or a camera change takes the camera back, and **R** resets it. |
| **Map Inspector** | Canvas of every grid cell, top-down or **isometric** (heights and overhangs show). Click a cell for its ring, class, point count, mean height, variance and overhang clearance. A **foveation preset** switch re-draws the scan with the fine zone shifted for city or highway speed or a turn, with a dashed outline of where each ring sits. **Compare with uniform 5 cm** splits the canvas with a swipe divider: uniform grid on the left, FoveaGrid on the right, with occupied-cell and reserved-memory figures. |
| **Evidence** | Memory, grid fidelity by ring, segmentation accuracy by distance, speed, moving-object filtering and planner regret. Each figure is read from `benchmark/*.json` and tagged MEASURED / CALCULATED / DATASET. |

## Home screen, dashboard and the "?" help

The site is two plain HTML pages (a multi-page Vite build, no router), so any static host serves them:

- `/` is the **home screen** (`index.html`, `src/home/`): the LiMap lotus mark, one paragraph on what it is, the Team
  Abhedya logo and two buttons. It imports nothing from the dashboard and carries no figures. An old `/?tour=1` link is
  redirected to `/dashboard/?tour=1`.
- Below the first screen the home screen has **How it fits a robot** (`src/home/RobotFit.tsx`): the four stages from a scan
  to a route (scan in, grid, costmap, planner), each with what is real in this repository and what is only described, and
  a list of what is not done yet. Every sentence is taken from `docs/reference/KNOWN_LIMITATIONS.md`, `ARCHITECTURE.md` or
  the code; to add or change one, check it against those files first. It carries no figures.
- `/dashboard/` is the **dashboard** (`dashboard/index.html`, `src/main.tsx`). The logo in its header leads back home.
- The logo is `src/brand/LogoMark.tsx` (theme tokens `--brand-*`); `scripts/make-logo.mjs` writes `public/favicon.svg` and
  `public/brand/limap-logo.svg` from the same petal numbers. The team logos are in `public/brand/` (dark and light).

The small **?** icons next to each tool or feature group are `src/ui/HelpTip.tsx`; the words are one list in
`src/help/topics.ts`. A tip opens on hover (after a short delay) and on keyboard focus, can be moved onto without closing,
closes on Esc, on leaving and on a click elsewhere, and is tied to its button with `aria-describedby`. To add one, add a
topic and put `<HelpTip topic="..." />` beside the control (outside any `inert` group, so it still works when the control
is disabled). `e2e/help.spec.ts` fails if a topic is not used anywhere, or a tip does not fit the window. The honesty guard
scans `src/help/` and `src/home/` for typed numbers with units, like the tour.

## Analyze your own scan

A button at the top left of the 3D view (`src/components/AnalyzeScan.tsx`, the request in `src/data/uploadScan.ts`) sends a
SemanticKITTI / Velodyne `.bin` to `POST /api/analyze_scan`. The server builds the same snapshot the exporter writes (one
shared implementation in `dashboard/server/app.py`) on a fresh grid, and the result becomes the "Your scan" scene
(`SceneId` `'upload'`, outside the numbered 1-5 list). It is stored in memory only (`registerUpload` in
`src/data/snapshots.ts`): nothing goes to localStorage, so a reload clears it. The button is disabled unless the health
ping says the API is online; the size limit comes from `/api/health` (`max_scan_bytes`), never typed in the interface.
The scene card shows the file name, the analysis time (MEASURED on the API machine), cell and point counts and the label
source. Concept view, the fly-through, foveation presets, compare and underpass are unavailable for an upload (no
variant or planner snapshots exist for it), and each says why.

## Take the tour

A guided tour of every feature in **15 steps**: a spotlight on the real UI plus a short popover, advanced **only** by the
user (Next, Enter, the right arrow; Back or the left arrow; Esc leaves). Each step lights up everything it talks about (the
step's `anchor` plus its `also` anchors), and the lit-up controls stay clickable on `interactive` steps. It is always
available from the header button, first-time visitors also see a dismissible callout, and `/dashboard/?tour=1` starts it
directly (the flag is removed from the URL at once). `limap.welcomeSeen` records that the callout was dismissed and
`limap.tour.v2` records progress for "Resume tour". Nothing else is ever written.

While a step is getting ready the popover and spotlight stay where they were and the popover reads "Getting ready...";
when it is ready they glide to the new place (instantly under reduced motion). The overlay is one SVG with a hole per
spotlight (`TourRoot.tsx`), and the glide is `src/tour/useGlide.ts`.

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
  boundary, which exits the tour and restores the app. If the tour's code cannot be downloaded at all (a stale tab after a
  new deploy, a dropped connection), the launcher shows a message with a Reload button and the app carries on. A step
  whose data never arrives waits up to 15 seconds and is then shown anyway.
- **Deterministic start.** Every tour begins from the bridge scene, 3D view, pipeline output, orbit camera, height
  colouring, drawer closed and default inspector state.

### Adding or changing a step

Steps are data in `src/tour/steps.ts`:

```ts
{
  id: 'ring-filter',
  anchor: '[data-tour="ring-filter"]',      // a data-tour attribute on the element (or an element id)
  also: ['[data-tour="inspector-colour"]'], // more elements to light up; any that are not on screen are skipped
  title: 'Ring filter',
  body: (d) => 'A few short sentences. Values come from `d` (loaded data), never typed.',
  interactive: true,                        // the highlighted elements stay clickable
  optional: false,                          // true: skipped silently if the anchor is not on screen
  enter: ({ actions }) => ensure(actions, { scene: 'scene_a_bridge', view: 'data_inspection', inspector: { ringFilter: 0 } }),
}
```

- Each step's `enter` sets **everything it needs** through `ensure(...)`, so any step can be entered from any other
  (Back, Resume and Replay all rely on this) and waits on readiness signals, not timers.
- Keep copy to a few short sentences, naming each thing a grouped step lights up. `scripts/check-honesty.mjs` fails the build on retired claims in `src/`, and on a
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
- **Key scopes** (`src/lib/keyScope.ts`): app shortcuts (1-5, T, Shift+T, R, Space, arrows, B, ?) only fire when no scope
  has been pushed. The tour and the shortcut sheet (`src/components/ShortcutsSheet.tsx`, opened with `?` or from the
  Controls panel) each push one while they are open.
- **Lazy views** (`src/components/lazyViews.tsx`, `viewLoaders.ts`): the 3D view (with three.js), the Map Inspector and the Evidence page are
  separate chunks behind `Suspense`; the other two are prefetched once the browser is idle. Nothing outside those
  modules may import from them statically (that would pull three.js back into the main chunk), which is why the height
  colour range lives in `src/data/pipeline.ts`. Each view sits in a `ViewBoundary` (`src/components/ViewBoundary.tsx`): if its
  chunk cannot be fetched (a stale tab after a new deploy, a dropped connection) or it throws while rendering, that view
  shows a message with a Reload button, and the header, scene picker and other views keep working. The idle prefetch
  ignores its own failures.
- **Isometric projection** (`src/features/inspector/projection.ts`): world X forward, Y left, Z up. Top-down is
  `sx = ox - y*k`, `sy = oy - x*k`. Isometric (pitch 0.82 rad, yaw -0.32 rad) is
  `rotX = x*cosY - y*sinY`, `rotY = x*sinY + y*cosY`, `sx = ox - 1.05*k*rotY`,
  `sy = oy - k*sinP*rotX - (z - groundZ)*k*cosP*1.5`. `unproject` inverts it exactly on the ground plane and is what
  hit-testing and the cursor readout use. Cells are painted far to near.
- **Variant data** (foveation presets, the uniform reference): see [../../docs/DATA_VARIANTS.md](../../docs/DATA_VARIANTS.md).
- **Planner data** (`src/data/planner.ts`, `src/data/manifest.ts`): the bridge underpass replayed through the real costmap
  generator and Hybrid-A* (schema `limap.planner/1`, same document). `manifest.ts` is the one cached manifest fetch the
  variant and planner loaders share, so only files the manifest lists are requested.
- **Underpass comparison** (`src/features/inspector/underpass.ts`, `UnderpassPanels.tsx`): two panes drawn by calling
  `drawInspector` once per pane with a clip and an overlay callback, so the rings, guides and grid lines are the existing
  code. Pan and zoom are shared; the view is fitted from the data (the sideways span of the impassable cells between start
  and goal). The inspector store enforces the mode's rules in one place (`setInspector`): turning it on turns the uniform
  comparison off and forces the top-down view, and choosing Isometric turns it off.
- **Fly-through** (`src/features/viewport/flythrough.ts`, used by `ThreeViewport.tsx`): the planner's path, extended a
  little before and after, eased along its length, flown at eye height with the camera looking along it. It is
  time-based, so it takes the same time at any frame rate; it cuts to the start of the shot so it is identical every
  time, holds at the end and glides back by itself. With reduced motion it is a still pose just before the underpass and
  stays until stopped. Any drag, wheel, camera change or reset ends it. `R` now also resets the camera; before this it
  only reset the (hidden) vehicle.

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
| `resilience.spec.ts` | A view whose code fails to load (the request is aborted) shows a message with a Reload button; the idle prefetch raises no uncaught error; the header, scene picker and other views keep working. |
| `underpass.spec.ts` | The two panes draw the two exported costmaps and only the 2.5D pane has the planned path (checked on canvas pixels, light and dark); the card and pane labels equal `planner/scene_a_bridge.json`; the mode excludes the uniform comparison and ends with Isometric; scenes without a planner run cannot use it; the map still zooms and the normal view returns; a failed planner download leaves the map usable. |
| `flythrough.spec.ts` | The route maths (eased, continuous, below the vehicle height the planner used); the button is on the bridge scene's pipeline view only; reduced motion gives a still shot and Stop glides back; with animations on the shot ends by itself and a drag takes the camera back at once; `R` puts an orbited camera back. |
| `shortcuts.spec.ts` | The `?` sheet opens by key and from the Controls panel, holds focus, leaves everything behind it inert, returns focus, lists only keys the app handles, and stays out of the tour. |
| `quality.spec.ts` | Every view has one `main` landmark, one level-one heading and one banner; the MEASURED, CALCULATED, ESTIMATE and DATASET badge text reaches 4.5:1 on its own tint on every surface in both themes; the API health ping backs off while the API is down. |
| `upload.spec.ts` | With `/api/health` and `/api/analyze_scan` answered by `page.route` (the success body is a real committed snapshot with only its `meta` changed): the button is disabled offline and says why; a chosen file is POSTed raw with its name and content type; success shows "Your scan" with the stamp, time and counts; 400, 413, 500 and network errors show their message and keep the scene; an oversize file makes no request; presets, compare, underpass and fly are unavailable; a reload drops the scan and nothing is stored in the browser; keys 1-5 still work; axe-core clean (skipped unless `axe-core` or `AXE_CORE_JS` is available). |
| `home.spec.ts` | The home screen shows both logos (the team logo matching the theme) and the description in both themes; one `main`, one `h1`, one banner and footer; the buttons reach the dashboard and the tour; the dashboard logo leads home; an old `/?tour=1` redirects; no failed request or console error; no horizontal overflow at 1280 and 390 px. The "How it fits a robot" section: four stages in order, each with its real/only-described lines, the gaps list, heading order h1 > h2 > h3, the link scrolls it into view (instantly under reduced motion), readable text in both themes, no overflow at 1280 and 390 px. |
| `help.spec.ts` | Every "?" icon in the 3D view, Concept view, Controls panel, Map Inspector and Evidence opens its tip on hover with the topic's words, keeps it inside the window and closes it on leaving; keyboard focus opens it, Esc closes only the tip; every topic is used somewhere. |
| `smoke.spec.ts` / `matrix.spec.ts` | Every scene × view × theme loads with no console errors; the first-visit callout shows once. |
| `features.spec.ts` | Isometric projection maths and picking in both projections; the cursor readout; each foveation preset's outline and statistics against the exported JSON on disk; the uniform comparison's figures and keyboard-operable divider; inspector state survives leaving the view. |
| `tour.spec.ts` | Every tour step shows its anchor with the spotlight on it (and every secondary anchor lit up) and the popover on screen; while a step gets ready the popover stays where it was and never detours through the centre; nothing advances by itself; Esc, Finish and Back; the app and its saved settings are exactly as before; shortcuts are inert during the tour; resume after a reload; honest copy; with animations on, the spotlight settles on its anchor through the smooth-scrolled Evidence steps. |
| `tour-recovery.spec.ts` | The tour's code failing to load (button and `?tour=1`) shows a message and leaves the app working; a step whose variant data never arrives still shows and the tour carries on and leaves cleanly; Finish restores the app and its saved theme exactly. Shared helpers live in `tour-helpers.ts`. |

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
- A command palette was not built.
- Upstream UI work that was not wired in (a simulated traffic view and others) is kept in `parked-upstream/`.
