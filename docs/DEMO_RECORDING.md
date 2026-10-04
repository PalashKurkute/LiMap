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
4. **Start the tour already running:** open `http://127.0.0.1:4173/?tour=1`. The flag is removed from the address bar
   immediately, so reloading does not restart it. Or use the **Take the tour** button in the header at any time.
5. **Theme.** The tour is theme-neutral. Pick light or dark with the sun/moon button (or Shift+T) before you start. One
   step flips the theme to show it follows, without saving it, and the tour restores your choice when it ends.

## Driving the tour

| Key | Does |
|---|---|
| Right arrow, Enter (on Next) | next step |
| Left arrow | previous step |
| Esc, or the X in the popover | leave the tour (the app is restored) |

Press `?` (outside the tour) for the full list of app shortcuts.

Nothing advances by itself, so you control pacing. Each step first sets the app up (switching scene, view or panel) and
shows "Getting ready..." until the 3D view or map has finished drawing; click Next once it reads normally.

**Retakes.** Use Back to redo a step. If you leave part-way, the header button becomes **Resume tour** and offers
"Resume at step n" or "Start over". To see the first-visit callout again, delete the `limap.welcomeSeen` and
`limap.tour.v1` entries from the page's local storage.

## What the tour shows (38 steps)

| # | Step | What it shows |
|---|---|---|
| 1 | Welcome | the idea: fine cells near the vehicle, coarse far away |
| 2-4 | Scene picker, provenance stamp, data source | five scenes (keys 1-5); every view says whether it is pipeline output, an illustration or a real recording; snapshots work without a server |
| 5 | Scene card | what this scene demonstrates, with its figure read from the snapshot |
| 6-10 | Colour by height, class, ring, variance; legend | the four colourings of the pipeline's cells and the legend that follows them |
| 11-15 | Camera, what to draw, overlays, clearance slicer, dropout preview | the Controls panel: cells vs raw returns, range rings, the cross-section slicer, the visual-only dropout preview |
| 16 | Concept view | the hand-built illustration with playback, labelled as a concept |
| 17-18 | Moving objects, a real scan | the moving-traffic scene; the real SemanticKITTI scan (a sparse sample) |
| 19-23 | Map Inspector, overhang colouring, ring filter, isometric view, inspect a cell | the top-down map, overhang cells, one ring at a time, the tilted view with the bridge deck floating above the road, and a cell's statistics |
| 24-28 | Foveation presets (stationary, city, highway, turn left, turn right) | the dashed outline of where each ring sits, one step per preset |
| 29 | Uniform 5 cm vs FoveaGrid | the swipe comparison with MEASURED and CALCULATED figures |
| 30-36 | Evidence: memory, fidelity, segmentation, speed, moving objects, planner regret, limits | every figure with its source file; ends on "What this does not show" |
| 37 | Light and dark | the theme follows everywhere |
| 38 | Finish | Replay, or Finish to restore the app |

Two steps are skipped automatically if their element is not on screen (the data-source chip is hidden on narrow windows,
and the isometric toggle if that view is unavailable).

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
- Moving-object recall is partial on real data and the Evidence page says so.
- Nothing has run on embedded hardware.
- The real scene in this repository is a sparse 5,000-point sample, not a full frame.
