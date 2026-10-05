import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Cpu,
  Database,
  Activity,
  Crosshair,
  Eye,
  EyeOff,
  Filter,
  SplitSquareHorizontal,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Route,
} from 'lucide-react';
import type { TelemetryResponse, SceneId, SceneData, GridCellData, LatticeRing } from '../types/telemetry';
import { POOL_MB } from '../lib/constants';
import { isAppScope } from '../lib/keyScope';
import { readToken, useTheme } from '../theme/theme';
import {
  cellKey,
  getInspector as getInspectorState,
  setInspector,
  useInspector,
  type FoveaPresetId,
  type InspectorColorBy,
  type InspectorProjection,
} from '../state/inspector';
import { clearReady, markReady } from '../state/readiness';
import { Segmented } from '../ui/Segmented';
import { inspectorHint } from '../data/scenes';
import { computeGroundZ } from '../data/pipeline';
import { presetVariantId, useVariant, useVariantAvailability } from '../data/variants';
import { usePlanner, usePlannerAvailability } from '../data/planner';
import { ProvenanceBadge } from '../features/evidence/primitives';
import { drawInspector, type CellLayer } from '../features/inspector/draw';
import { UNDERPASS_HINT, drawCostmap, fitUnderpass } from '../features/inspector/underpass';
import { UnderpassCard, UnderpassLegend, UnderpassPaneLabel } from '../features/inspector/UnderpassPanels';
import { isoDepth, makeProjection } from '../features/inspector/projection';
import {
  SEMANTIC_CLASSES,
  semanticColor,
  semanticName,
  overhangCss,
  gradientCss,
  getTurboColor,
  getVarianceColor,
} from '../theme/colormaps';

interface DataInspectionScreenProps {
  activeScene: SceneId;
  telemetryData: TelemetryResponse | null;
  sceneData: SceneData | null;
  isLoading: boolean;
  onBackToHook: () => void;
  onOpenEvidence: () => void;
}

type ColorBy = InspectorColorBy;

const COLOR_MODES: { id: ColorBy; label: string; info: string }[] = [
  { id: 'semantics', label: 'Class', info: 'Dominant semantic class of the points in each cell' },
  { id: 'ring', label: 'Ring', info: 'Which resolution ring (cell size) holds the cell' },
  { id: 'elevation', label: 'Elevation', info: 'Mean height of the points in each cell, low to high' },
  { id: 'variance', label: 'Variance', info: 'Welford running variance of height: high on edges, pits and clutter' },
  { id: 'overhang', label: 'Overhang', info: 'Cells where something was recorded above the road surface' },
];

// Ring geometry is architectural (core/grid lattice); colours come from --scene-ring-N tokens.
const RING_CONFIGS = [
  { id: 0, name: 'Fovea', range: '0–10m', res: '5cm', radius: 10 },
  { id: 1, name: 'Tactical', range: '10–25m', res: '10cm', radius: 25 },
  { id: 2, name: 'Planning', range: '25–50m', res: '25cm', radius: 50 },
  { id: 3, name: 'Horizon', range: '50–100m', res: '50cm', radius: 100 },
];

const PRESET_OPTIONS: { id: FoveaPresetId; label: string; title: string }[] = [
  { id: 'NOMINAL', label: 'Stationary', title: 'Vehicle at rest: all rings centred on the vehicle' },
  { id: 'CITY_CRUISE', label: 'City', title: 'City cruise: the fine zone shifts forward' },
  { id: 'HIGHWAY_EXTENDED', label: 'Highway', title: 'Highway speed: the fine zone shifts further forward' },
  { id: 'TURNING_LEFT', label: 'Turn left', title: 'Turning left: the fine zone shifts forward and to the left' },
  { id: 'TURNING_RIGHT', label: 'Turn right', title: 'Turning right: the fine zone shifts forward and to the right' },
];

const PROJECTION_OPTIONS: { id: InspectorProjection; label: string; title: string }[] = [
  { id: '2d', label: 'Top-down', title: 'Flat map from above' },
  { id: 'iso', label: 'Isometric', title: 'Tilted view so heights and overhangs show' },
];

const MIN_ZOOM = 1;
const MAX_ZOOM = 60;
const DEFAULT_ZOOM = 6;
const PICK_TOLERANCE_PX = 14;
const ISO_ORIGIN_Y = 0.62; // in the isometric view the vehicle sits lower so more of the road ahead is visible

interface View {
  zoom: number; // pixels per metre
  pan: { x: number; y: number }; // CSS-pixel offset of the ego origin from its default screen position
}

const fmtSigned = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`;

export const DataInspectionScreen: React.FC<DataInspectionScreenProps> = ({
  activeScene,
  telemetryData,
  sceneData,
  isLoading,
  onBackToHook,
  onOpenEvidence,
}) => {
  const { theme } = useTheme();
  const baseCells = useMemo<GridCellData[]>(() => sceneData?.cells ?? [], [sceneData]);
  const totalActive = sceneData?.totalActive ?? 0;

  // Colour, ring filter, projection, preset, compare and selection live in a shared store (state/inspector.ts) so
  // they survive switching views and can be driven by the tour through the same setters a click uses.
  const inspector = useInspector();
  const { colorBy, ringFilter: filterRing, projection: projMode, guides, preset, compare, underpass, divider } = inspector;
  const setColorBy = (id: ColorBy) => setInspector({ colorBy: id });
  const setFilterRing = (r: number | 'all') => setInspector({ ringFilter: r });

  // ---- data: the scene's base cells, optionally re-run with a foveation preset and/or a uniform 5 cm reference ----
  const availability = useVariantAvailability(activeScene);
  const presetId = presetVariantId(preset);
  const presetVar = useVariant(activeScene, presetId);
  const uniformVar = useVariant(activeScene, compare ? 'uniform_5cm' : null);
  const foveaMeta = presetId && presetVar.data ? presetVar.data.meta : null;
  const foveaCells = presetId && presetVar.data ? presetVar.data.cells : baseCells;
  const uniformCells = compare && uniformVar.data ? uniformVar.data.cells : null;
  const comparing = !!uniformCells;

  // Underpass comparison: the planner snapshot, only for scenes the manifest lists one for.
  const plannerAvailable = usePlannerAvailability(activeScene);
  const planner = usePlanner(activeScene, underpass && plannerAvailable === true);
  const underpassOn = underpass && !!planner.data;
  useEffect(() => {
    // Moving to a scene without a planner snapshot switches the comparison off instead of leaving a dead mode on.
    if (underpass && plannerAvailable === false) setInspector({ underpass: false });
  }, [underpass, plannerAvailable]);
  const shift = useMemo(() => ({ x: foveaMeta?.fovea?.shift_x_m ?? 0, y: foveaMeta?.fovea?.shift_y_m ?? 0 }), [foveaMeta]);

  const selectedCell = useMemo<GridCellData | null>(
    () => (inspector.selectedKey ? (foveaCells.find((c) => cellKey(c) === inspector.selectedKey) ?? null) : null),
    [foveaCells, inspector.selectedKey],
  );
  const setSelectedCell = (c: GridCellData | null) => setInspector({ selectedKey: c ? cellKey(c) : null });

  const [view, setView] = useState<View>({ zoom: DEFAULT_ZOOM, pan: { x: 0, y: 0 } });
  const [size, setSize] = useState({ w: 0, h: 0, dpr: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [probe, setProbe] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);
  const probeRaf = useRef<number | null>(null);

  // Size the canvas to its container (DPR-aware) so drawing and hit-testing share one coordinate system.
  // useLayoutEffect: measure before first paint so picking/drawing never run with a 0x0 size.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight, dpr: window.devicePixelRatio || 1 });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => clearReady('inspector-drawn'), []);

  const groundZ = useMemo(() => computeGroundZ(baseCells), [baseCells]);

  // ---- projection (screen position of the ego origin depends on the mode and the pan) ----
  const originOf = useCallback(
    (v: View) => ({ x: size.w / 2 + v.pan.x, y: size.h * (projMode === 'iso' ? ISO_ORIGIN_Y : 0.5) + v.pan.y }),
    [size.w, size.h, projMode],
  );
  const proj = useMemo(
    () => makeProjection({ mode: projMode, zoom: view.zoom, origin: originOf(view), groundZ }),
    [projMode, view, originOf, groundZ],
  );

  // Centre on a world point when asked (the tour uses this to bring a cell into view).
  const focusNonce = inspector.focus?.nonce;
  useEffect(() => {
    const f = getInspectorState().focus;
    if (!f || size.w === 0) return;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, f.zoom));
    const base = makeProjection({
      mode: projMode,
      zoom,
      origin: { x: size.w / 2, y: size.h * (projMode === 'iso' ? ISO_ORIGIN_Y : 0.5) },
      groundZ,
    }).project(f.x, f.y, f.z ?? groundZ);
    setView({ zoom, pan: { x: size.w / 2 - base.x, y: size.h / 2 - base.y } });
  }, [focusNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fit the underpass into one pane when the comparison turns on (and again if its data arrives later).
  useEffect(() => {
    if (!underpassOn || !planner.data || size.w === 0) return;
    const f = fitUnderpass(planner.data, size.w / 2, size.h);
    setInspector({ focus: { x: f.x, y: f.y, zoom: f.zoom, nonce: (getInspectorState().focus?.nonce ?? 0) + 1 } });
  }, [underpassOn, planner.data, size.w === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- derived cell sets ----
  const ringCounts = useMemo(() => {
    const counts = [0, 0, 0, 0];
    for (const c of foveaCells) if (c.ring_id >= 0 && c.ring_id < counts.length) counts[c.ring_id]++;
    return counts;
  }, [foveaCells]);

  // Isometric painting goes far to near; the order does not depend on pan or zoom, so it is computed once per set.
  const prepare = useCallback(
    (cells: GridCellData[]) => {
      const kept = filterRing === 'all' ? cells : cells.filter((c) => c.ring_id === filterRing);
      if (projMode !== 'iso') return kept;
      return kept
        .map((c) => [isoDepth(c.x_m, c.y_m), c] as const)
        .sort((a, b) => b[0] - a[0])
        .map((e) => e[1]);
    },
    [filterRing, projMode],
  );
  const foveaDisplayed = useMemo(() => prepare(foveaCells), [prepare, foveaCells]);
  const uniformDisplayed = useMemo(() => (uniformCells ? prepare(uniformCells) : null), [prepare, uniformCells]);

  const classCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of foveaCells) m.set(c.sem_id, (m.get(c.sem_id) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [foveaCells]);

  const lattice: LatticeRing[] = useMemo(
    () =>
      sceneData?.meta?.lattice ??
      RING_CONFIGS.map((r, i) => ({
        ring_id: r.id,
        res_m: [0.05, 0.1, 0.25, 0.5][i],
        r_inner: i === 0 ? 0 : RING_CONFIGS[i - 1].radius,
        r_outer: r.radius,
      })),
    [sceneData],
  );
  const ringGeoms = useMemo(() => lattice.map((r) => ({ id: r.ring_id, radius: r.r_outer })), [lattice]);

  const splitX = size.w * divider;

  // ---- draw ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0 || size.h === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pxW = Math.round(size.w * size.dpr);
    const pxH = Math.round(size.h * size.dpr);
    if (canvas.width !== pxW) canvas.width = pxW;
    if (canvas.height !== pxH) canvas.height = pxH;
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);

    if (underpassOn && planner.data) {
      // Two panes side by side, each its own costmap, sharing one pan and zoom.
      const data = planner.data;
      const half = size.w / 2;
      (['naive', 'aware'] as const).forEach((grid, i) => {
        drawInspector({
          ctx,
          w: size.w,
          h: size.h,
          proj: makeProjection({
            mode: '2d',
            zoom: view.zoom,
            origin: { x: half * (i + 0.5) + view.pan.x, y: size.h * 0.5 + view.pan.y },
            groundZ,
          }),
          layers: [],
          colorBy,
          theme,
          rings: ringGeoms,
          shift: { x: 0, y: 0 },
          showOutline: false,
          guides,
          selected: null,
          groundZ,
          pane: { x0: half * i, x1: half * (i + 1) },
          overlay: (c, pr) => drawCostmap(c, pr, data, grid, size.w, size.h),
        });
      });
      ctx.strokeStyle = readToken('--scene-grid-major');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(half) + 0.5, 0);
      ctx.lineTo(Math.round(half) + 0.5, size.h);
      ctx.stroke();
      markReady('inspector-drawn');
      return;
    }

    const layers: CellLayer[] =
      comparing && uniformDisplayed
        ? [
            { cells: uniformDisplayed, clipX: [0, splitX] },
            { cells: foveaDisplayed, clipX: [splitX, size.w] },
          ]
        : [{ cells: foveaDisplayed }];

    drawInspector({
      ctx,
      w: size.w,
      h: size.h,
      proj,
      layers,
      colorBy,
      theme,
      rings: ringGeoms,
      shift,
      showOutline: !!foveaMeta,
      guides,
      selected: selectedCell,
      groundZ,
    });
    if (foveaDisplayed.length > 0) markReady('inspector-drawn');
  }, [foveaDisplayed, uniformDisplayed, comparing, splitX, proj, colorBy, theme, ringGeoms, shift, foveaMeta, guides, selectedCell, size, groundZ, underpassOn, planner.data, view]);

  // ---- picking ----
  const pickAt = useCallback(
    (sx: number, sy: number): GridCellData | null => {
      if (underpassOn) return null;
      const set = comparing && uniformDisplayed && sx < splitX ? uniformDisplayed : foveaDisplayed;
      let best: GridCellData | null = null;
      let bestD = Infinity;
      if (proj.mode === '2d') {
        const w = proj.unproject(sx, sy);
        for (const c of set) {
          const d = Math.hypot(c.x_m - w.x, c.y_m - w.y);
          const tol = Math.max((c.res_m * 1.5) / 2, PICK_TOLERANCE_PX / view.zoom);
          if (d <= tol && d < bestD) {
            bestD = d;
            best = c;
          }
        }
        return best;
      }
      for (const c of set) {
        const p = proj.project(c.x_m, c.y_m, c.mean_z);
        const d = Math.hypot(p.x - sx, p.y - sy);
        const tol = Math.max(8, c.res_m * view.zoom * 0.75);
        if (d <= tol && d <= bestD) {
          bestD = d; // ties go to the later (nearer) cell in far-to-near order
          best = c;
        }
      }
      return best;
    },
    [underpassOn, comparing, uniformDisplayed, splitX, foveaDisplayed, proj, view.zoom],
  );

  const localPoint = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, panX: view.pan.x, panY: view.pan.y, moved: false };
    setIsDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (d) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      if (d.moved) setView((v) => ({ ...v, pan: { x: d.panX + dx, y: d.panY + dy } }));
      return;
    }
    // Cursor readout: at most one update per frame.
    const p = localPoint(e);
    if (probeRaf.current != null) return;
    probeRaf.current = requestAnimationFrame(() => {
      probeRaf.current = null;
      setProbe(proj.unproject(p.x, p.y));
    });
  };

  const onPointerLeave = () => {
    if (!dragRef.current) setProbe(null);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    if (d && !d.moved) {
      const p = localPoint(e);
      setSelectedCell(pickAt(p.x, p.y));
    }
  };

  useEffect(
    () => () => {
      if (probeRaf.current != null) cancelAnimationFrame(probeRaf.current);
    },
    [],
  );

  // Wheel zoom anchored at the cursor (non-passive so the page never scrolls).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const oyFrac = projMode === 'iso' ? ISO_ORIGIN_Y : 0.5;
      // Side by side, each pane has its own origin (a quarter and three quarters across).
      const baseX = underpassOn ? (cx < rect.width / 2 ? rect.width / 4 : (rect.width * 3) / 4) : rect.width / 2;
      setView((v) => {
        const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * Math.exp(-e.deltaY * 0.0015)));
        const k = nz / v.zoom;
        const ox = baseX + v.pan.x;
        const oy = rect.height * oyFrac + v.pan.y;
        return { zoom: nz, pan: { x: cx - (cx - ox) * k - baseX, y: cy - (cy - oy) * k - rect.height * oyFrac } };
      });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [projMode, underpassOn]);

  const zoomBy = (factor: number) =>
    setView((v) => ({ ...v, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor)) }));
  const resetView = () => setView({ zoom: DEFAULT_ZOOM, pan: { x: 0, y: 0 } });

  // The underpass comparison zooms to fit; when it ends the map goes back to its normal view.
  const wasUnderpass = useRef(false);
  useEffect(() => {
    if (wasUnderpass.current && !underpassOn) setView({ zoom: DEFAULT_ZOOM, pan: { x: 0, y: 0 } });
    wasUnderpass.current = underpassOn;
  }, [underpassOn]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const STEP = 40;
    if (e.key === 'ArrowLeft') setView((v) => ({ ...v, pan: { ...v.pan, x: v.pan.x + STEP } }));
    else if (e.key === 'ArrowRight') setView((v) => ({ ...v, pan: { ...v.pan, x: v.pan.x - STEP } }));
    else if (e.key === 'ArrowUp') setView((v) => ({ ...v, pan: { ...v.pan, y: v.pan.y + STEP } }));
    else if (e.key === 'ArrowDown') setView((v) => ({ ...v, pan: { ...v.pan, y: v.pan.y - STEP } }));
    else if (e.key === '+' || e.key === '=') zoomBy(1.25);
    else if (e.key === '-') zoomBy(1 / 1.25);
    else if (e.key === '0') resetView();
    else return;
    e.preventDefault();
  };

  // B toggles the uniform comparison (when the main app owns the keyboard).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !isAppScope()) return;
      if (e.key !== 'b' && e.key !== 'B') return;
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]')) return;
      setInspector({ compare: !getInspectorState().compare });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Swipe divider: drag, or arrow keys when focused.
  const onDividerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;
      setInspector({ divider: Math.min(0.95, Math.max(0.05, (ev.clientX - rect.left) / rect.width)) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const onDividerKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const d = getInspectorState().divider;
    if (e.key === 'ArrowLeft') setInspector({ divider: Math.max(0.05, d - 0.05) });
    else if (e.key === 'ArrowRight') setInspector({ divider: Math.min(0.95, d + 0.05) });
    else return;
    e.preventDefault();
  };

  // ---- readout ----
  const readout = useMemo(() => {
    if (!probe) return null;
    const dist = Math.hypot(probe.x - shift.x, probe.y - shift.y);
    const ring = lattice.find((r) => dist < r.r_outer);
    return { x: probe.x, y: probe.y, dist: Math.hypot(probe.x, probe.y), ring };
  }, [probe, shift, lattice]);

  const isReal = (sceneData?.meta?.kind ?? (activeScene.startsWith('real_') ? 'real' : 'synthetic')) === 'real';
  const sparseSample = !!sceneData?.meta?.note?.includes('Sparse');
  const shown = foveaCells.length;
  // Counts for the header chip: a preset variant reports its own totals (its drawn cells are a capped, evenly spaced sample).
  const chipTotal = foveaMeta ? foveaMeta.stats.active_cells : totalActive;
  const chipSampled = foveaMeta ? !!presetVar.data?.cellsSampled : !!sceneData?.cellsSampled;
  const sourceLabel = sceneData?.source === 'live' ? 'LIVE API' : sceneData ? 'PRECOMPUTED SNAPSHOT' : 'NO DATA';
  const sem = selectedCell ? semanticColor(selectedCell.sem_id, theme) : '';
  const modeInfo = COLOR_MODES.find((m) => m.id === colorBy)?.info ?? '';
  const hint = inspectorHint(activeScene, telemetryData?.telemetry?.tactical_summary, sparseSample);
  const presetLoading = !!presetId && presetVar.status === 'loading';
  const fineReach = foveaMeta?.fovea
    ? foveaMeta.fovea.shift_x_m + Math.sqrt(Math.max(0, lattice[0].r_outer ** 2 - foveaMeta.fovea.shift_y_m ** 2))
    : null;
  const uniformMeta = uniformVar.data?.meta ?? null;
  const foveaOccupied = foveaMeta ? foveaMeta.stats.active_cells : (telemetryData?.telemetry.active_cells ?? totalActive);
  const presetOptions = PRESET_OPTIONS.map((o) => {
    const vid = presetVariantId(o.id);
    const missing = !!vid && availability[vid] !== true;
    return { ...o, disabled: missing, title: missing ? 'Not exported for this scene' : o.title };
  });

  return (
    <main data-region="inspector-screen" className="w-full h-full flex flex-col bg-app text-fg select-none overflow-hidden font-sans">
      {/* Toolbar */}
      <header className="min-h-14 border-b border-line bg-panel px-4 py-2 flex flex-wrap items-center justify-between gap-2 z-30 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={onBackToHook}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-subtle hover:bg-line text-fg border border-line-strong text-xs font-semibold transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back to 3D</span>
          </button>
          <h1 className="font-bold text-sm text-fg tracking-tight">Map Inspector</h1>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono text-accent-text border border-accent-line bg-accent-subtle">
            {chipTotal
              ? `${chipTotal.toLocaleString()} cells${chipSampled ? ` (${shown.toLocaleString()} shown)` : ''}`
              : 'no cells'}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono text-fg-2 border border-line-strong bg-subtle">
            {sourceLabel}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
              isReal ? 'text-good-fg bg-good-bg border-good-line' : 'text-warn-fg bg-warn-bg border-warn-line'
            }`}
          >
            {isReal ? (sparseSample ? 'REAL: SemanticKITTI (sparse sample)' : 'REAL: SemanticKITTI Seq 08') : 'SYNTHETIC SCENE'}
          </span>
        </div>

        <div
          data-tour="inspector-colour"
          inert={underpassOn}
          className={`flex items-center gap-1.5 flex-wrap ${underpassOn ? 'opacity-40' : ''}`}
          role="group"
          aria-label="Colour cells by"
        >
          <span className="text-[11px] font-mono text-fg-muted flex items-center gap-1">
            <Filter size={12} />
            <span>Colour by</span>
          </span>
          {COLOR_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setColorBy(mode.id)}
              aria-pressed={colorBy === mode.id}
              title={mode.info}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold transition-all ${
                colorBy === mode.id
                  ? 'bg-accent text-accent-on shadow-xs'
                  : 'bg-subtle text-fg-2 hover:bg-line border border-line-strong'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </header>

      {/* Second toolbar: view, foveation preset, comparison, guides */}
      <div
        data-region="inspector-toolbar"
        className="border-b border-line bg-panel px-4 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] shrink-0"
      >
        <div data-tour="projection" className="flex items-center gap-2">
          <span className="font-mono text-fg-muted">View</span>
          <Segmented<InspectorProjection>
            ariaLabel="Map projection"
            value={projMode}
            onChange={(id) => setInspector({ projection: id })}
            options={PROJECTION_OPTIONS}
          />
        </div>

        <div data-tour="fovea-presets" inert={underpassOn} className={`flex items-center gap-2 ${underpassOn ? 'opacity-40' : ''}`}>
          <span className="font-mono text-fg-muted" title="Re-runs this scan through the grid with each speed or turn preset">
            Fovea preset
          </span>
          <Segmented<FoveaPresetId>
            ariaLabel="Foveation preset"
            value={preset}
            onChange={(id) => setInspector({ preset: id })}
            options={presetOptions}
          />
          {presetLoading && <span className="font-mono text-fg-muted">loading…</span>}
        </div>

        <button
          data-tour="compare-toggle"
          onClick={() => setInspector({ compare: !compare })}
          aria-pressed={compare}
          title="Compare with a uniform 5 cm grid on the same scan (B)"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-semibold transition-colors ${
            compare ? 'bg-accent text-accent-on border-accent' : 'bg-subtle text-fg-2 border-line-strong hover:text-fg'
          }`}
        >
          <SplitSquareHorizontal size={13} aria-hidden="true" />
          <span>Compare with uniform 5 cm</span>
        </button>

        <button
          data-tour="underpass-toggle"
          onClick={() => setInspector({ underpass: !underpass })}
          aria-pressed={underpass}
          disabled={plannerAvailable !== true}
          title={
            plannerAvailable === true
              ? 'The same scan as a costmap from a one-height grid and from the 2.5D grid, and what the planner does with each'
              : 'No planner run is exported for this scene'
          }
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            underpass ? 'bg-accent text-accent-on border-accent' : 'bg-subtle text-fg-2 border-line-strong hover:text-fg'
          }`}
        >
          <Route size={13} aria-hidden="true" />
          <span>Underpass: one height vs 2.5D</span>
        </button>

        <button
          onClick={() => setInspector({ guides: !guides })}
          aria-pressed={guides}
          title="Show ring labels and the forward / left axes"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-semibold transition-colors ${
            guides ? 'bg-accent-subtle text-accent-text border-accent-line' : 'bg-subtle text-fg-2 border-line-strong hover:text-fg'
          }`}
        >
          {guides ? <Eye size={13} aria-hidden="true" /> : <EyeOff size={13} aria-hidden="true" />}
          <span>Guides</span>
        </button>
      </div>

      <p data-region="inspector-hint" className="px-4 py-1.5 text-[11px] text-fg-2 border-b border-line bg-subtle shrink-0">
        {underpassOn ? (
          UNDERPASS_HINT
        ) : (
          <>
            {hint} <span className="text-fg-muted">{modeInfo}.</span>
          </>
        )}
      </p>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas stage */}
        <div ref={stageRef} className="flex-1 relative bg-scene-bg overflow-hidden" data-region="inspector-canvas" data-tour="inspector-canvas">
          <canvas
            ref={canvasRef}
            tabIndex={0}
            role="img"
            data-fovea-shift={foveaMeta ? `${shift.x},${shift.y}` : '0,0'}
            data-projection={projMode}
            data-underpass={underpassOn ? 'on' : 'off'}
            aria-label={
              underpassOn
                ? 'Two costmaps of the same scan side by side: from a one-height grid on the left and from the 2.5D grid on the right. Arrow keys pan, plus and minus zoom.'
                : `${projMode === 'iso' ? 'Isometric' : 'Top-down'} map of ${foveaDisplayed.length} grid cells coloured by ${colorBy}. Arrow keys pan, plus and minus zoom.`
            }
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
            onPointerUp={onPointerUp}
            onKeyDown={onKeyDown}
            style={{ width: size.w, height: size.h, touchAction: 'none' }}
            className={`block ${isDragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
          />

          {/* Ring filter */}
          {!underpassOn && (
          <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
            <div data-tour="ring-filter" className="bg-panel/90 border border-line rounded-xl p-2.5 backdrop-blur-md flex flex-col gap-1.5 shadow-lg text-xs font-mono">
              <div className="text-[10px] text-fg-muted font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Crosshair size={12} className="text-accent-text" />
                <span>Ring resolution filter</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => setFilterRing('all')}
                  aria-pressed={filterRing === 'all'}
                  className={`px-2 py-0.5 rounded text-[10px] ${
                    filterRing === 'all' ? 'bg-accent text-accent-on font-bold' : 'bg-subtle text-fg-muted'
                  }`}
                >
                  All
                </button>
                {RING_CONFIGS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setFilterRing(r.id)}
                    aria-pressed={filterRing === r.id}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      filterRing === r.id ? 'bg-accent text-accent-on font-bold' : 'bg-subtle text-fg-muted'
                    }`}
                  >
                    R{r.id} ({r.res})
                  </button>
                ))}
              </div>
            </div>
          </div>
          )}

          {/* Underpass: a title and verdict over each pane */}
          {underpassOn && planner.data && (
            <>
              <UnderpassPaneLabel data={planner.data} grid="naive" leftPct={25} />
              <UnderpassPaneLabel data={planner.data} grid="aware" leftPct={75} />
            </>
          )}

          {/* A/B swipe divider */}
          {comparing && (
            <>
              <span className="absolute top-3 z-20 -translate-x-full pr-3 pointer-events-none" style={{ left: `${divider * 100}%` }}>
                <span className="rounded border border-line bg-panel/90 px-2 py-0.5 text-[10px] font-mono font-bold text-fg-2">Uniform 5 cm</span>
              </span>
              <span className="absolute top-3 z-20 pl-3 pointer-events-none" style={{ left: `${divider * 100}%` }}>
                <span className="rounded border border-accent-line bg-accent-subtle px-2 py-0.5 text-[10px] font-mono font-bold text-accent-text">FoveaGrid</span>
              </span>
              <div
                data-region="compare-divider"
                role="slider"
                tabIndex={0}
                aria-label="Comparison divider: uniform 5 cm on the left, FoveaGrid on the right"
                aria-valuemin={5}
                aria-valuemax={95}
                aria-valuenow={Math.round(divider * 100)}
                onPointerDown={onDividerPointerDown}
                onKeyDown={onDividerKey}
                className="absolute inset-y-0 z-20 w-6 -translate-x-1/2 cursor-ew-resize touch-none flex justify-center group focus:outline-none"
                style={{ left: `${divider * 100}%` }}
              >
                <span className="w-0.5 h-full bg-accent group-focus-visible:w-1" />
                <span
                  className="absolute top-1/2 -translate-y-1/2 w-5 h-9 rounded-full bg-accent text-accent-on border-2 border-panel shadow-md flex items-center justify-center text-[10px] font-bold"
                  aria-hidden="true"
                >
                  ⇆
                </span>
              </div>
            </>
          )}

          {/* Cursor readout */}
          {readout && !underpassOn && (
            <div
              data-region="inspector-readout"
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 rounded-lg border border-line bg-panel/90 px-3 py-1 text-[11px] font-mono text-fg-2 shadow-md backdrop-blur-md pointer-events-none whitespace-nowrap"
            >
              X <strong className="text-fg">{fmtSigned(readout.x)} m</strong> fwd · Y <strong className="text-fg">{fmtSigned(readout.y)} m</strong> lat ·{' '}
              <strong className="text-fg">{readout.dist.toFixed(1)} m</strong>
              {readout.ring ? ` · R${readout.ring.ring_id} ${Math.round(readout.ring.res_m * 100)} cm` : ' · outside the grid'}
            </div>
          )}

          {/* Zoom controls */}
          <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-panel/90 border border-line rounded-lg p-1 z-20 shadow-md">
            <button onClick={() => zoomBy(1.25)} className="p-1.5 rounded hover:bg-subtle text-fg-2" aria-label="Zoom in" title="Zoom in (+)">
              <ZoomIn size={14} />
            </button>
            <button onClick={() => zoomBy(1 / 1.25)} className="p-1.5 rounded hover:bg-subtle text-fg-2" aria-label="Zoom out" title="Zoom out (-)">
              <ZoomOut size={14} />
            </button>
            <button onClick={resetView} className="p-1.5 rounded hover:bg-subtle text-fg-2" aria-label="Reset view" title="Reset view (0)">
              <RotateCcw size={14} />
            </button>
            <span className="text-[10px] font-mono text-fg-muted px-2 tabular-nums">{view.zoom.toFixed(1)} px/m</span>
          </div>

          {/* Legend */}
          {underpassOn && <UnderpassLegend />}
          {!underpassOn && baseCells.length > 0 && (
            <div
              data-region="inspector-legend"
              className="absolute bottom-4 right-4 z-20 bg-panel/90 border border-line rounded-xl p-2.5 backdrop-blur-md shadow-md text-[10px] font-mono text-fg-2 max-w-56"
            >
              {colorBy === 'semantics' && (
                <ul className="flex flex-col gap-1">
                  {classCounts.map(([id, n]) => (
                    <li key={id} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: semanticColor(id, theme) }} />
                      <span className="truncate">{semanticName(id)}</span>
                      <span className="ml-auto text-fg-muted tabular-nums">{n.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
              {colorBy === 'ring' && (
                <ul className="flex flex-col gap-1">
                  {RING_CONFIGS.map((r) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: `var(--scene-ring-${r.id})` }} />
                      <span>
                        R{r.id} {r.name} · {r.res}
                      </span>
                    </li>
                  ))}
                  {comparing && <li className="text-fg-muted">Uniform cells all count as R0 (one 5 cm ring).</li>}
                </ul>
              )}
              {colorBy === 'elevation' && (
                <div className="flex flex-col gap-1">
                  <div className="h-2 rounded" style={{ background: gradientCss(getTurboColor) }} />
                  <div className="flex justify-between text-fg-muted">
                    <span>−2 m</span>
                    <span>mean z</span>
                    <span>+2 m</span>
                  </div>
                </div>
              )}
              {colorBy === 'variance' && (
                <div className="flex flex-col gap-1">
                  <div className="h-2 rounded" style={{ background: gradientCss(getVarianceColor) }} />
                  <div className="flex justify-between text-fg-muted">
                    <span>0</span>
                    <span>Welford variance</span>
                    <span>≥0.05 m²</span>
                  </div>
                </div>
              )}
              {colorBy === 'overhang' && (
                <ul className="flex flex-col gap-1">
                  <li className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: overhangCss(true, theme) }} />
                    <span>Overhang recorded</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: overhangCss(false, theme) }} />
                    <span>Open above</span>
                  </li>
                </ul>
              )}
            </div>
          )}

          {!isLoading && baseCells.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="max-w-sm text-center text-xs font-mono text-fg-muted bg-panel/90 border border-line rounded-xl p-4">
                No grid cells are available for this scene: the precomputed snapshot is missing and the API has no data for it.
              </div>
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 bg-app/80 backdrop-blur-xs flex items-center justify-center z-30">
              <div className="flex items-center gap-2.5 text-xs font-mono text-accent-text">
                <Activity size={16} className="animate-spin" />
                <span>Loading grid cells…</span>
              </div>
            </div>
          )}
        </div>

        {/* Inspector sidebar */}
        <section
          aria-label="Cell and scene details"
          data-region="inspector-sidebar"
          data-tour="cell-inspector"
          className="w-80 xl:w-96 border-l border-line bg-panel overflow-y-auto flex flex-col divide-y divide-line text-xs z-20 shrink-0"
        >
          {/* While the underpass comparison is on its figures lead the sidebar, so they stay in view. */}
          {underpass && (
            <UnderpassCard data={planner.data} status={planner.status} minClearance={telemetryData?.telemetry?.tactical_summary?.min_clearance_m ?? null} />
          )}

          {/* Cells cannot be picked while the two costmaps are shown, so the panel would only mislead. */}
          {!underpassOn && (
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-fg uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Database size={13} className="text-accent-text" />
                <span>Cell inspector</span>
              </span>
              <span className="text-[10px] font-mono text-fg-muted">
                {selectedCell ? `ix: ${selectedCell.ix}, iy: ${selectedCell.iy}` : 'Select a cell'}
              </span>
            </div>

            {selectedCell ? (
              <div className="flex flex-col gap-2 bg-subtle border border-line rounded-xl p-3">
                <Row label="World (X, Y)" value={`(${selectedCell.x_m} m, ${selectedCell.y_m} m)`} valueClass="text-accent-text" />
                <Row label="Resolution ring" value={`Ring ${selectedCell.ring_id} (${Math.round(selectedCell.res_m * 100)} cm cell)`} />
                <div className="flex justify-between items-center py-1">
                  <span className="text-fg-muted">Dominant class</span>
                  <span
                    className="font-bold px-2 py-0.5 rounded text-[10px] border"
                    style={{ color: sem, borderColor: sem, backgroundColor: `color-mix(in srgb, ${sem} 14%, transparent)` }}
                  >
                    {SEMANTIC_CLASSES[selectedCell.sem_id]?.name ?? `Class ${selectedCell.sem_id}`}
                  </span>
                </div>
                <Row label="LiDAR returns" value={`${selectedCell.count} points`} />
                <Row label="Welford mean Z" value={`${selectedCell.mean_z} m`} />
                <Row label="Welford variance" value={`${selectedCell.variance} m²`} />
                <Row label="Z span" value={`[${selectedCell.min_z} m → ${selectedCell.max_z} m]`} />
                <div className="pt-2 border-t border-line">
                  <Row
                    label="Overhang clearance"
                    value={selectedCell.clearance != null ? `${selectedCell.clearance} m` : 'none recorded'}
                  />
                </div>
                {selectedCell.count >= 255 && (
                  <div className="p-2 rounded bg-warn-bg border border-warn-line text-[10px] font-mono text-warn-fg">
                    The per-cell count saturates at 255 (uint8), so variance in this cell is overstated.
                  </div>
                )}
                <div className="mt-1 p-2 rounded bg-panel border border-line text-[10px] font-mono text-fg-muted">
                  Each cell is a 32-byte struct in a preallocated pool.
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-fg-muted font-mono">
                Click any cell on the map to inspect its resolution ring, class and Welford statistics.
              </div>
            )}
          </div>
          )}

          {/* Foveation: where the fine cells sit for the chosen preset (all values from the exported variant file) */}
          {!underpassOn && (
          <div data-region="fovea-card" className="p-4 flex flex-col gap-2.5">
            <span className="font-bold text-fg uppercase tracking-wider text-[11px]">Foveation</span>
            {foveaMeta?.fovea ? (
              <div className="bg-subtle border border-line rounded-lg p-3 flex flex-col gap-1.5 text-[11px] font-mono">
                <Row label="Preset" value={foveaMeta.fovea.preset.replace(/_/g, ' ').toLowerCase()} />
                <Row
                  label="Controller input"
                  value={`${foveaMeta.fovea.input.vx_mps} m/s fwd, yaw ${foveaMeta.fovea.input.yaw_rate_rads} rad/s`}
                />
                <Row label="Fine zone shift" value={`${foveaMeta.fovea.shift_x_m} m fwd, ${foveaMeta.fovea.shift_y_m} m left`} />
                {fineReach != null && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-fg-muted" title={`The preset's configured reach is ${foveaMeta.fovea.forward_reach_m} m`}>
                      Fine cells reach ahead
                    </span>
                    <span className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                      <strong className="text-fg tabular-nums">{fineReach.toFixed(1)} m</strong>
                      <ProvenanceBadge kind="CALCULATED" />
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-fg-muted">Fine cells ahead / behind</span>
                  <span className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                    <strong className="text-fg tabular-nums">
                      {foveaMeta.stats.ring0_ahead.toLocaleString()} / {foveaMeta.stats.ring0_behind.toLocaleString()}
                    </strong>
                    <ProvenanceBadge kind="MEASURED" />
                  </span>
                </div>
                <p className="text-fg-muted leading-relaxed pt-1">
                  One scan re-run through the grid with this preset&apos;s input, not a drive. The dashed outline is where each ring sits.
                </p>
              </div>
            ) : (
              <p className="text-[11px] font-mono text-fg-muted leading-relaxed">
                Stationary: every ring is centred on the vehicle. Pick a speed or turn preset in the toolbar to see the fine zone shift.
              </p>
            )}
          </div>

          )}

          {/* Uniform vs FoveaGrid, from the two exported grids */}
          {compare && (
            <div data-region="compare-card" className="p-4 flex flex-col gap-2.5">
              <span className="font-bold text-fg uppercase tracking-wider text-[11px]">Uniform 5 cm vs FoveaGrid</span>
              {uniformMeta ? (
                <div className="bg-subtle border border-line rounded-lg p-3 flex flex-col gap-1.5 text-[11px] font-mono">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-fg-muted">Occupied cells, uniform</span>
                    <span className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                      <strong className="text-fg tabular-nums">{uniformMeta.stats.active_cells.toLocaleString()}</strong>
                      <ProvenanceBadge kind="MEASURED" />
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-fg-muted">Occupied cells, FoveaGrid</span>
                    <span className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                      <strong className="text-fg tabular-nums">{foveaOccupied.toLocaleString()}</strong>
                      <ProvenanceBadge kind="MEASURED" />
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-fg-muted">Reserved memory, uniform</span>
                    <span className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                      <strong className="text-fg tabular-nums">{uniformMeta.uniform?.theoretical_capacity_mb.toFixed(1)} MB</strong>
                      <ProvenanceBadge kind="CALCULATED" />
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-fg-muted">Reserved memory, FoveaGrid</span>
                    <span className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                      <strong className="text-fg tabular-nums">{POOL_MB.toFixed(4)} MB</strong>
                      <ProvenanceBadge kind="CALCULATED" />
                    </span>
                  </div>
                  <p className="text-fg-muted leading-relaxed pt-1">
                    Reserved memory is the fixed pool each design allocates up front, a capacity and not what a scan uses. Occupied
                    cells are what this scan actually fills.
                    {!foveaMeta && ' Within the first ring both grids use the same 5 cm cells.'}
                    {sparseSample && ' This scene is a sparse sample, so both grids hold few cells.'}
                    {(uniformVar.data?.cellsSampled || presetVar.data?.cellsSampled) && ' The map draws an evenly spaced sample of the cells; the counts above are for all of them.'}
                  </p>
                </div>
              ) : (
                <p className="text-[11px] font-mono text-fg-muted">
                  {uniformVar.status === 'unavailable' ? 'No uniform reference was exported for this scene.' : 'Loading the uniform reference…'}
                </p>
              )}
            </div>
          )}

          <div className="p-4 flex flex-col gap-3">
            <span className="font-bold text-fg uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Cpu size={13} className="text-accent-text" />
              <span>Scene statistics</span>
            </span>

            <div className="bg-subtle border border-line rounded-lg p-3 flex flex-col gap-1.5 text-[11px] font-mono">
              <Row
                label="Occupied cells"
                value={
                  telemetryData
                    ? `${telemetryData.telemetry.active_cells.toLocaleString()} of ${telemetryData.telemetry.capacity.toLocaleString()}`
                    : totalActive
                      ? totalActive.toLocaleString()
                      : 'n/a'
                }
              />
              <Row label="Pool (fixed by design)" value={`${(telemetryData?.telemetry.total_heap_mb ?? POOL_MB).toFixed(4)} MB`} />
              {!underpassOn && <Row label="Cells shown" value={foveaCells.length.toLocaleString()} />}
            </div>

            {foveaCells.length > 0 && (
              <div className="bg-subtle border border-line rounded-lg p-3 flex flex-col gap-1.5 text-[11px] font-mono">
                <span className="font-bold text-fg-2">Cells per resolution ring</span>
                {RING_CONFIGS.map((r) => (
                  <div key={r.id} className="flex justify-between text-fg-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: `var(--scene-ring-${r.id})` }} />
                      R{r.id} ({r.res}, {r.range})
                    </span>
                    <span className="text-fg tabular-nums">{ringCounts[r.id].toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[10px] font-mono text-fg-muted leading-relaxed">
              Benchmark results (accuracy, speed, fidelity by distance, regret) are produced offline and shown, with their
              source files, on the{' '}
              <button onClick={onOpenEvidence} className="text-accent-text underline underline-offset-2 hover:no-underline">
                Evidence page
              </button>
              .
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

const Row: React.FC<{ label: string; value: string; valueClass?: string }> = ({ label, value, valueClass }) => (
  <div className="flex justify-between items-center gap-3 py-0.5">
    <span className="text-fg-muted">{label}</span>
    <span className={`font-mono font-bold tabular-nums text-right ${valueClass ?? 'text-fg'}`}>{value}</span>
  </div>
);
