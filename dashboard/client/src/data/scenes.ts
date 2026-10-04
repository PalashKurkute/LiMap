import type { SceneId, TelemetryData } from '../types/telemetry';

/**
 * The one list of scenes. Names, keys and descriptions are defined here and nowhere else, so the switcher,
 * scene card, drawer and tour can never disagree about what a scene is called.
 */
export interface SceneInfo {
  id: SceneId;
  /** Keyboard shortcut (1-5). */
  key: string;
  label: string;
  short: string;
  kind: 'synthetic' | 'real';
  /** One line on what the scene is for. */
  desc: string;
  /** What the scene card says this scene demonstrates. */
  cardTitle: string;
}

export const SCENES: SceneInfo[] = [
  {
    id: 'scene_a_bridge',
    key: '1',
    label: 'Bridge underpass',
    short: 'Bridge',
    kind: 'synthetic',
    desc: 'Checks overhead clearance under a bridge',
    cardTitle: 'Overhead clearance',
  },
  {
    id: 'scene_b_potholes',
    key: '2',
    label: 'Potholes and craters',
    short: 'Potholes',
    kind: 'synthetic',
    desc: 'Finds holes and ditches in the road',
    cardTitle: 'Road dips',
  },
  {
    id: 'scene_c_moving',
    key: '3',
    label: 'Moving traffic',
    short: 'Traffic',
    kind: 'synthetic',
    desc: 'Flags moving cars so they leave no ghost trail',
    cardTitle: 'Moving objects',
  },
  {
    id: 'scene_d_poles',
    key: '4',
    label: 'Thin poles and trees',
    short: 'Poles',
    kind: 'synthetic',
    desc: 'Fine cells resolve lamp posts and trees',
    cardTitle: 'Thin obstacles',
  },
  {
    id: 'real_seq08_f00',
    key: '5',
    label: 'Real city scan',
    short: 'Real city',
    kind: 'real',
    desc: 'A SemanticKITTI scan from a public road',
    cardTitle: 'Fixed memory',
  },
];

export const SCENE_IDS: SceneId[] = SCENES.map((s) => s.id);

export function sceneInfo(id: SceneId): SceneInfo {
  return SCENES.find((s) => s.id === id) ?? SCENES[0];
}

export function sceneByKey(key: string): SceneInfo | undefined {
  return SCENES.find((s) => s.key === key);
}

/**
 * One line under the inspector toolbar saying what to look for in this scene. Values come from the loaded
 * snapshot (never typed), so the hint always matches the data on screen.
 */
export function inspectorHint(id: SceneId, summary: TelemetryData['tactical_summary'] | null | undefined, sparseSample: boolean): string {
  switch (id) {
    case 'scene_a_bridge':
      return summary?.min_clearance_m != null
        ? `Colour by Overhang to see where a deck was recorded above the road. Minimum clearance here: ${summary.min_clearance_m} m.`
        : 'Colour by Overhang to see where a deck was recorded above the road.';
    case 'scene_b_potholes':
      return summary?.max_variance_m2 != null
        ? `Colour by Variance: pits and crater rims have high height variance. Highest here: ${summary.max_variance_m2} m².`
        : 'Colour by Variance: pits and crater rims have high height variance.';
    case 'scene_c_moving':
      return summary?.mos_active
        ? 'Colour by Class: cells labelled as moving objects stand out. This is one scan, so no trail filtering is shown.'
        : 'Colour by Class to see which cells are labelled as moving objects. This is one scan.';
    case 'scene_d_poles':
      return 'Colour by Ring: the finest cells (R0) sit around the vehicle, which is why thin poles stay resolved.';
    default:
      return sparseSample
        ? 'A sparse 5,000-point sample of a real SemanticKITTI scan, coloured with dataset labels.'
        : 'A real SemanticKITTI scan, coloured with dataset labels.';
  }
}
