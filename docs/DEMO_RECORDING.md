# Recording the demo video

The dashboard has a built-in **guided tour** that you drive with the keyboard or the Next button. It shows every
feature in a fixed order and puts the app back exactly as it was when it ends. It shows **no captions or voiceover text
beyond its short popover**: narration is yours.

## Setup

1. **Browser and screen.** A normal Chrome or Edge on a machine with a GPU, at 1920x1080 (1440x900 also fits everything).
   The headless test browser renders WebGL in software; a real GPU is much smoother.
2. **Operating-system animations on.** The app honours the OS "reduce motion" setting: with it on, concept-view playback
   starts paused and the camera and spotlight do not animate. Turn animations on (Windows: Settings > Accessibility >
   Visual effects > Animation effects) if you want the vehicle to drive and the transitions to play.
3. **Run the app.**
   ```bash
   cd dashboard/client
   npm ci
   npm run build && npm run preview     # serves on http://127.0.0.1:4173 (or `npm run dev` on :3000)
   ```
   It works with no backend: every scene is a precomputed snapshot, and the status bar shows `API: offline`. To show
   `API: online`, also start the server from the repo root with `npm run server` before opening the page.
   For the **upload demo** ("Analyze your own scan") the server must be running; with `npm run build` done it also serves
   the site, so `npm run server` and `http://127.0.0.1:8000/` is enough. Have a `.bin` ready, for example one of the
   generated scenes in `data/synthetic/` (made by `python data/generate_synthetic.py`). The button is disabled with "Needs
   the local API running" when the status bar says `API: offline`. A first upload takes a moment; the scene card then shows
   the analysis time measured on that run, the cell and point counts and the label source (heuristic unless an ONNX
   model is present). Say that the labels are not ground truth. Presets, compare, underpass and the fly-through are not
   available for an upload, because they need snapshots made in advance; a reload clears the scan.
4. **Start from the home screen.** `http://127.0.0.1:4173/` is the home screen (logos, a short description and the team);
   **Open the dashboard** goes to `/dashboard/`, and **Take the guided tour** starts the tour there. To skip the home
   screen, open `http://127.0.0.1:4173/dashboard/?tour=1` (an old `/?tour=1` link redirects to it). The flag is removed from
   the address bar immediately, so reloading does not restart the tour. The **Take the tour** button in the dashboard header
   also starts it at any time.
5. **Theme.** The tour is theme-neutral. Pick light or dark with the sun/moon button (or Shift+T) before you start. One
   step flips the theme to show it follows, without saving it, and the tour restores your choice when it ends.

## Driving the tour

| Key | Does |
|---|---|
| Right arrow, Enter (on Next) | next step |
| Left arrow | previous step |
| Esc, or the X in the popover | leave the tour (the app is restored) |

Press `?` (outside the tour) for the full list of app shortcuts. The small **?** icons next to the tools explain each one
on hover or keyboard focus, so you can point at a control during the recording without opening the tour.

Nothing advances by itself, so you control pacing. Each step first sets the app up (switching scene, view or panel) and
shows "Getting ready..." until the 3D view or map has finished drawing, while the popover and spotlight stay where they were;
click Next once it reads normally.

**Retakes.** Use Back to redo a step. If you leave part-way, the header button becomes **Resume tour** and offers
"Resume at step n" or "Start over". To see the first-visit callout again, delete the `limap.welcomeSeen` and
`limap.tour.v2` entries from the page's local storage.

## What the tour shows (15 steps)

Each step lights up everything it talks about, and those controls stay clickable, so you can click through them while you
narrate. Steps that cover several controls name each one in the popover.

| # | Step | What it lights up and says |
|---|---|---|
| 1 | Welcome | the idea: fine cells near the vehicle, coarse far away; the ? icons explain any control on their own |
| 2 | Scenes, and what each view is | the scene picker (keys 1-5), the view stamp (pipeline output, illustration or real recording) and the header data-source chip (snapshots work without a server) |
| 3 | What this scene shows | the scene card with its figure read from the snapshot, and the camera row (orbit, follow, top) |
| 4 | Four ways to colour the cells | the colour row and the legend: height, class, ring, variance. Click each |
| 5 | Fly under the bridge | a camera shot along the route the planner found under the deck. **Click it yourself**: nothing starts by itself. With OS animations off it is a still shot under the deck. Skipped if the scene has no planner route |
| 6 | The Controls panel | the whole panel: Layers (cells or raw returns, range rings), Section (the clearance slicer), Stress (the visual-only dropout preview). Click the tabs |
| 7 | Concept view | the hand-built illustration with playback, labelled as a concept, and the Pipeline/Concept switch |
| 8 | A real scan, and moving objects | the real SemanticKITTI scan (a sparse sample); press 3 for the moving-traffic scene |
| 9 | Map Inspector | the map from above, with colour-by (overhang) and the ring filter |
| 10 | Inspect a cell, and tilt the map | a cell's statistics (a showcase cell chosen from the data) and the Isometric view, where the bridge deck floats above the road |
| 11 | Foveation presets | the preset switch and the foveation card: stationary, city, highway, turn left, turn right, with the dashed outline of where each ring sits. Click through them |
| 12 | Uniform 5 cm vs FoveaGrid | the swipe comparison with MEASURED and CALCULATED figures |
| 13 | Underpass: one height vs 2.5D | the same bridge scan as two costmaps, from a one-height grid (left) and the 2.5D grid (right), with what the planner found on each |
| 14 | Evidence | the whole Evidence page: memory, fidelity, segmentation, speed, moving objects, planner regret and what this does not show, each with its source file. Scroll it |
| 15 | Light and dark, and the end | the theme follows everywhere (not saved); Replay, or Finish to restore the app |

Two things are skipped automatically: the fly-through step when the scene has no planner route, and any secondary highlight
that is not on screen (the data-source chip is hidden on narrow windows).

## Saying only what the screen supports

The dashboard is built so that every number on it comes from data and carries a MEASURED, CALCULATED or DATASET tag. Keep
your narration inside that:

- Quote figures from the **Evidence** page, not from memory or from `docs/progress_log.md`.
- The memory comparison shows a **capacity** ratio (calculated) next to the smaller **occupied-cell** saving (measured).
  Say which one you mean.
- Speed is shown as grid-only and end-to-end together. The end-to-end rate is dominated by the network and is far below
  sensor rate on a CPU.
- Foveation here is **speed and turn presets**; hazard-driven foveation is planned, not built. Each preset view is one
  scan re-run, not a drive.
- Heights are plain running mean and variance (Welford); there is no probabilistic filter on them.
- The underpass panel is **one scenario on a synthetic scene**, planned by this project's own Hybrid-A*. The one-height grid
  is this project's own naive baseline, not a competitor, so do not name a rival. The panel's cost is path length plus
  risk and steering penalties, shown next to the cost on an empty map; the 2.5D path costs more than that reference.
- The fly-through is a **camera shot** along the planner's route over the grid's cells, not a recorded drive.
- Moving-object recall is partial on real data and the Evidence page says so.
- Nothing has run on embedded hardware.
- The real scene in this repository is a sparse 5,000-point sample, not a full frame.
