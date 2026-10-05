/**
 * The words behind the "?" help icons: one short plain-language explanation per tool or feature group, so a visitor can hover
 * (or focus) an icon instead of taking the tour. Every sentence is data-free: any figure belongs on the screen it describes,
 * read from data, never here (scripts/check-honesty.mjs scans this folder).
 */
export interface HelpTopic {
  title: string;
  text: string;
}

export const HELP = {
  // Header
  'data-source': {
    title: 'Data source',
    text: 'Where this scene came from: a precomputed snapshot of the pipeline, or the live API when a server is running. The dashboard works without a server.',
  },

  // 3D view
  scenes: {
    title: 'Scenes',
    text: 'Pick what to look at: four synthetic scenes, each built to stress one capability, and one real SemanticKITTI scan. The number keys 1 to 5 do the same.',
  },
  upload: {
    title: 'Analyze your own scan',
    text: 'Choose a LiDAR .bin file (x, y, z and intensity points, the SemanticKITTI layout) and the local API grids it with the same pipeline. It needs the API running. Labels come from a geometric heuristic unless the server has a trained model, and the scan stays in this tab: reloading clears it.',
  },
  'view-mode': {
    title: 'What the 3D view shows',
    text: 'Pipeline output draws the cells the pipeline actually produced. Concept view is a hand-built illustration of the scenario, and it is labelled as one.',
  },
  stamp: {
    title: 'View label',
    text: 'States what you are looking at: pipeline output, a hand-built illustration or a real recording. Nothing on screen is left unlabelled.',
  },
  'scene-card': {
    title: 'Scene card',
    text: 'What this scene was built to show, with the key figure read from the scan itself. Collapse it with the arrow to see more of the view.',
  },
  camera: {
    title: 'Camera',
    text: 'Orbit lets you drag to look around, Follow trails the vehicle, and Top looks straight down at the grid.',
  },
  colour: {
    title: 'Colour by',
    text: 'Colours each cell by its height, its semantic class, its resolution ring or the variance of its height. The legend always matches the choice.',
  },
  fly: {
    title: 'Fly under the bridge',
    text: 'A camera shot along the route the 2.5D planner found under the bridge. It is a camera move over the grid, not a recorded drive; drag or scroll to take control back.',
  },
  legend: {
    title: 'Legend',
    text: 'Explains the colours on screen right now. It changes whenever the colouring does.',
  },
  playback: {
    title: 'Playback',
    text: 'Concept view only: plays an illustrative drive along a hand-built loop. Pipeline output is a single scan, so there is nothing to play back.',
  },

  // Controls panel
  'draw-mode': {
    title: 'What to draw',
    text: 'Choose between the FoveaGrid cells the pipeline produced and the raw LiDAR returns they were built from.',
  },
  overlays: {
    title: 'Overlays',
    text: 'Range rings mark where one resolution ring ends and the next begins. Reset puts the overlays back to their defaults.',
  },
  'vehicle-model': {
    title: 'Vehicle model',
    text: 'An illustration of a vehicle on a hand-built loop in Concept view. These values describe that loop; they are not planner output or a recording.',
  },
  memory: {
    title: 'Memory',
    text: 'The grid reserves one fixed pool of memory up front, whatever the scene. The cell count is how many of its cells this scan fills.',
  },
  slicer: {
    title: 'Clearance slicer',
    text: 'Slide along the road to see the profile of the grid cells there. A gap means no points were observed at that height.',
  },
  stress: {
    title: 'Dropout preview',
    text: 'Hides half of the drawn returns to preview sparse sensing. It is a visual preview only: the pipeline is not re-run.',
  },

  // Map Inspector
  'inspector-colour': {
    title: 'Colour by',
    text: 'Colours every cell by its semantic class, resolution ring, elevation, height variance or overhang clearance.',
  },
  projection: {
    title: 'View',
    text: 'Top-down is a plan view of the grid. Isometric tilts it so heights show, such as a bridge deck floating above the road.',
  },
  'fovea-presets': {
    title: 'Foveation presets',
    text: 'Re-runs the same scan with the fine zone moved for city or highway speed or a turn. Each preset is a single scan re-run, not a drive.',
  },
  compare: {
    title: 'Compare with uniform',
    text: 'Splits the map on one scan: a uniform grid on the left and FoveaGrid on the right, with their occupied cells and reserved memory in the panel.',
  },
  underpass: {
    title: 'Underpass comparison',
    text: 'Shows the bridge scan as two costmaps, from a one-height grid and from the 2.5D grid, and what the planner did with each.',
  },
  guides: {
    title: 'Map guides',
    text: 'Switches the distance ticks, direction labels and ring labels on the map.',
  },
  'ring-filter': {
    title: 'Ring filter',
    text: 'Shows one resolution ring at a time so you can see how cell size changes with distance from the vehicle.',
  },
  'cell-inspector': {
    title: 'Cell inspector',
    text: 'Click a cell on the map to see its ring, class, point count, height statistics and overhang clearance.',
  },
  'fovea-card': {
    title: 'Foveation',
    text: 'Where the fine cells sit for the chosen preset, with every value read from the exported file for that preset.',
  },
  'scene-stats': {
    title: 'Scene statistics',
    text: 'Counts for the whole scan. They include cells that are not drawn when the map shows an evenly spaced sample.',
  },

  // Evidence
  'evidence-tags': {
    title: 'Evidence tags',
    text: 'MEASURED was run on data, CALCULATED is derived arithmetically, and DATASET comes from the dataset itself. Each figure shows its source file.',
  },
} satisfies Record<string, HelpTopic>;

export type HelpId = keyof typeof HELP;
