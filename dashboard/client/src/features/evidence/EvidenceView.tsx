import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { BaselineMetrics, ResultEnvelope } from '../../types/telemetry';
import { useResult } from '../../data/results';
import type {
  FidelityResult,
  LatencyResult,
  MiouResult,
  MosResult,
  RegretResult,
} from '../../data/resultTypes';
import { fmt, fmtExact, fmtInt, fmtMb, fmtMs, fpsFromMs } from '../../lib/format';
import { POOL_CAPACITY_CELLS, CELL_BYTES } from '../../lib/constants';
import { HBarLog, ColumnBars } from './charts';
import { DataTable, EvidenceCard, Note, ProvenanceBadge, SourceLine, StatTile } from './primitives';

interface EvidenceViewProps {
  baselines: BaselineMetrics | null;
}

/** Renders `children(data)` once a result has loaded; otherwise an honest loading / unavailable message. */
function Gate<T>({
  res,
  children,
}: {
  res: { result: ResultEnvelope<T> | null; loading: boolean };
  children: (env: ResultEnvelope<T>) => React.ReactNode;
}) {
  if (res.loading) return <p className="text-xs text-fg-muted">Loading result file…</p>;
  if (!res.result) {
    return <Note tone="warn">This result file could not be loaded, so nothing is shown here instead of an unsourced number.</Note>;
  }
  return <>{children(res.result)}</>;
}

const ringLabel = (id: number, res: number) => ({ label: `R${id}`, sub: `${Math.round(res * 100)} cm` });

export const EvidenceView: React.FC<EvidenceViewProps> = ({ baselines }) => {
  const fidelity = useResult<FidelityResult>('fidelity');
  const latency = useResult<LatencyResult>('latency');
  const miou = useResult<MiouResult>('miou');
  const mos = useResult<MosResult>('mos');
  const regret = useResult<RegretResult>('regret');

  return (
    <div data-region="evidence" className="h-full w-full overflow-y-auto bg-app">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-fg">Evidence</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-fg-2">
            Every figure here is read from a results file in the repository (<span className="font-mono text-xs">benchmark/*.json</span>)
            and shown with its source and checksum. Nothing on this page is typed in by hand.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-fg-2">
            <span className="flex items-center gap-1.5"><ProvenanceBadge kind="MEASURED" /> run on data</span>
            <span className="flex items-center gap-1.5"><ProvenanceBadge kind="CALCULATED" /> derived arithmetically</span>
            <span className="flex items-center gap-1.5"><ProvenanceBadge kind="DATASET" /> from the dataset</span>
          </div>
        </header>

        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          {/* ------------------------------------------------------------------ memory */}
          <EvidenceCard
            id="ev-memory"
            tag="D3"
            title="Memory: fixed pool versus dense maps"
            claim="The grid reserves a fixed pool. Capacity comparisons are calculated; the measured saving in occupied cells is smaller, and both are shown."
          >
            <Gate res={fidelity}>
              {(env) => {
                const f = env.data;
                const mc = f.memory_comparison;
                const pool = f.foveagrid.memory_bound_mb;
                const dense = baselines?.dense_3d_voxel_mb ?? mc.capacity_ratio_vs_3d.ratio * pool;
                const uniform = baselines?.uniform_25d_mb ?? f.reference_grid.theoretical_capacity_mb;
                return (
                  <>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      <StatTile
                        metric="capacity-vs-3d"
                        label="vs dense 3D voxels"
                        value={`${fmt(mc.capacity_ratio_vs_3d.ratio, 1)}×`}
                        sub="reserved-memory ratio"
                        provenance="CALCULATED"
                        tone="ours"
                      />
                      <StatTile
                        metric="capacity-vs-uniform"
                        label="vs uniform 5 cm 2.5D"
                        value={`${fmt(mc.capacity_ratio_vs_uniform_25d.ratio, 1)}×`}
                        sub="reserved-memory ratio"
                        provenance="CALCULATED"
                        tone="ours"
                      />
                      <StatTile
                        metric="occupied-cell-ratio"
                        label="Occupied cells vs uniform"
                        value={`${fmt(mc.occupied_cell_ratio.ratio, 2)}×`}
                        sub={`${fmtInt(mc.occupied_cell_ratio.mean_foveagrid_occupied_cells)} vs ${fmtInt(mc.occupied_cell_ratio.mean_uniform_occupied_cells)} cells per frame, mean of ${f.frames_evaluated} real frames`}
                        provenance="MEASURED"
                      />
                    </div>

                    <HBarLog
                      unit="MB"
                      ariaLabel={`Memory capacity on a log scale: dense 3D ${fmtMb(dense)}, uniform 2.5D ${fmtMb(uniform)}, FoveaGrid pool ${fmtMb(pool)}`}
                      tickFormat={(v) => `${v.toLocaleString('en-US')} MB`}
                      items={[
                        { label: 'Dense 3D voxels (3 cm)', value: dense, valueLabel: fmtMb(dense), tone: 'baseline' },
                        { label: 'Uniform 2.5D (5 cm)', value: uniform, valueLabel: fmtMb(uniform), tone: 'baseline' },
                        { label: 'FoveaGrid pool (ours)', value: pool, valueLabel: fmtMb(pool), tone: 'ours' },
                      ]}
                    />

                    <Note>
                      Both ratios compare <b>reserved</b> memory for a {f.reference_grid.span_m} m box. The pool holds {fmtInt(POOL_CAPACITY_CELLS)} cells
                      of {CELL_BYTES} bytes and excludes point buffers, the segmentation model and the costmap. In use, the grid occupies
                      {' '}{fmt(mc.occupied_cell_ratio.ratio, 2)}× fewer cells than a uniform grid on real scans, because most of any grid is empty.
                    </Note>

                    {baselines?.per_ring_breakdown && (
                      <DataTable
                        caption="Pool allocation per resolution ring"
                        columns={['Ring', 'Cell size', 'Cells', 'Memory (MB)']}
                        rows={baselines.per_ring_breakdown.map((r) => [
                          `R${r.ring_id} ${r.name}`,
                          `${Math.round(r.resolution_m * 100)} cm`,
                          fmtInt(r.allocated_cells),
                          r.allocated_mb.toFixed(3),
                        ])}
                      />
                    )}
                    <SourceLine envelope={env} />
                  </>
                );
              }}
            </Gate>
          </EvidenceCard>

          {/* ---------------------------------------------------------------- fidelity */}
          <EvidenceCard
            id="ev-fidelity"
            tag="D2"
            title="Grid fidelity by distance ring"
            claim="Coarser far-field cells trade elevation accuracy for memory. Hazard cells are still found, but thin curbs do not survive in two of the four rings."
          >
            <Gate res={fidelity}>
              {(env) => {
                const bands = env.data.per_band_fidelity;
                const items = (pick: (b: (typeof bands)[number]) => number, f: (v: number) => string) =>
                  bands.map((b) => ({ ...ringLabel(b.ring_id, b.resolution_m), value: pick(b), valueLabel: f(pick(b)) }));
                const rmse = items((b) => b.elevation_rmse_m, (v) => `${fmt(v, 3)}`);
                const recall = items((b) => b.hazard_recall_pct, (v) => `${fmt(v, 1)}`);
                const disp = items((b) => b.mean_boundary_displacement_m, (v) => `${fmt(v, 3)}`);
                return (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <ColumnBars
                        title="Elevation error (RMSE)"
                        unit="m"
                        items={rmse}
                        max={Math.max(...bands.map((b) => b.elevation_rmse_m))}
                        ariaLabel={`Elevation RMSE by ring in metres: ${bands.map((b) => `R${b.ring_id} ${fmt(b.elevation_rmse_m, 3)}`).join(', ')}`}
                      />
                      <ColumnBars
                        title="Hazard cells found"
                        unit="% recall"
                        items={recall}
                        max={100}
                        ariaLabel={`Hazard recall by ring in percent: ${bands.map((b) => `R${b.ring_id} ${fmt(b.hazard_recall_pct, 1)}`).join(', ')}`}
                      />
                      <ColumnBars
                        title="Boundary displacement"
                        unit="m"
                        items={disp}
                        max={Math.max(...bands.map((b) => b.mean_boundary_displacement_m), 0.01)}
                        ariaLabel={`Mean boundary displacement by ring in metres: ${bands.map((b) => `R${b.ring_id} ${fmt(b.mean_boundary_displacement_m, 3)}`).join(', ')}`}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-fg">Curb survival (road vs sidewalk step, criterion ≥ 0.05 m)</span>
                      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {bands.map((b) => {
                          const pass = b.curb_survival_status === 'PASS';
                          return (
                            <li
                              key={b.ring_id}
                              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                                pass ? 'border-good-line bg-good-bg text-good-fg' : 'border-critical-line bg-critical-bg text-critical-fg'
                              }`}
                            >
                              {pass ? <CheckCircle2 size={14} aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />}
                              <span className="font-semibold">
                                R{b.ring_id} ({Math.round(b.resolution_m * 100)} cm): {b.curb_survival_status}
                              </span>
                              <span className="ml-auto font-mono text-[11px]">step {fmt(b.curb_step_mean_m, 3)} m</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <Note>
                      Ring 0&apos;s near-zero error holds by construction: it uses the same {Math.round(bands[0].resolution_m * 100)} cm resolution as the
                      reference grid it is compared with. Evaluated on {env.data.frames_evaluated} real SemanticKITTI frames.
                    </Note>
                    <DataTable
                      caption="Fidelity per ring"
                      columns={['Ring', 'Cells evaluated', 'RMSE (m)', 'Hazard recall (%)', 'Boundary disp. (m)', 'Curb step (m)', 'Curb']}
                      rows={bands.map((b) => [
                        b.band_name,
                        fmtInt(b.evaluation_cells),
                        fmt(b.elevation_rmse_m, 4),
                        fmt(b.hazard_recall_pct, 2),
                        fmt(b.mean_boundary_displacement_m, 4),
                        fmt(b.curb_step_mean_m, 4),
                        b.curb_survival_status,
                      ])}
                    />
                    <SourceLine envelope={env} />
                  </>
                );
              }}
            </Gate>
          </EvidenceCard>

          {/* ------------------------------------------------------------ segmentation */}
          <EvidenceCard
            id="ev-segmentation"
            tag="D1 · D4"
            title="Semantic segmentation accuracy by distance"
            claim="A pretrained network labels each point. Accuracy depends strongly on which classes appear and how far away they are."
          >
            <Gate res={miou}>
              {(env) => {
                const m = env.data;
                const classes = Object.entries(m.class_ious_overall).sort((a, b) => b[1] - a[1]);
                const bands = m.distance_bands;
                return (
                  <>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      <StatTile
                        metric="accuracy"
                        label="Point accuracy"
                        value={`${fmt(m.overall_accuracy_pct, 2)}%`}
                        sub={`${fmtInt(m.total_valid_points)} points, ${m.frames_evaluated} frames`}
                        provenance="MEASURED"
                      />
                      <StatTile
                        metric="miou-present"
                        label="mIoU, classes present"
                        value={`${fmt(m.miou_present_classes_pct, 2)}%`}
                        sub={`mean over the ${m.active_gt_classes} classes that occur`}
                        provenance="MEASURED"
                        tone="ours"
                      />
                      <StatTile
                        metric="miou-all"
                        label="mIoU, all 19 classes"
                        value={`${fmt(m.overall_miou_pct, 2)}%`}
                        sub="absent classes count as 0"
                        provenance="MEASURED"
                      />
                    </div>

                    <ColumnBars
                      title="mIoU by distance ring"
                      unit="%"
                      max={100}
                      height={96}
                      ariaLabel={`mIoU by ring: ${bands.map((b) => (b.total_points === 0 ? `${b.band_name} not evaluated` : `${b.band_name} ${fmt(b.mean_iou_pct, 1)} percent`)).join('; ')}`}
                      items={bands.map((b, i) => ({
                        label: `R${i}`,
                        sub: `${b.r_min_m}–${b.r_max_m} m`,
                        value: b.total_points === 0 ? null : b.mean_iou_pct,
                        valueLabel: fmt(b.mean_iou_pct, 1),
                        naLabel: 'no labels',
                      }))}
                    />

                    <Note>
                      The far ring has no score: the evaluated frames contain no labelled points beyond {bands[bands.length - 2]?.r_max_m ?? 50} m.
                      Model: {m.model}. Mean inference time in this run: {fmtMs(m.mean_inference_latency_ms)} per frame.
                    </Note>
                    <DataTable
                      caption="Intersection-over-union per class"
                      columns={['Class', 'IoU (%)']}
                      rows={classes.map(([name, v]) => [name, fmt(v, 2)])}
                    />
                    <SourceLine envelope={env} note={`${m.dataset} seq ${m.sequence}`} />
                  </>
                );
              }}
            </Gate>
          </EvidenceCard>

          {/* ------------------------------------------------------------------- speed */}
          <EvidenceCard
            id="ev-speed"
            tag="D4"
            title="Speed: the grid is fast, segmentation is the bottleneck"
            claim="Grid-only and end-to-end rates are always shown together, because the network dominates the cost of a full frame."
          >
            <Gate res={latency}>
              {(env) => {
                const l = env.data;
                const s = l.warm_stages_ms;
                return (
                  <>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      <StatTile
                        metric="fps-grid-p50"
                        label="Grid only, typical"
                        value={`${fmt(fpsFromMs(s.end_to_end_grid_only.p50), 1)} FPS`}
                        sub={`${fmtMs(s.end_to_end_grid_only.p50)} median · mean ${fmtMs(s.end_to_end_grid_only.mean)} (${fmt(l.throughput.grid_only_fps_warm_mean, 1)} FPS) · p95 ${fmtMs(s.end_to_end_grid_only.p95)}`}
                        provenance="MEASURED"
                        tone="ours"
                      />
                      <StatTile
                        metric="fps-async"
                        label="Dual-rate async"
                        value={`${fmt(l.throughput.dual_rate_async_fps_warm_mean, 1)} FPS`}
                        sub={`${fmtMs(s.dual_rate_async_pipeline.mean)} per frame; labels are reused from an earlier frame`}
                        provenance="MEASURED"
                      />
                      <StatTile
                        metric="fps-end-to-end"
                        label="End to end with segmentation"
                        value={`${fmt(l.throughput.full_pipeline_sequential_fps_warm, 2)} FPS`}
                        sub={`${fmtMs(s.end_to_end_with_onnx.mean)} per frame`}
                        provenance="MEASURED"
                        tone="warn"
                      />
                    </div>

                    <HBarLog
                      unit="ms"
                      ariaLabel="Mean time per frame by stage on a log scale"
                      tickFormat={(v) => (v >= 1000 ? `${v / 1000} s` : `${v} ms`)}
                      items={[
                        { label: 'Hash insert', value: s.spatial_hash_insert.mean, valueLabel: fmtMs(s.spatial_hash_insert.mean), tone: 'ours' },
                        { label: 'Costmap raster', value: s.costmap_rasterization.mean, valueLabel: fmtMs(s.costmap_rasterization.mean), tone: 'ours' },
                        { label: 'Grid only (total)', value: s.end_to_end_grid_only.mean, valueLabel: fmtMs(s.end_to_end_grid_only.mean), tone: 'ours' },
                        { label: 'Async pipeline', value: s.dual_rate_async_pipeline.mean, valueLabel: fmtMs(s.dual_rate_async_pipeline.mean), tone: 'ours' },
                        { label: 'Segmentation', value: s.onnx_inference.mean, valueLabel: fmtMs(s.onnx_inference.mean), tone: 'baseline' },
                        { label: 'End to end', value: s.end_to_end_with_onnx.mean, valueLabel: fmtMs(s.end_to_end_with_onnx.mean), tone: 'baseline' },
                        {
                          label: 'Before optimisation',
                          sub: 'earlier run, end to end',
                          value: l.pre_optimization_baseline_ms.end_to_end_mean_ms,
                          valueLabel: fmtMs(l.pre_optimization_baseline_ms.end_to_end_mean_ms),
                          tone: 'baseline',
                        },
                      ]}
                    />
                    <Note>
                      Measured on {l.processor.split(' Family')[0]} ({l.platform.split('-').slice(0, 2).join(' ')}), CPU only, {l.warm_frames} warm frames of{' '}
                      {l.frames_evaluated}. There are no embedded-hardware (Jetson / Raspberry Pi) measurements; scaled projections exist in the repository
                      but are estimates from an older baseline and are not shown here.
                    </Note>
                    <SourceLine envelope={env} />
                  </>
                );
              }}
            </Gate>
          </EvidenceCard>

          {/* --------------------------------------------------------------------- MOS */}
          <EvidenceCard
            id="ev-mos"
            tag="D1"
            title="Moving-object filtering"
            claim="Range-image disparity flags moving points so they are not written into the static map as ghost trails."
          >
            <Gate res={mos}>
              {(env) => {
                const m = env.data;
                const c = m.classification_metrics;
                const t = m.task_4_3_ego_turn_robustness;
                return (
                  <>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      <StatTile metric="mos-precision" label="Precision" value={`${fmtExact(c.precision_pct)}%`} provenance="MEASURED" />
                      <StatTile metric="mos-recall" label="Recall" value={`${fmtExact(c.recall_pct)}%`} provenance="MEASURED" tone="warn" />
                      <StatTile metric="mos-f1" label="F1" value={`${fmtExact(c.f1_score_pct)}%`} provenance="MEASURED" />
                      <StatTile metric="mos-fpr" label="False-positive rate" value={`${fmtExact(c.false_positive_rate_pct)}%`} provenance="MEASURED" />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <StatTile
                        metric="ghost-cells"
                        label="Ghost cells carved"
                        value={fmtInt(m.anti_ghosting_metrics.ghost_cells_carved)}
                        sub={`from ${fmtInt(m.anti_ghosting_metrics.kalman_tracks_formed)} tracks over ${m.frames_evaluated} frames`}
                        provenance="MEASURED"
                      />
                      <StatTile
                        metric="mos-turn-fpr"
                        label="False positives while turning"
                        value={`${fmt(t.turning_fpr_pct, 2)}%`}
                        sub={`vs ${fmt(t.straight_fpr_pct, 2)}% straight; only ${t.turning_frames} turning frames`}
                        provenance="MEASURED"
                      />
                    </div>
                    <Note tone="warn">
                      Recall is {fmtExact(c.recall_pct)}%, so about {fmt(100 - c.recall_pct, 0)}% of moving points are missed in this evaluation. Moving
                      objects are not yet shown on the real scene in this viewer.
                    </Note>
                    <DataTable
                      caption="Moving-object confusion matrix (points)"
                      columns={['', 'Predicted moving', 'Predicted static']}
                      rows={[
                        ['Actually moving', fmtInt(m.confusion_matrix.true_positives), fmtInt(m.confusion_matrix.false_negatives)],
                        ['Actually static', fmtInt(m.confusion_matrix.false_positives), fmtInt(m.confusion_matrix.true_negatives)],
                      ]}
                    />
                    <SourceLine envelope={env} note={`${m.dataset} seq ${m.sequence}`} />
                  </>
                );
              }}
            </Gate>
          </EvidenceCard>

          {/* ------------------------------------------------------------------ regret */}
          <EvidenceCard
            id="ev-regret"
            tag="D2"
            title="Planner regret"
            claim="Path cost on the compressed map compared with the same planner on a dense reference map."
          >
            <Gate res={regret}>
              {(env) => {
                const r = env.data;
                const same = r.frame_records.filter((f) => f.regret_pct === f.naive_regret_pct).length;
                return (
                  <>
                    <div className="grid grid-cols-3 gap-2.5">
                      <StatTile metric="regret-mean" label="Mean regret" value={`${fmt(r.mean_foveagrid_regret_pct, 2)}%`} provenance="MEASURED" />
                      <StatTile metric="regret-max" label="Worst frame" value={`${fmt(r.max_foveagrid_regret_pct, 2)}%`} provenance="MEASURED" tone="warn" />
                      <StatTile metric="frechet-mean" label="Mean path deviation" value={`${fmt(r.mean_frechet_distance_m, 2)} m`} sub="Fréchet distance" provenance="MEASURED" />
                    </div>
                    <ColumnBars
                      title="Regret per frame"
                      unit="%"
                      max={Math.max(...r.frame_records.map((f) => f.regret_pct), 1)}
                      ariaLabel={`Planner regret per frame in percent: ${r.frame_records.map((f) => `frame ${f.frame_idx} ${fmt(f.regret_pct, 2)}`).join(', ')}`}
                      items={r.frame_records.map((f) => ({
                        label: `f${f.frame_idx}`,
                        value: f.regret_pct,
                        valueLabel: fmt(f.regret_pct, 1),
                        tone: 'ours' as const,
                      }))}
                    />
                    <Note tone="warn">
                      Standalone Hybrid-A* on {r.frames_evaluated} frames, not Nav2. A plain 2D map got the same regret as the FoveaGrid map on {same} of{' '}
                      {r.frame_records.length} frames, so this run does not show an advantage from dual elevation.
                    </Note>
                    <DataTable
                      caption="Planner cost per frame"
                      columns={['Frame', 'Dense 3D cost', 'FoveaGrid cost', 'Plain 2D cost', 'Regret (%)', 'Fréchet (m)']}
                      rows={r.frame_records.map((f) => [
                        f.frame_idx,
                        fmt(f.cost_dense_3d, 2),
                        fmt(f.cost_foveagrid_25d, 2),
                        fmt(f.cost_naive_2d, 2),
                        fmt(f.regret_pct, 2),
                        fmt(f.frechet_distance_m, 3),
                      ])}
                    />
                    <SourceLine envelope={env} note={r.dataset} />
                  </>
                );
              }}
            </Gate>
          </EvidenceCard>
        </div>

        {/* -------------------------------------------------------------- limitations */}
        <EvidenceCard
          id="ev-limits"
          title="What this does not show"
          claim="Known limits of the current system and of this dashboard, stated up front."
        >
          <ul className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs leading-relaxed text-fg-2 md:grid-cols-2">
            {[
              'Foveation follows a handful of speed and turn-rate presets. Hazard- or uncertainty-driven foveation is planned, not built.',
              'Cell statistics are plain running mean and variance (Welford). Heights are not passed through any probabilistic filter.',
              'The map is not registered across frames: each scene is a single scan or a short rolling window in the sensor frame.',
              'Points that fall outside the pool are not counted, so a "no data loss" claim cannot yet be measured.',
              'Per-cell point counts saturate at 255, which overstates variance in the densest cells.',
              'Segmentation is a third-party pretrained network trained on SemanticKITTI (non-commercial licence). The real scene is coloured with dataset labels, not network output.',
              'All speed figures are from a CPU laptop or workstation. There are no Jetson or other embedded measurements.',
              'The synthetic scenes are generated test cases built to stress one capability each; they are labelled as such wherever they appear.',
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-fg-muted" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </EvidenceCard>
      </div>
    </div>
  );
};
