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
| **Map Inspector** | Top-down canvas of every grid cell. Click a cell for its ring, class, point count, mean height, variance and overhang clearance. |
| **Evidence** | Memory, grid fidelity by ring, segmentation accuracy by distance, speed, moving-object filtering and planner regret. Each figure is read from `benchmark/*.json` and tagged MEASURED / CALCULATED / DATASET. |

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
| `smoke.spec.ts` / `matrix.spec.ts` | Every scene × view × theme loads with no console errors. |

`e2e/PARITY.md` lists every feature that existed before the overhaul and where it lives now. `e2e/__baseline__/` holds
screenshots of the app before the overhaul.

The headless browser software-renders WebGL, so Playwright runs with `reducedMotion: 'reduce'`. The app honours that
setting (no autoplay, no turret spin, throttled idle rendering), which keeps tests fast and deterministic.

## Layout

```
src/
  theme/        tokens.css, theme store, scene tokens, data colormaps
  data/         api helper, snapshot + result loaders, useSceneData, result types
  features/     evidence/ (page, charts, primitives), viewport/ (legend)
  components/   Header, ThreeViewport, DataInspectionScreen, scene card, drawer panels, welcome dialog
  lib/          constants, format, motion, disposeObject
scripts/        check-tokens.mjs, check-honesty.mjs
e2e/            Playwright specs
public/data/    precomputed snapshots (generated, committed)
```

## Known follow-ups

`ThreeViewport.tsx` is still one large effect; splitting it into per-layer modules with OrbitControls and render-on-demand
is the main remaining refactor. A guided tour, command palette and uniform-vs-FoveaGrid comparison view were designed but not built.
