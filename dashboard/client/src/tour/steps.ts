import type { GridCellData, SceneData, SceneId } from '../types/telemetry';
import type { AppActions } from '../state/AppActions';
import { sceneInfo } from '../data/scenes';
import { setThemePreference } from '../theme/theme';
import { cellKey, getInspector, setInspector, type FoveaPresetId } from '../state/inspector';
import { CELL_BYTES } from '../lib/constants';
import { ensure, frames } from './ensure';
import type { Align } from '../ui/placement';

/**
 * The tour script. One ordered list; every step is driven by the user clicking Next (nothing advances by itself).
 * Rules for steps:
 *  - `enter` puts the app in the state the step needs through `ensure`, using only the app's public actions.
 *  - Copy is at most two short sentences. Any figure in it comes from `TourData` (loaded data), never typed:
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
  placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'center';
  title: string;
  body: (d: TourData) => string;
  enter?: (c: TourCtx) => Promise<void>;
  /** With a side placement: `end` puts the popover at the anchor's bottom edge instead of centred on it. */
  align?: Align;
  /** The highlighted element stays clickable (everything else is blocked). */
  interactive?: boolean;
  /** Skipped silently when its anchor is not on screen (for example a header chip hidden on narrow windows). */
  optional?: boolean;
}

const bridge = { scene: 'scene_a_bridge' as const };

const presetStep = (preset: FoveaPresetId, title: string, body: string): TourStep => ({
  id: `preset-${preset.toLowerCase()}`,
  anchor: '[data-tour="fovea-presets"]',
  title,
  body: () => body,
  interactive: true,
  enter: ({ actions }) =>
    ensure(actions, {
      ...bridge,
      view: 'data_inspection',
      inspector: { preset, compare: false, projection: '2d', colorBy: 'ring', ringFilter: 'all', selectedKey: null },
    }),
});

const evidenceStep = (id: string, title: string, body: string): TourStep => ({
  id,
  anchor: `#${id}`,
  title,
  body: () => body,
  enter: ({ actions }) => ensure(actions, { view: 'evidence' }),
});

export const STEPS: TourStep[] = [
  {
    id: 'intro',
    placement: 'center',
    title: 'Welcome to LiMap',
    body: () =>
      'LiMap turns a LiDAR scan into a 2.5D grid that keeps fine cells near the vehicle and coarse cells far away. This tour shows each part. Click Next to move on.',
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'hook_3d', viewMode: 'pipeline', colour: 'elevation', camera: 'orbit', drawer: null }),
  },
  {
    id: 'scenes',
    anchor: '[data-tour="scenes"]',
    title: 'Pick a scene',
    body: () => 'Four synthetic test scenes and one real SemanticKITTI scan. The number keys switch between them, and ? lists every shortcut.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'hook_3d', viewMode: 'pipeline', drawer: null }),
  },
  {
    id: 'provenance',
    anchor: '[data-tour="provenance"]',
    title: 'Every view says what it is',
    body: () => 'This stamp states whether you are looking at pipeline output, a hand-built illustration or a real recording.',
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'hook_3d', viewMode: 'pipeline', drawer: null }),
  },
  {
    id: 'data-source',
    anchor: '[data-tour="data-source"]',
    optional: true,
    title: 'Where the data comes from',
    body: () => 'Scenes load from precomputed snapshots, so the dashboard works without a server. When the live API is running it takes over.',
    enter: ({ actions }) => ensure(actions, { view: 'hook_3d' }),
  },
  {
    id: 'scene-card',
    anchor: '[data-tour="scene-card"]',
    title: 'What this scene shows',
    body: (d) => {
      const summary = d.sceneData?.telemetry?.telemetry?.tactical_summary;
      if (d.scene === 'scene_a_bridge' && summary?.min_clearance_m != null) {
        return `A standard 2D grid is blind to overhangs. Here the grid records a minimum clearance of ${summary.min_clearance_m} m under the deck.`;
      }
      return sceneInfo(d.scene).desc + '.';
    },
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'hook_3d', viewMode: 'pipeline', drawer: null }),
  },
  {
    id: 'colour-height',
    anchor: '[data-tour="colour"]',
    title: 'Colour by height',
    body: () => 'Each cell is coloured by the mean height of its points above the road.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'hook_3d', viewMode: 'pipeline', colour: 'elevation', drawer: null }),
  },
  {
    id: 'colour-class',
    anchor: '[data-tour="colour"]',
    title: 'Colour by class',
    body: () => 'The dominant semantic class of the points in each cell. The legend on the left lists the classes present.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'hook_3d', viewMode: 'pipeline', colour: 'semantics', drawer: null }),
  },
  {
    id: 'colour-ring',
    anchor: '[data-tour="colour"]',
    title: 'Colour by ring',
    body: () => 'Cells near the vehicle are small and cells far away are large. The ring shows which resolution holds each cell.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'hook_3d', viewMode: 'pipeline', colour: 'ring', drawer: null }),
  },
  {
    id: 'colour-variance',
    anchor: '[data-tour="colour"]',
    title: 'Colour by variance',
    body: () => 'Welford running variance of height. It is high on edges, pits and clutter, and low on flat road.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'hook_3d', viewMode: 'pipeline', colour: 'variance', drawer: null }),
  },
  {
    id: 'legend',
    anchor: '[data-region="viewport-legend"]',
    title: 'The legend follows the colouring',
    body: () => 'It always matches the active colour mode, so a colour is never left unexplained.',
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'hook_3d', viewMode: 'pipeline', colour: 'variance', drawer: null }),
  },
  {
    id: 'camera',
    anchor: '[data-tour="camera"]',
    title: 'Camera',
    body: () => 'Orbit with the mouse, follow the vehicle, or look straight down.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'hook_3d', viewMode: 'pipeline', colour: 'elevation', camera: 'orbit', drawer: null }),
  },
  {
    id: 'fly',
    anchor: '[data-tour="fly"]',
    optional: true, // only scenes with a planner route have the button
    title: 'Fly under the bridge',
    body: () =>
      'Click it for a camera shot along the route the 2.5D planner found through the underpass. Drag or scroll to take the camera back.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'hook_3d', viewMode: 'pipeline', colour: 'elevation', camera: 'orbit', drawer: null }),
  },
  {
    id: 'draw-mode',
    anchor: '[data-tour="draw-mode"]',
    placement: 'left',
    title: 'What to draw',
    body: () => 'Switch between the FoveaGrid cells and the raw LiDAR returns they were built from. The Controls button opens this panel.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'hook_3d', viewMode: 'pipeline', colour: 'elevation', drawer: 'displays' }),
  },
  {
    id: 'overlays',
    anchor: '[data-tour="overlays"]',
    placement: 'left',
    title: 'Overlays',
    body: () => 'Range rings mark the boundaries between resolution rings.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'hook_3d', viewMode: 'pipeline', drawer: 'displays' }),
  },
  {
    id: 'cross-section',
    anchor: '[data-tour="cross-section"]',
    placement: 'left',
    title: 'Clearance slicer',
    body: () => 'Slide along the road to see the profile of the grid cells. A gap means no points were observed there.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'hook_3d', viewMode: 'pipeline', drawer: 'proofs' }),
  },
  {
    id: 'stress',
    anchor: '[data-tour="stress-panel"]',
    placement: 'left',
    title: 'Dropout preview',
    body: () => 'Hides half of the drawn returns to preview sparse sensing. It is a visual preview only and does not re-run the pipeline.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'hook_3d', viewMode: 'pipeline', drawer: 'stress' }),
  },
  {
    id: 'concept',
    anchor: '[data-tour="playback"]',
    title: 'Concept view',
    body: () => 'A hand-built illustration of the scenario with an illustrative drive. It is labelled as a concept and is not pipeline output.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'hook_3d', viewMode: 'concept', drawer: null, stress: 'nominal' }),
  },
  {
    id: 'moving',
    anchor: '[data-tour="scene-card"]',
    title: 'Moving objects',
    body: () => 'The grid flags cells that belong to moving objects. How well it does that on real data is on the Evidence page.',
    enter: ({ actions }) => ensure(actions, { scene: 'scene_c_moving', view: 'hook_3d', viewMode: 'pipeline', colour: 'semantics', drawer: null }),
  },
  {
    id: 'real',
    anchor: '[data-tour="provenance"]',
    title: 'A real scan',
    body: (d) =>
      d.sceneData?.meta?.note?.includes('Sparse')
        ? 'A SemanticKITTI scan from a public road, coloured with dataset labels. This copy is a sparse sample, so it shows few cells.'
        : 'A SemanticKITTI scan from a public road, coloured with dataset labels.',
    enter: ({ actions }) => ensure(actions, { scene: 'real_seq08_f00', view: 'hook_3d', viewMode: 'pipeline', colour: 'elevation', drawer: null }),
  },
  {
    id: 'inspector',
    anchor: '[data-tour="inspector-canvas"]',
    placement: 'bottom',
    title: 'Map Inspector',
    body: () => 'The same cells from above. Drag to pan, scroll to zoom, and click any cell to inspect it.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'data_inspection', inspector: { colorBy: 'semantics', ringFilter: 'all', projection: '2d', preset: 'NOMINAL', compare: false, selectedKey: null } }),
  },
  {
    id: 'inspector-colour',
    anchor: '[data-tour="inspector-colour"]',
    title: 'Overhang colouring',
    body: () => 'Cells where something was recorded above the road, such as a bridge deck, are marked.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'data_inspection', inspector: { colorBy: 'overhang', ringFilter: 'all', projection: '2d', preset: 'NOMINAL', compare: false, selectedKey: null } }),
  },
  {
    id: 'ring-filter',
    anchor: '[data-tour="ring-filter"]',
    title: 'Ring filter',
    body: () => 'Show one resolution ring at a time to see how cell size changes with distance.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'data_inspection', inspector: { colorBy: 'ring', ringFilter: 0, projection: '2d', preset: 'NOMINAL', compare: false, selectedKey: null } }),
  },
  {
    id: 'isometric',
    anchor: '[data-tour="projection"]',
    optional: true,
    title: 'Isometric view',
    body: () => 'Tilts the map so heights show: the recorded bridge deck floats above the road. The readout at the bottom gives the position under the cursor.',
    interactive: true,
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'data_inspection', inspector: { colorBy: 'overhang', ringFilter: 'all', projection: 'iso', preset: 'NOMINAL', compare: false, selectedKey: null } }),
  },
  {
    id: 'cell',
    anchor: '[data-tour="cell-inspector"]',
    placement: 'left',
    title: 'Inspect a cell',
    body: (d) =>
      d.cell
        ? `This cell sits in ring ${d.cell.ring_id} and holds ${d.cell.count} points${d.cell.clearance != null ? `, with ${d.cell.clearance} m of clearance` : ''}. Each cell is a fixed ${CELL_BYTES}-byte record of running statistics.`
        : 'Click any cell to see its ring, class, point count and height statistics.',
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
  presetStep('NOMINAL', 'Foveation: stationary', 'With the vehicle at rest every ring is centred on it.'),
  presetStep('CITY_CRUISE', 'Foveation: city speed', 'At city speed the fine zone shifts forward so the cells ahead are sharper. The dashed outline shows where each ring now sits.'),
  presetStep('HIGHWAY_EXTENDED', 'Foveation: highway speed', 'At highway speed the fine zone reaches further ahead.'),
  presetStep('TURNING_LEFT', 'Foveation: turning left', 'In a turn the fine zone shifts forward and toward the turn. Each preset is this scan re-run through the grid, not a drive.'),
  presetStep('TURNING_RIGHT', 'Foveation: turning right', 'The same shift to the right. The pool stays at its fixed size for every preset.'),
  {
    id: 'compare',
    anchor: '[data-tour="compare-toggle"]',
    title: 'Uniform 5 cm versus FoveaGrid',
    body: () =>
      'Drag the divider: the left half is a uniform 5 cm grid on the same scan and the right half is FoveaGrid. The panel compares occupied cells and reserved memory.',
    interactive: true,
    enter: ({ actions }) =>
      ensure(actions, { ...bridge, view: 'data_inspection', inspector: { colorBy: 'semantics', ringFilter: 'all', projection: '2d', preset: 'NOMINAL', compare: true, divider: 0.5, selectedKey: null } }),
  },
  {
    id: 'underpass',
    anchor: '[data-tour="inspector-canvas"]',
    placement: 'right',
    align: 'end', // the results card is at the top of the sidebar; keep the popover below it
    title: 'Underpass: one height versus 2.5D',
    body: () =>
      'The same scan becomes a costmap two ways: from a one-height grid on the left and from the 2.5D grid on the right. The planner tries the same route on each, and the panel above says what it found.',
    interactive: true,
    enter: ({ actions }) =>
      ensure(actions, {
        ...bridge,
        view: 'data_inspection',
        inspector: { colorBy: 'semantics', ringFilter: 'all', projection: '2d', preset: 'NOMINAL', compare: false, underpass: true, selectedKey: null },
      }),
  },
  evidenceStep('ev-memory', 'Memory', 'A fixed pool versus dense maps. Capacity ratios are calculated; the measured saving in occupied cells is smaller, and both are shown.'),
  evidenceStep('ev-fidelity', 'Fidelity by ring', 'What the coarser far rings cost in accuracy, including the curbs that do not survive.'),
  evidenceStep('ev-segmentation', 'Segmentation by distance', 'Accuracy of the pretrained network, broken down by distance band.'),
  evidenceStep('ev-speed', 'Speed', 'Grid-only and end-to-end rates, always shown together because the network dominates the cost of a frame.'),
  evidenceStep('ev-mos', 'Moving-object filtering', 'Precision, recall and false positives, with the shortfall stated.'),
  evidenceStep('ev-regret', 'Planner regret', 'Path cost on the compressed map against the same planner on a dense reference.'),
  evidenceStep('ev-limits', 'What this does not show', 'Known limits, stated up front.'),
  {
    id: 'theme',
    anchor: '[data-tour="theme"]',
    title: 'Light and dark',
    body: () => 'Shift+T toggles the theme. The 3D scene and the map follow it. The tour does not change your saved choice.',
    enter: async ({ actions }) => {
      await ensure(actions, { ...bridge, view: 'hook_3d', viewMode: 'pipeline', colour: 'elevation', drawer: null });
      const dark = document.documentElement.dataset.theme === 'dark';
      setThemePreference(dark ? 'light' : 'dark', { persist: false });
      await frames(4);
    },
  },
  {
    id: 'finish',
    placement: 'center',
    title: 'That is the tour',
    body: () => 'Replay it any time from the header. When you close it, the dashboard goes back to how you left it.',
    enter: ({ actions }) => ensure(actions, { ...bridge, view: 'hook_3d', viewMode: 'pipeline', colour: 'elevation', drawer: null }),
  },
];

