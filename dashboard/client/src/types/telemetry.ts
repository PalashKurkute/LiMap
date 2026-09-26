export interface RingBreakdown {
  ring_id: number;
  name: string;
  resolution_m: number;
  allocated_cells: number;
  allocated_kb: number;
  allocated_mb: number;
}

export interface BaselineMetrics {
  dense_3d_voxel_mb: number;
  uniform_25d_mb: number;
  foveagrid_25d_mb: number;
  reduction_vs_3d: string;
  reduction_vs_uniform_25d: string;
  under_drdo_bound: boolean;
  per_ring_breakdown: RingBreakdown[];
}

export interface TelemetryData {
  capacity: number;
  active_cells: number;
  load_factor: number;
  allocated_cell_mb: number;
  total_heap_mb: number;
  under_drdo_bound: boolean;
}

export interface TelemetryResponse {
  telemetry: TelemetryData;
  baselines: BaselineMetrics;
}

export interface CrossSectionPoint {
  distance_m: number;
  x: number;
  y: number;
  z_ground: number;
  z_overhang: number | null;
  clearance_m: number | null;
  variance: number;
  sem_id: number;
}

export interface CrossSectionResponse {
  x_start: number;
  y_start: number;
  x_end: number;
  y_end: number;
  profile: CrossSectionPoint[];
}

export type SceneId = 'scene_a_bridge' | 'scene_b_potholes' | 'scene_c_moving' | 'scene_d_poles';

export type CameraViewMode = 'orbit' | 'bev' | 'cockpit' | 'cross_cut';
export type ColorMapMode = 'elevation' | 'traversability' | 'uncertainty' | 'semantics';
export type DEMDisplayMode = 'surface' | 'voxels' | 'points';
