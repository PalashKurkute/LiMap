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
3. **Run the app** as in the root `README.md` (`npm run build && npm run preview`, then `http://127.0.0.1:4173/`). With no
   backend the status bar says `API: offline` and everything except the upload works. Record the tour that way: it is the
   tested path. For the **upload demo** run `npm run server` (it also serves the built site at `http://127.0.0.1:8000/`),
   have a `.bin` ready (e.g. from `data/synthetic/`), and say that its labels are heuristic, not ground truth. Presets,
   compare, underpass and the fly-through are not available for an upload; a reload clears it.
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
| 2 | Scenes, and what each view is | the scene picker (click a scene: app shortcuts, keys 1-5 included, are off during the tour), the view stamp (pipeline output, illustration or real recording) and the header data-source chip (snapshots work without a server) |
| 3 | What this scene shows | the scene card with its figure read from the snapshot, and the camera row (orbit, follow, top) |
| 4 | Four ways to colour the cells | the colour row and the legend: height, class, ring, variance. Click each |
| 5 | Fly under the bridge | a camera shot along the route the planner found under the deck. **Click it yourself**: nothing starts by itself. With OS animations off it is a still shot under the deck. Skipped if the scene has no planner route |
| 6 | The Controls panel | the whole panel: Layers (cells or raw returns, range rings), Section (the clearance slicer), Stress (the visual-only dropout preview). Click the tabs |
| 7 | Concept view | the hand-built illustration with playback, labelled as a concept, and the Pipeline/Concept switch |
| 8 | A real scan, and moving objects | the real SemanticKITTI scan (a sparse sample); click **Traffic** for the moving-traffic scene (keys do nothing during the tour) |
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

- Quote figures from the **Evidence** page, not from memory or old notes.
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

## Video script (3 speakers, about 3:50)

Bracketed text is what happens on screen. Cut, in order, if it runs past 4:00: "Five scenes, keys one to five." (step 2),
the Controls sentence (step 6), the Speed sentence (step 14).

**Person 1: the story (0:00-0:57).** [Home page. Show the Team Abhedya logo on "We are Team Abhedya".]
It's two in the morning. You are an unmanned ground vehicle, climbing a road no map has ever seen. No driver. No
streetlights. Just a LiDAR, throwing a hundred thousand points at the dark.
And every fraction of a second, you must decide. That shape above the road: a wall, or a bridge you can drive under? That
dark patch: a shadow, or a pothole that ends the mission? That truck beside you: will it leave a ghost on your map, a
phantom wall that never goes away?
Flatten the world to 2D, and the bridge becomes a wall. Keep it all in 3D, and you need gigabytes your onboard computer
doesn't have.
We are Team Abhedya. For DRDO's problem statement SIH26053, we built LiMap: a map that is sharp where it matters, and light
everywhere else. Let us show you the prototype. [Click "Take the guided tour".]

**Person 2: tour steps 1-10.**
- [1 Welcome. Point at the status bar "POOL: 3.2616 MB fixed".] This is LiMap. Cells are fine around our vehicle and coarse
  far away, memory is fixed at about three point three megabytes, and every tool has a question mark explaining it.
- [2 Scenes. Hover the picker, then the stamp.] Five scenes, keys one to five. The stamp always says whether this is
  pipeline output, an illustration or a real recording.
- [3 Scene card. Click Orbit, Follow, Top.] The card reads this deck's clearance from the data: one point eight metres.
- [4 Colour. Click Height, Class, Ring, Variance.] Colour by height, class, ring, or variance.
- [5 Fly. Click "Fly under the bridge".] Then fly along the route our planner found under the deck.
- [6 Controls. Click Layers, Section, Stress.] Controls switch between cells and raw returns, slice the scene for
  clearance, and preview sensor dropout, marked as visual only.
- [7 Concept view.] Concept view is a hand-built illustration, labelled as one.
- [8 Real scan; after the first sentence click "Traffic".] A real SemanticKITTI scan. And traffic: moving vehicles are
  flagged, so the map can keep out ghost walls.
- [9 Map Inspector. Colour by Overhang.] The Map Inspector, coloured by overhang: here a deck was recorded above the road.
- [10 Cell. The tour selects a cell; click Isometric.] The tour picks a cell. Tilt to isometric, and the deck floats.
  Every cell keeps two heights, ground and overhead: that's how a planner tells an underpass from a wall.

**Person 3: tour steps 11-15, the rest, the close.**
- [11 Presets. Click City, Highway, a turn.] Presets move the fine zone with the vehicle.
- [12 Compare. Point at "Reserved memory, uniform 122.1 MB", then "FoveaGrid 3.2616 MB".] A uniform five-centimetre grid
  would reserve about a hundred and twenty-two megabytes. We reserve three point three. Calculated, and labelled as such.
- [13 Underpass. Left pane, then right.] Here's the moment that matters. Same bridge, two costmaps. One height per cell:
  the deck looks like a wall, so no route. Our 2.5D grid sees the clearance and finds a way straight through.
- [14 Evidence. Scroll to Speed, then Moving objects.] Every figure here comes from result files, tagged measured,
  calculated or dataset. Grid and costmap run at about fifty-eight milliseconds median on a CPU, with a Jetson Orin next.
  Moving objects: precision around sixty-two percent, recall around forty-eight, on fifty real frames.
- [15 Theme flips. Click Finish.] (silent)
- [Point at "Analyze your own scan".] With our API running, this button grids your own LiDAR scan, live.
- [Header logo, then scroll to "How it fits a robot".] And in a robot: scan in, grid, costmap, planner, with a ROS 2
  costmap converter in the repository.
- [Scroll up to the logo and the team logo.] So, back to two in the morning. The shape above the road? A bridge, and the
  vehicle knows it fits. The dark patch? A shadow leaves no mark on LiDAR; a pothole lights up in variance. The truck?
  Flagged as moving, not a wall. All in three point three megabytes. LiMap doesn't just map the road. It tells the vehicle
  what it can drive through. We are Team Abhedya. Thank you.

## Judge Q&A

Answers use only `benchmark/*.json` and `docs/reference/KNOWN_LIMITATIONS.md`. Say "measured" or "calculated" every time.

| Question | Answer |
|---|---|
| What is your FPS? | Grid + costmap: median 57.9 ms (17.3 FPS), mean 122.0 ms (8.2 FPS, thermal throttling) on an x86 CPU, measured on 95 warm frames of seq 08. With neural segmentation on the CPU the full pipeline is 0.31 FPS, so segmentation needs a GPU or a slower separate rate; a Jetson run is next. (Do not lead with the 21.93 FPS async figure: that path runs without fresh labels, so it is a grid + costmap rate.) |
| Accuracy near vs far? | SalsaNext on 100 frames of seq 08: 88.96% overall accuracy, 42.25% mIoU; 37.96% at 0-10 m, 44.04% at 10-25 m, 30.93% at 25-50 m, and no labelled points past 50 m in that window. Published SalsaNext on the full benchmark is higher; ours is a small subset without kNN. |
| Is 935.7x real usage? | No, it is a calculated capacity ratio (3,051.8 MB dense 3D vs the 3.2616 MB pool), and it guarantees a fixed memory budget. Measured occupied cells against a uniform 5 cm 2.5D grid: 1.41x fewer. We show both. |
| Is the regret from Nav2? | No. 3.45% mean, 10.52% max regret and 0.584 m mean Fréchet distance on 5 real frames with our own Hybrid A*, using dataset labels. The ROS 2 costmap converter exists and is tested; a Nav2 planner comparison is not done. |
| Do you remove ghost trails? | The moving-object filter was measured on 50 real frames: precision 61.6%, recall 47.65%, static false positives 1.10%, 509 ghost cells carved. It is a first version (about 37% IoU, CALCULATED); learned methods do better. |
| Is the fovea adaptive? | It shifts with speed and turn presets (five presets). Hazard-driven refinement is planned, not built. |
| Off-road / Indian classes? | Not trained or evaluated yet (RELLIS-3D, IDD-3D, GOOSE planned). |
| Why should a defence UGV care? | MoRTH 2022: potholes and road anomalies caused 4,446 accidents and 1,856 deaths; a vehicle must tell a pothole, an overpass and a passing truck apart with bounded memory. See `docs/reference/PROBLEM_STATEMENT.md`. |
