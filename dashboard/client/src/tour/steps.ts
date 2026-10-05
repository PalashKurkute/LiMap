import type { GridCellData, SceneData, SceneId } from '../types/telemetry';
import type { AppActions } from '../state/AppActions';
import { sceneInfo } from '../data/scenes';
import { setThemePreference } from '../theme/theme';
import { cellKey, getInspector, setInspector } from '../state/inspector';
import { CELL_BYTES } from '../lib/constants';
import { ensure, frames } from './ensure';
import type { Align } from '../ui/placement';

/**
 * The tour script. One ordered list; every step is driven by the user clicking Next (nothing advances by itself).
 * Rules for steps:
 *  - `enter` puts the app in the state the step needs through `ensure`, using only the app's public actions.
 *  - Copy is a few short sentences, and a grouped step names each thing it lights up. Any figure in it comes from
 *    `TourData` (loaded data), never typed:
 *    check-honesty.mjs enforces this for this folder.
 *  - Anchors are `data-tour="..."` attributes (or an element id on the Evidence page).
 * See dashboard/client/docs/TOUR.md.
 */
export interface TourData {
  scene: SceneId;
  sceneData: SceneData | null;
  /** The cell the "Inspect a cell" step shows off for this scene (pickShowcaseCell). */
  cell: GridCellData | null;
}

export interface TourCtx {
  actions: AppActions;
  getData: () => TourData;
}

export interface TourStep {
  id: string;
  anchor?: string;
  /** More elements to light up with the anchor (selectors). Any that are not on screen are skipped. */
  also?: string[];
  placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'center' | 'corner';
  title: string;
  body: (d: TourData) => string;
  enter?: (c: TourCtx) => Promise<void>;
  /** With a side placement: `start` puts the popover level with the anchor's top edge, `end` at its bottom edge, instead of centred on it. */
  align?: Align;
  /** The highlighted elements stay clickable (everything else is blocked). */
  interactive?: boolean;
  /** Skipped silently when its anchor is not on screen (for example a header chip hidden on narrow windows). */
  optional?: boolean;
}

const bridge = { scene: 'scene_a_bridge' as const };

const live3d = { ...bridge, view: 'hook_3d' as const, viewMode: 'pipeline' as const, drawer: null };
const inspect = (inspector: Parameters<typeof setInspector>[0]) =>
  ({ actions }: TourCtx) =>
    ensure(actions, { ...bridge, view: 'data_inspection', inspector: { projection: '2d', preset: 'NOMINAL', compare: false, selectedKey: null, ...inspector } });

/**
 * Fifteen steps. Each one lights up everything it talks about (the anchor plus `also`), and those controls stay clickable
 * where the step is `interactive`, so a presenter can click through the grouped controls while narrating.
 */
export const STEPS: TourStep[] = [
  {
    id: 'intro',
    placement: 'center',
    title: 'Welcome to LiMap',
    body: () =>
      'LiMap turns a LiDAR scan into a 2.5D grid that keeps fine cells near the vehicle and coarse cells far away. This tour shows each part in a few steps, and the ? icons across the app explain any control on their own. Click Next to move on.',
    enter: ({ actions }) => ensure(actions, { ...live3d, colour: 'elevation', camera: 'orbit' }),
  },
  {
    id: 'scenes',
    anchor: '[data-tour="scenes"]',
    also: ['[data-tour="provenance"]', '[data-tour="data-source"]'],
    placement: 'right', // beside the picker, so the stamp and the card under it stay visible
    align: 'start',
    title: 'Scenes, and what each view is',
    body: () =>
      'Four synthetic test scenes and one real SemanticKITTI scan: keys 1 to 5 switch between them, and ? lists every shortcut. The stamp says whether a view is pipeline output, a hand-built illustration or a real recording, and the header chip shows the data comes from a precomputed snapshot, so no server is needed.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, live3d),
  },
  {
    id: 'scene-card',
    anchor: '[data-tour="scene-card"]',
    title: 'What this scene shows',
    body: (d) => {
      const summary = d.sceneData?.telemetry?.telemetry?.tactical_summary;
      const lead =
        d.scene === 'scene_a_bridge' && summary?.min_clearance_m != null
          ? `A standard 2D grid is blind to overhangs. Here the grid records a minimum clearance of ${summary.min_clearance_m} m under the deck.`
          : sceneInfo(d.scene).desc + '.';
      return `${lead} The camera row switches between orbit, follow and a view straight down.`;
    },
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...live3d, camera: 'orbit' }),
  },
  {
    id: 'colour',
    anchor: '[data-tour="colour"]',
    also: ['[data-region="viewport-legend"]'],
    title: 'Four ways to colour the cells',
    body: () =>
      'Height is the mean height of each cell above the road, class is the dominant semantic class, ring shows which resolution holds each cell (small near the vehicle, large far away), and variance is the Welford running variance, high on edges, pits and clutter and low on flat road. Try each: the legend follows the colouring.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...live3d, colour: 'elevation' }),
  },
  {
    id: 'fly',
    anchor: '[data-tour="fly"]',
    optional: true, // only scenes with a planner route have the button
    title: 'Fly under the bridge',
    body: () =>
      'Click it for a camera shot along the route the 2.5D planner found through the underpass. Drag or scroll to take the camera back.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...live3d, colour: 'elevation', camera: 'orbit' }),
  },
  {
    id: 'controls',
    anchor: '[data-region="drawer"]',
    placement: 'left',
    title: 'The Controls panel',
    body: () =>
      'The Controls button in the header (or T) opens it. Layers switches between the FoveaGrid cells and the raw LiDAR returns they were built from, and range rings mark the boundaries between resolution rings. Section slides along the road to show the profile of the grid cells, where a gap means no points were observed. Stress hides half of the drawn returns to preview sparse sensing; it is a visual preview only and does not re-run the pipeline. Click the tabs to look.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...live3d, colour: 'elevation', drawer: 'displays' }),
  },
  {
    id: 'concept',
    anchor: '[data-tour="playback"]',
    also: ['[data-tour="mode-toggle"]'],
    title: 'Concept view',
    body: () =>
      'A hand-built illustration of the scenario with an illustrative drive. It is labelled as a concept and is not pipeline output. Switch back to Pipeline output at any time.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'hook_3d', viewMode: 'concept', drawer: null, stress: 'nominal' }),
  },
  {
    id: 'real',
    anchor: '[data-tour="provenance"]',
    also: ['[data-tour="scenes"]'],
    title: 'A real scan, and moving objects',
    body: (d) =>
      `${
        d.sceneData?.meta?.note?.includes('Sparse')
          ? 'A SemanticKITTI scan from a public road, coloured with dataset labels. This copy is a sparse sample, so it shows few cells.'
          : 'A SemanticKITTI scan from a public road, coloured with dataset labels.'
      } Press 3 for the Traffic scene, where the grid flags cells that belong to moving objects; how well it does that on real data is on the Evidence page.`,
    interactive: true,
    enter: ({ actions }) => ensure(actions, { scene: 'real_seq08_f00', view: 'hook_3d', viewMode: 'pipeline', colour: 'elevation', drawer: null }),
  },
  {
    id: 'inspector',
    anchor: '[data-tour="inspector-canvas"]',
    also: ['[data-tour="inspector-colour"]', '[data-tour="ring-filter"]'],
    placement: 'bottom',
    title: 'Map Inspector',
    body: () =>
      'The same cells from above. Drag to pan, scroll to zoom, and click any cell to inspect it. Colouring by overhang marks cells where something, such as a bridge deck, was recorded above the road, and the ring filter shows one resolution ring at a time so you can see how cell size changes with distance.',
    interactive: true,
    enter: inspect({ colorBy: 'overhang', ringFilter: 'all' }),
  },
  {
    id: 'cell',
    anchor: '[data-tour="cell-inspector"]',
    also: ['[data-tour="projection"]'],
    placement: 'left',
    title: 'Inspect a cell, and tilt the map',
    body: (d) =>
      `${
        d.cell
          ? `This cell sits in ring ${d.cell.ring_id} and holds ${d.cell.count} points${d.cell.clearance != null ? `, with ${d.cell.clearance} m of clearance` : ''}. Each cell is a fixed ${CELL_BYTES}-byte record of running statistics.`
          : 'Click any cell to see its ring, class, point count and height statistics.'
      } The Isometric view tilts the map so heights show: the recorded bridge deck floats above the road, and the readout at the bottom gives the position under the cursor.`,
    interactive: true,
    enter: async ({ actions, getData }) => {
      await ensure(actions, { ...bridge, view: 'data_inspection', inspector: { colorBy: 'overhang', ringFilter: 'all', projection: 'iso', preset: 'NOMINAL', compare: false } });
      const cell = getData().cell;
      if (cell) {
        const prior = getInspector().focus?.nonce ?? 0;
        setInspector({ selectedKey: cellKey(cell), focus: { x: cell.x_m, y: cell.y_m, z: cell.mean_z, zoom: 14, nonce: prior + 1 } });
        await frames(3);
      }
    },
  },
  {
    id: 'presets',
    anchor: '[data-tour="fovea-presets"]',
    also: ['[data-region="fovea-card"]'],
    title: 'Foveation presets',
    body: () =>
      'Five presets re-run this scan with the fine zone moved. Stationary keeps every ring centred on the vehicle, city speed shifts it forward so the cells ahead are sharper, highway speed reaches further ahead, and the turn presets pull it toward the turn. The dashed outline shows where each ring sits, and the pool stays at its fixed size. Each preset is this scan re-run through the grid, not a drive; click through them.',
    interactive: true,
    enter: inspect({ preset: 'CITY_CRUISE', colorBy: 'ring', ringFilter: 'all' }),
  },
  {
    id: 'compare',
    anchor: '[data-tour="compare-toggle"]',
    also: ['[data-region="compare-card"]'],
    title: 'Uniform 5 cm versus FoveaGrid',
    body: () =>
      'Drag the divider: the left half is a uniform 5 cm grid on the same scan and the right half is FoveaGrid. The panel compares occupied cells and reserved memory.',
    interactive: true,
    enter: inspect({ colorBy: 'semantics', ringFilter: 'all', compare: true, divider: 0.5 }),
  },
  {
    id: 'underpass',
    anchor: '[data-tour="inspector-canvas"]',
    also: ['[data-region="underpass-card"]'],
    placement: 'right',
    align: 'end', // the results card is at the top of the sidebar; keep the popover below it
    title: 'Underpass: one height versus 2.5D',
    body: () =>
      'The same scan becomes a costmap two ways: from a one-height grid on the left and from the 2.5D grid on the right. The planner tries the same route on each, and the panel says what it found.',
    interactive: true,
    enter: inspect({ colorBy: 'semantics', ringFilter: 'all', underpass: true }),
  },
  {
    id: 'evidence',
    anchor: '[data-region="evidence"]',
    placement: 'corner', // the anchor is the whole page
    title: 'Evidence',
    body: () =>
      'Every figure comes from a results file in the repository and carries its source. The cards cover memory, fidelity by ring, segmentation by distance, speed, moving-object filtering and planner regret, and the last one states what this does not show. Scroll to read them.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { view: 'evidence' }),
  },
  {
    id: 'finish',
    anchor: '[data-tour="theme"]',
    title: 'Light and dark, and that is the tour',
    body: () =>
      'Shift+T toggles the theme, and the 3D scene and the map follow it. The tour does not change your saved choice. Replay it any time from the header; when you close it, the dashboard goes back to how you left it.',
    enter: async ({ actions }) => {
      await ensure(actions, { ...live3d, colour: 'elevation' });
      const dark = document.documentElement.dataset.theme === 'dark';
      setThemePreference(dark ? 'light' : 'dark', { persist: false });
      await frames(4);
    },
  },
];
