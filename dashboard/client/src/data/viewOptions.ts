import type { CameraViewMode, ColorMapMode, DEMDisplayMode, RenderMode } from '../types/telemetry';

/** Shared option lists for the 3D view, so the scene card, drawer and tour describe them identically. */
export interface ViewOption<T extends string> {
  id: T;
  label: string;
  desc: string;
}

export const CAMERA_OPTIONS: ViewOption<CameraViewMode>[] = [
  { id: 'orbit', label: 'Orbit', desc: 'Drag to rotate, right-drag to pan, wheel to zoom' },
  { id: 'chase', label: 'Follow', desc: 'Third-person view behind the vehicle' },
  { id: 'bev', label: 'Top', desc: 'Straight-down view' },
];

export function colorOptionsFor(mode: RenderMode): ViewOption<ColorMapMode>[] {
  return mode === 'pipeline'
    ? [
        { id: 'elevation', label: 'Height', desc: 'Mean cell height, low to high' },
        { id: 'semantics', label: 'Class', desc: 'Dominant semantic class per cell' },
        { id: 'ring', label: 'Ring', desc: 'Which lattice ring (5, 10, 25 or 50 cm cells) holds the cell' },
        { id: 'variance', label: 'Variance', desc: 'Welford running height variance per cell' },
      ]
    : [
        { id: 'elevation', label: 'Height', desc: 'Turbo spectrum over the hand-built terrain' },
        { id: 'traversability', label: 'Slope', desc: 'Illustrative: green flat to red steep' },
        { id: 'uncertainty', label: 'Lateral', desc: 'Illustrative: distance from the driving corridor, not a measured uncertainty' },
      ];
}

export function drawOptionsFor(mode: RenderMode): ViewOption<DEMDisplayMode>[] {
  return mode === 'pipeline'
    ? [
        { id: 'voxels', label: 'FoveaGrid cells', desc: 'The cells the pipeline produced, drawn at their real size and height' },
        { id: 'points', label: 'Raw LiDAR returns', desc: 'The input points (a seeded subsample of the scan)' },
      ]
    : [
        { id: 'points', label: 'Point grid', desc: 'Illustrative sample points on the hand-built terrain' },
        { id: 'surface', label: 'Terrain surface mesh', desc: 'Continuous heightfield geometry' },
        { id: 'voxels', label: 'Voxel columns', desc: 'Discrete elevation column stacks' },
      ];
}
