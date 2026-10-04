/** Typed views of the benchmark/*.json result files (only the fields the Evidence page reads). */

export interface FidelityBand {
  ring_id: number;
  band_name: string;
  resolution_m: number;
  evaluation_cells: number;
  elevation_rmse_m: number;
  hazard_cells_evaluated: number;
  hazard_recall_pct: number;
  mean_boundary_displacement_m: number;
  curb_step_mean_m: number;
  curb_survival_status: 'PASS' | 'FAIL';
}

export interface FidelityResult {
  study: string;
  frames_evaluated: number;
  reference_grid: { type: string; resolution_m: number; span_m: number; theoretical_capacity_mb: number };
  foveagrid: { memory_bound_mb: number; bound_preserved: boolean };
  memory_comparison: {
    capacity_ratio_vs_3d: { ratio: number; label: string; explanation: string };
    capacity_ratio_vs_uniform_25d: { ratio: number; label: string; explanation: string };
    occupied_cell_ratio: {
      ratio: number;
      label: string;
      mean_foveagrid_occupied_cells: number;
      mean_uniform_occupied_cells: number;
      explanation: string;
    };
  };
  per_band_fidelity: FidelityBand[];
  curb_survival_analysis: { dataset: string };
}

export interface StageStats {
  mean: number;
  std: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
}

export interface LatencyResult {
  measurement_label: string;
  platform: string;
  processor: string;
  frames_evaluated: number;
  warm_frames: number;
  pre_optimization_baseline_ms: { end_to_end_mean_ms: number };
  warm_stages_ms: {
    spatial_hash_insert: StageStats;
    costmap_rasterization: StageStats;
    onnx_inference: StageStats;
    end_to_end_grid_only: StageStats;
    end_to_end_with_onnx: StageStats;
    dual_rate_async_pipeline: StageStats;
  };
  throughput: {
    grid_only_fps_warm_mean: number;
    grid_only_fps_warm_p50: number;
    dual_rate_async_fps_warm_mean: number;
    full_pipeline_sequential_fps_warm: number;
  };
}

export interface MiouBand {
  band_name: string;
  r_min_m: number;
  r_max_m: number;
  total_points: number;
  active_classes: number;
  mean_iou_pct: number;
}

export interface MiouResult {
  model: string;
  dataset: string;
  sequence: string;
  frames_evaluated: number;
  total_valid_points: number;
  overall_accuracy_pct: number;
  miou_present_classes_pct: number;
  overall_miou_pct: number;
  active_gt_classes: number;
  mean_inference_latency_ms: number;
  distance_bands: MiouBand[];
  class_ious_overall: Record<string, number>;
}

export interface MosResult {
  dataset: string;
  sequence: string;
  frames_evaluated: number;
  total_gt_dynamic_points: number;
  confusion_matrix: { true_positives: number; false_positives: number; false_negatives: number; true_negatives: number };
  classification_metrics: { precision_pct: number; recall_pct: number; f1_score_pct: number; false_positive_rate_pct: number };
  task_4_3_ego_turn_robustness: {
    straight_driving_frames: number;
    straight_fpr_pct: number;
    turning_frames: number;
    turning_fpr_pct: number;
  };
  anti_ghosting_metrics: { kalman_tracks_formed: number; ghost_cells_carved: number };
}

export interface RegretFrame {
  frame_idx: number;
  cost_dense_3d: number;
  cost_foveagrid_25d: number;
  cost_naive_2d: number;
  regret_pct: number;
  naive_regret_pct: number;
  frechet_distance_m: number;
}

export interface RegretResult {
  dataset: string;
  frames_evaluated: number;
  mean_foveagrid_regret_pct: number;
  max_foveagrid_regret_pct: number;
  mean_frechet_distance_m: number;
  max_frechet_distance_m: number;
  frame_records: RegretFrame[];
}
