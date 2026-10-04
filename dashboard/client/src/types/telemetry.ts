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
  within_pool_budget: boolean;
  per_ring_breakdown: RingBreakdown[];
}

export interface TelemetryData {
  capacity: number;
  active_cells: number;
  load_factor: number;
  allocated_cell_mb: number;
  total_heap_mb: number;
  within_pool_budget: boolean;
  /** Present in newer API responses; absent from older ones. */
  label_source?: 'gt' | 'onnx' | 'heuristic';
  tactical_summary?: {
    min_clearance_m: number | null;
    max_variance_m2: number;
    mos_active: boolean;
    core_res_m: number;
  };
}

export interface TelemetryResponse {
  telemetry: TelemetryData;
  baselines: BaselineMetrics;
}

export interface CrossSectionPoint {
  distance_m: number;
  x: number;
  y: number;
  /** false when no grid cell covers this sample (no elevation is invented). */
  observed: boolean;
  ring_id: number | null;
  z_ground: number | null;
  z_overhang: number | null;
  clearance_m: number | null;
  variance: number | null;
  sem_id: number | null;
}

export interface CrossSectionResponse {
  x_start: number;
  y_start: number;
  x_end: number;
  y_end: number;
  profile: CrossSectionPoint[];
}

export type SceneId =
  | 'scene_a_bridge'
  | 'scene_b_potholes'
  | 'scene_c_moving'
  | 'scene_d_poles'
  | 'real_seq08_f00'
  | 'real_seq08_f25'
  | 'real_seq08_f50'
  | 'real_seq08_f100';

export type CameraViewMode = 'chase' | 'orbit' | 'bev' | 'cockpit' | 'cross_cut';
export type ColorMapMode = 'elevation' | 'traversability' | 'uncertainty' | 'semantics' | 'ring' | 'variance';

/** 'pipeline' = the grid cells and raw returns the pipeline produced; 'concept' = the hand-built illustration. */
export type RenderMode = 'pipeline' | 'concept';
export type DEMDisplayMode = 'surface' | 'voxels' | 'points';

export type StressModeId = 'nominal' | 'dropout_50' | 'monsoon_noise' | 'ghost_stress';

export interface LayerVisibility {
  demSurface: boolean;
  demVoxels: boolean;
  rawPoints: boolean;
  bridgeDeck: boolean;
  trajectory: boolean;
  trackers: boolean;
  foveaRings: boolean;
  sweepWave: boolean;
  headlights: boolean;
}

/** One grid cell as shown in the inspector (decoded from a snapshot or returned by /api/grid_cells). */
export interface GridCellData {
  ix: number;
  iy: number;
  ring_id: number;
  res_m: number;
  x_m: number;
  y_m: number;
  sem_id: number;
  count: number;
  mean_z: number;
  variance: number;
  min_z: number;
  max_z: number;
  overhang_z: number | null;
  clearance: number | null;
}

export interface LatticeRing {
  ring_id: number;
  res_m: number;
  r_inner: number;
  r_outer: number;
}

export interface SnapshotMeta {
  scene_id: string;
  kind: 'synthetic' | 'real';
  generated_at: string;
  git_sha: string;
  label_source: 'gt' | 'onnx' | 'heuristic';
  points_raw: number;
  active_cells: number;
  cells_exported: number;
  cells_sampled: boolean;
  inputs_sha256: Record<string, string>;
  lattice: LatticeRing[];
  note: string | null;
}

/** Parallel arrays (compact on the wire). x/y/res are derived from (ix, iy, ring) with the lattice table. */
export interface ColumnarCells {
  total_active: number;
  n: number;
  sampled: boolean;
  ix: number[];
  iy: number[];
  ring: number[];
  sem: number[];
  count: number[];
  z: number[];
  var: number[];
  zmin: number[];
  zmax: number[];
  oh: (number | null)[];
  cl: (number | null)[];
}

export interface ColumnarPoints {
  total: number;
  n: number;
  x: number[];
  y: number[];
  z: number[];
  sem: number[];
}

export interface SceneSnapshot {
  meta: SnapshotMeta;
  telemetry: TelemetryResponse;
  cross_section: CrossSectionResponse;
  cells: ColumnarCells;
  points: ColumnarPoints;
}

/** Variant snapshots: the same scan re-run with a foveation preset, or on a uniform 5 cm reference grid. */
export type VariantId =
  | 'fovea_city_cruise'
  | 'fovea_highway_extended'
  | 'fovea_turning_left'
  | 'fovea_turning_right'
  | 'uniform_5cm';

export interface VariantMeta {
  scene_id: string;
  variant: VariantId;
  kind: 'fovea_preset' | 'uniform_reference';
  generated_at: string;
  git_sha: string;
  label_source: 'gt' | 'onnx' | 'heuristic';
  base_inputs_sha256: Record<string, string>;
  points_raw: number;
  lattice: LatticeRing[];
  pool: { capacity: number; cell_bytes: number; mb: number; active_cells: number };
  fovea: {
    preset: string;
    input: { vx_mps: number; vy_mps: number; yaw_rate_rads: number };
    shift_x_m: number;
    shift_y_m: number;
    forward_reach_m: number;
    stretch_ratio: number;
  } | null;
  uniform: {
    res_m: number;
    r_outer_m: number;
    pool_capacity: number;
    pool_mb: number;
    theoretical_capacity_mb: number;
  } | null;
  /** Counted on the full grid before any sampling, so these stay exact even when fewer cells are drawn. */
  stats: {
    active_cells: number;
    cells_per_ring: number[];
    cells_per_band: number[];
    ring0_ahead: number;
    ring0_behind: number;
  };
}

export interface VariantFile {
  schema: 'limap.variant/1';
  meta: VariantMeta;
  cells: ColumnarCells;
}

export interface VariantData {
  meta: VariantMeta;
  cells: GridCellData[];
  totalActive: number;
  cellsSampled: boolean;
}

export interface VariantManifestEntry {
  file: string;
  bytes: number;
  active_cells: number;
}

export type VariantManifest = Record<string, Partial<Record<VariantId, VariantManifestEntry>>>;

export type DataSource = 'snapshot' | 'live';

/** Everything the views need for the active scene, regardless of where it came from. */
export interface SceneData {
  source: DataSource;
  meta: SnapshotMeta | null;
  telemetry: TelemetryResponse | null;
  crossSection: CrossSectionResponse | null;
  cells: GridCellData[];
  totalActive: number;
  cellsSampled: boolean;
  points: ColumnarPoints | null;
}

/** A whitelisted benchmark result file wrapped with provenance (see /api/results/{name}). */
export interface ResultEnvelope<T = unknown> {
  name: string;
  source_path: string;
  sha256: string;
  mtime?: string;
  data: T;
}

/** What the 3D view needs to draw the pipeline's output for the active scene. */
export interface PipelineData {
  cells: GridCellData[];
  points: ColumnarPoints | null;
  /** Ground height under the sensor, from the nearest road cells (CALCULATED from the grid). */
  groundZ: number;
}
