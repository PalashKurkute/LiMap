import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Cpu,
  Database,
  Activity,
  Crosshair,
  Filter,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import type { TelemetryResponse, SceneId } from '../types/telemetry';
import { POOL_MB } from '../lib/constants';
import { readToken, useTheme } from '../theme/theme';
import {
  SEMANTIC_CLASSES,
  semanticColor,
  semanticName,
  elevationCss,
  varianceCss,
  overhangCss,
  gradientCss,
  getTurboColor,
  getVarianceColor,
} from '../theme/colormaps';

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

interface DataInspectionScreenProps {
  activeScene: SceneId;
  telemetryData: TelemetryResponse | null;
  onBackToHook: () => void;
  onSelectScene?: (sceneId: SceneId) => void;
}

type ColorBy = 'ring' | 'semantics' | 'elevation' | 'variance' | 'overhang';

const COLOR_MODES: { id: ColorBy; label: string }[] = [
  { id: 'semantics', label: 'Class' },
  { id: 'ring', label: 'Ring' },
  { id: 'elevation', label: 'Elevation' },
  { id: 'variance', label: 'Variance' },
  { id: 'overhang', label: 'Overhang' },
];

// Ring geometry is architectural (core/grid lattice); colours come from --scene-ring-N tokens.
const RING_CONFIGS = [
  { id: 0, name: 'Fovea', range: '0–10m', res: '5cm', radius: 10 },
  { id: 1, name: 'Tactical', range: '10–25m', res: '10cm', radius: 25 },
  { id: 2, name: 'Planning', range: '25–50m', res: '25cm', radius: 50 },
  { id: 3, name: 'Horizon', range: '50–100m', res: '50cm', radius: 100 },
];

const CELL_LIMIT = 20000;
const MIN_ZOOM = 1;
const MAX_ZOOM = 60;
const DEFAULT_ZOOM = 6;
const PICK_TOLERANCE_PX = 14;

interface View {
  zoom: number; // pixels per metre
  pan: { x: number; y: number }; // CSS-pixel offset of the ego origin from the canvas centre
}

export const DataInspectionScreen: React.FC<DataInspectionScreenProps> = ({
  activeScene,
  telemetryData,
  onBackToHook,
}) => {
  const { theme } = useTheme();
  const [cells, setCells] = useState<GridCellData[]>([]);
  const [totalActive, setTotalActive] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCell, setSelectedCell] = useState<GridCellData | null>(null);
  const [colorBy, setColorBy] = useState<ColorBy>('semantics');
  const [filterRing, setFilterRing] = useState<number | 'all'>('all');
  const [view, setView] = useState<View>({ zoom: DEFAULT_ZOOM, pan: { x: 0, y: 0 } });
  const [size, setSize] = useState({ w: 0, h: 0, dpr: 1 });
  const [isDragging, setIsDragging] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);

  // Fetch real cells from /api/grid_cells
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setSelectedCell(null);

    fetch(`/api/grid_cells?limit=${CELL_LIMIT}`)
      .then((res) => {
        if (!res.ok) throw new Error('API offline');
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setCells(data.cells || []);
        setTotalActive(data.total_active || 0);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setCells([]);
        setTotalActive(0);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeScene]);

  // Size the canvas to its container (DPR-aware) so drawing and hit-testing share one coordinate system.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight, dpr: window.devicePixelRatio || 1 });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ringCounts = useMemo(() => {
    const counts = [0, 0, 0, 0];
    for (const c of cells) if (c.ring_id >= 0 && c.ring_id < counts.length) counts[c.ring_id]++;
    return counts;
  }, [cells]);

  const displayedCells = useMemo(
    () => (filterRing === 'all' ? cells : cells.filter((c) => c.ring_id === filterRing)),
    [cells, filterRing],
  );

  const classCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of cells) m.set(c.sem_id, (m.get(c.sem_id) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [cells]);

  // ---- coordinate transforms (CSS pixels) ----
  const originOf = useCallback(
    (v: View) => ({ x: size.w / 2 + v.pan.x, y: size.h / 2 + v.pan.y }),
    [size.w, size.h],
  );

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

    const { zoom } = view;
    const o = originOf(view);

    const bg = readToken('--scene-bg');
    const gridColor = readToken('--scene-grid-minor');
    const egoColor = readToken('--scene-ego');
    const selColor = readToken('--scene-selection');
    const labelColor = readToken('--fg-muted');
    const ringColors = RING_CONFIGS.map((r) => readToken(`--scene-ring-${r.id}`));

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size.w, size.h);

    // Metric grid every 10 m
    const step = 10 * zoom;
    ctx.lineWidth = 1;
    ctx.strokeStyle = gridColor;
    ctx.beginPath();
    for (let x = (((o.x % step) + step) % step) - step; x < size.w + step; x += step) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, size.h);
    }
    for (let y = (((o.y % step) + step) % step) - step; y < size.h + step; y += step) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(size.w, Math.round(y) + 0.5);
    }
    ctx.stroke();

    // Cells (X forward = up, Y left = left)
    const semCache = new Map<number, string>();
    const semFill = (id: number) => {
      let c = semCache.get(id);
      if (!c) {
        c = semanticColor(id, theme);
        semCache.set(id, c);
      }
      return c;
    };
    const overhangOn = overhangCss(true, theme);
    const overhangOff = overhangCss(false, theme);

    for (const cell of displayedCells) {
      const cx = o.x - cell.y_m * zoom;
      const cy = o.y - cell.x_m * zoom;
      const px = Math.max(2, cell.res_m * zoom);
      if (cx < -px || cy < -px || cx > size.w + px || cy > size.h + px) continue;

      let fill: string;
      switch (colorBy) {
        case 'ring':
          fill = ringColors[cell.ring_id] ?? labelColor;
          break;
        case 'elevation':
          fill = elevationCss(cell.mean_z);
          break;
        case 'variance':
          fill = varianceCss(cell.variance);
          break;
        case 'overhang':
          fill = cell.overhang_z != null ? overhangOn : overhangOff;
          break;
        default:
          fill = semFill(cell.sem_id);
      }
      ctx.fillStyle = fill;
      ctx.fillRect(cx - px / 2, cy - px / 2, px, px);
    }

    // Range rings drawn above cells so boundaries stay visible
    RING_CONFIGS.forEach((r, idx) => {
      ctx.beginPath();
      ctx.arc(o.x, o.y, r.radius * zoom, 0, Math.PI * 2);
      ctx.strokeStyle = ringColors[idx];
      ctx.lineWidth = 1.25;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ringColors[idx];
      ctx.font = '10px "JetBrains Mono Variable", monospace';
      ctx.fillText(`${r.radius}m`, o.x + r.radius * zoom + 4, o.y - 4);
    });

    // Selection outline
    if (selectedCell) {
      const cx = o.x - selectedCell.y_m * view.zoom;
      const cy = o.y - selectedCell.x_m * view.zoom;
      const px = Math.max(2, selectedCell.res_m * view.zoom);
      ctx.strokeStyle = selColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - px / 2 - 2, cy - px / 2 - 2, px + 4, px + 4);
    }

    // Ego marker + heading
    ctx.fillStyle = egoColor;
    ctx.beginPath();
    ctx.arc(o.x, o.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = bg;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(o.x, o.y - 4);
    ctx.lineTo(o.x, o.y - 14);
    ctx.strokeStyle = egoColor;
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [displayedCells, view, colorBy, selectedCell, size, theme, originOf]);

  // ---- picking ----
  const pickAt = useCallback(
    (sx: number, sy: number): GridCellData | null => {
      const o = originOf(view);
      const wy = (o.x - sx) / view.zoom;
      const wx = (o.y - sy) / view.zoom;
      let best: GridCellData | null = null;
      let bestD = Infinity;
      for (const c of displayedCells) {
        const d = Math.hypot(c.x_m - wx, c.y_m - wy);
        const tol = Math.max((c.res_m * 1.5) / 2, PICK_TOLERANCE_PX / view.zoom);
        if (d <= tol && d < bestD) {
          bestD = d;
          best = c;
        }
      }
      return best;
    },
    [displayedCells, view, originOf],
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
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.moved) setView((v) => ({ ...v, pan: { x: d.panX + dx, y: d.panY + dy } }));
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

  // Wheel zoom anchored at the cursor (non-passive so the page never scrolls).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setView((v) => {
        const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * Math.exp(-e.deltaY * 0.0015)));
        const k = nz / v.zoom;
        const ox = rect.width / 2 + v.pan.x;
        const oy = rect.height / 2 + v.pan.y;
        return { zoom: nz, pan: { x: cx - (cx - ox) * k - rect.width / 2, y: cy - (cy - oy) * k - rect.height / 2 } };
      });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  const zoomBy = (factor: number) =>
    setView((v) => ({ ...v, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor)) }));
  const resetView = () => setView({ zoom: DEFAULT_ZOOM, pan: { x: 0, y: 0 } });

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

  const isReal = activeScene.startsWith('real_');
  const sem = selectedCell ? semanticColor(selectedCell.sem_id, theme) : '';

  return (
    <div data-region="inspector-screen" className="w-full h-full flex flex-col bg-app text-fg select-none overflow-hidden font-sans">
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
          <span className="font-bold text-sm text-fg tracking-tight">Map Inspector</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono text-accent-text border border-accent-line bg-accent-subtle">
            {totalActive ? `${totalActive.toLocaleString()} cells` : 'no cells'}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
              isReal ? 'text-good-fg bg-good-bg border-good-line' : 'text-warn-fg bg-warn-bg border-warn-line'
            }`}
          >
            {isReal ? 'REAL: SemanticKITTI Seq 08' : 'SYNTHETIC SCENE'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Colour cells by">
          <span className="text-[11px] font-mono text-fg-muted flex items-center gap-1">
            <Filter size={12} />
            <span>Colour by</span>
          </span>
          {COLOR_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setColorBy(mode.id)}
              aria-pressed={colorBy === mode.id}
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

      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas stage */}
        <div ref={stageRef} className="flex-1 relative bg-scene-bg overflow-hidden" data-region="inspector-canvas">
          <canvas
            ref={canvasRef}
            tabIndex={0}
            role="img"
            aria-label={`Top-down map of ${displayedCells.length} grid cells coloured by ${colorBy}. Arrow keys pan, plus and minus zoom.`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onKeyDown={onKeyDown}
            style={{ width: size.w, height: size.h, touchAction: 'none' }}
            className={`block ${isDragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
          />

          {/* Ring filter */}
          <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
            <div className="bg-panel/90 border border-line rounded-xl p-2.5 backdrop-blur-md flex flex-col gap-1.5 shadow-lg text-xs font-mono">
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
          {cells.length > 0 && (
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

          {!isLoading && cells.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="max-w-sm text-center text-xs font-mono text-fg-muted bg-panel/90 border border-line rounded-xl p-4">
                No grid cells available for this scene. Start the API with scene data loaded to inspect real cells.
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
        <aside
          data-region="inspector-sidebar"
          className="w-80 xl:w-96 border-l border-line bg-panel overflow-y-auto flex flex-col divide-y divide-line text-xs z-20 shrink-0"
        >
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
              <Row label="Cells shown" value={cells.length.toLocaleString()} />
            </div>

            {cells.length > 0 && (
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
              Benchmark results (accuracy, latency, fidelity by distance, regret) are produced offline from
              <span className="text-fg-2"> benchmark/*.json</span> and are not shown on this screen.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; valueClass?: string }> = ({ label, value, valueClass }) => (
  <div className="flex justify-between items-center gap-3 py-0.5">
    <span className="text-fg-muted">{label}</span>
    <span className={`font-mono font-bold tabular-nums text-right ${valueClass ?? 'text-fg'}`}>{value}</span>
  </div>
);
