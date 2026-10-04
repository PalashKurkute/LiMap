import React, { useState, useEffect, useRef, useMemo } from 'react';
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

const SEMANTIC_CLASS_NAMES: Record<number, { name: string; color: string }> = {
  0: { name: 'Unlabeled', color: '#94a3b8' },
  10: { name: 'Car / Vehicle', color: '#38bdf8' },
  11: { name: 'Bicycle', color: '#f43f5e' },
  15: { name: 'Motorcycle', color: '#f97316' },
  18: { name: 'Truck', color: '#0284c7' },
  20: { name: 'Other Vehicle', color: '#0ea5e9' },
  30: { name: 'Person', color: '#e11d48' },
  40: { name: 'Road / Drivable', color: '#64748b' },
  44: { name: 'Parking', color: '#94a3b8' },
  48: { name: 'Sidewalk', color: '#cbd5e1' },
  49: { name: 'Other Ground', color: '#94a3b8' },
  50: { name: 'Building / Wall', color: '#e2e8f0' },
  51: { name: 'Fence / Barrier', color: '#a855f7' },
  70: { name: 'Vegetation', color: '#22c55e' },
  71: { name: 'Trunk / Tree', color: '#15803d' },
  72: { name: 'Terrain / Grass', color: '#16a34a' },
  80: { name: 'Pole / Bollard', color: '#eab308' },
  81: { name: 'Traffic Sign', color: '#f59e0b' },
  252: { name: 'Moving Object (MOS)', color: '#ef4444' },
};

const RING_CONFIGS = [
  { id: 0, name: 'Ring 0: Fovea', range: '0–10m', res: '5cm', color: '#06b6d4', ringRes: 0.05 },
  { id: 1, name: 'Ring 1: Tactical', range: '10–25m', res: '10cm', color: '#10b981', ringRes: 0.10 },
  { id: 2, name: 'Ring 2: Planning', range: '25–50m', res: '25cm', color: '#f59e0b', ringRes: 0.25 },
  { id: 3, name: 'Ring 3: Horizon', range: '50–100m', res: '50cm', color: '#8b5cf6', ringRes: 0.50 },
];

export const DataInspectionScreen: React.FC<DataInspectionScreenProps> = ({
  activeScene,
  telemetryData,
  onBackToHook,
}) => {
  const [cells, setCells] = useState<GridCellData[]>([]);
  const [totalActive, setTotalActive] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCell, setSelectedCell] = useState<GridCellData | null>(null);
  const [colorBy, setColorBy] = useState<'ring' | 'semantics' | 'elevation' | 'variance' | 'overhang'>('semantics');
  const [filterRing, setFilterRing] = useState<number | 'all'>('all');

  // Canvas Viewport Pan & Zoom
  const [zoom, setZoom] = useState<number>(6); // pixels per meter
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fetch real cells from /api/grid_cells
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetch('/api/grid_cells?limit=4000')
      .then((res) => {
        if (!res.ok) throw new Error('API offline');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setCells(data.cells || []);
          setTotalActive(data.total_active || 0);
          setIsLoading(false);
          if (data.cells && data.cells.length > 0) {
            setSelectedCell(data.cells[0]);
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          // Synthetic fallback if server offline
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeScene]);

  const ringCounts = useMemo(() => {
    const counts = [0, 0, 0, 0];
    for (const c of cells) if (c.ring_id >= 0 && c.ring_id < counts.length) counts[c.ring_id]++;
    return counts;
  }, [cells]);

  // Filtered cells based on ring selection
  const displayedCells = useMemo(() => {
    if (filterRing === 'all') return cells;
    return cells.filter((c) => c.ring_id === filterRing);
  }, [cells, filterRing]);

  // Draw 2.5D Top-Down Lattice Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const originX = width / 2 + pan.x;
    const originY = height / 2 + pan.y;

    // Background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Draw Metric Grid lines (every 10 meters)
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#1e293b';
    const gridStepM = 10;
    const gridStepPx = gridStepM * zoom;
    const startX = (originX % gridStepPx) - gridStepPx;
    const startY = (originY % gridStepPx) - gridStepPx;

    ctx.beginPath();
    for (let x = startX; x < width + gridStepPx; x += gridStepPx) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = startY; y < height + gridStepPx; y += gridStepPx) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Draw Fovea Concentric Boundary Rings (10m, 25m, 50m, 100m)
    const ringRadii = [10, 25, 50, 100];
    const ringColors = ['#06b6d4', '#10b981', '#f59e0b', '#8b5cf6'];

    ringRadii.forEach((r, idx) => {
      ctx.beginPath();
      ctx.arc(originX, originY, r * zoom, 0, Math.PI * 2);
      ctx.strokeStyle = ringColors[idx];
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ring Distance Label
      ctx.fillStyle = ringColors[idx];
      ctx.font = '10px monospace';
      ctx.fillText(`${r}m`, originX + r * zoom + 4, originY - 4);
    });

    // Draw Active 2.5D Cells
    displayedCells.forEach((cell) => {
      // Coordinate transform: X forward (up on 2D map), Y left (left on 2D map)
      const cx = originX - cell.y_m * zoom;
      const cy = originY - cell.x_m * zoom;
      const cellPx = Math.max(2, cell.res_m * zoom);

      // Determine Cell Color
      let fill = '#38bdf8';
      if (colorBy === 'ring') {
        fill = RING_CONFIGS[cell.ring_id]?.color || '#38bdf8';
      } else if (colorBy === 'semantics') {
        fill = SEMANTIC_CLASS_NAMES[cell.sem_id]?.color || '#94a3b8';
      } else if (colorBy === 'elevation') {
        const normZ = Math.min(1, Math.max(0, (cell.mean_z + 2.0) / 4.0));
        fill = `hsl(${Math.round(240 - normZ * 240)}, 85%, 55%)`;
      } else if (colorBy === 'variance') {
        const normV = Math.min(1, Math.max(0, cell.variance / 0.05));
        fill = `hsl(${Math.round(120 - normV * 120)}, 90%, 50%)`;
      } else if (colorBy === 'overhang') {
        fill = cell.overhang_z != null ? '#ec4899' : '#059669';
      }

      ctx.fillStyle = fill;
      ctx.fillRect(cx - cellPx / 2, cy - cellPx / 2, cellPx, cellPx);

      // Highlight selected or hovered cell
      if (selectedCell && selectedCell.ix === cell.ix && selectedCell.iy === cell.iy && selectedCell.ring_id === cell.ring_id) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - cellPx / 2 - 2, cy - cellPx / 2 - 2, cellPx + 4, cellPx + 4);
      }
    });

    // Draw UGV Ego Marker at Origin
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(originX, originY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Ego Heading Pointer
    ctx.beginPath();
    ctx.moveTo(originX, originY - 4);
    ctx.lineTo(originX, originY - 14);
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [displayedCells, pan, zoom, colorBy, selectedCell]);

  // Handle Canvas Click to Select Cell
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const originX = canvas.width / 2 + pan.x;
    const originY = canvas.height / 2 + pan.y;

    const clickedYm = -(clickX - originX) / zoom;
    const clickedXm = -(clickY - originY) / zoom;

    // Find closest cell
    let closest: GridCellData | null = null;
    let minDist = 2.0; // within 2 meters tolerance

    displayedCells.forEach((c) => {
      const dist = Math.hypot(c.x_m - clickedXm, c.y_m - clickedYm);
      if (dist < minDist) {
        minDist = dist;
        closest = c;
      }
    });

    if (closest) {
      setSelectedCell(closest);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* 1. Header Toolbar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 px-4 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToHook}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
          >
            <ArrowLeft size={14} />
            <span>3D Cinematic View</span>
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white tracking-tight">LiMap Map Inspector</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              CELL INSPECTOR
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono text-cyan-400 border border-cyan-800 bg-cyan-950/40">
              {totalActive ? `${totalActive.toLocaleString()} Cells Loaded` : 'Real 2.5D Lattice'}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 border border-slate-700">
              {activeScene === 'real_seq08_f00' ? 'REAL: SemanticKITTI Seq 08' : 'STAGED SCENARIO'}
            </span>
          </div>
        </div>

        {/* View Shading Controls */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <Filter size={12} />
            <span>Colorize:</span>
          </span>
          {[
            { id: 'semantics', label: 'Semantic Class' },
            { id: 'ring', label: 'Resolution Tier' },
            { id: 'elevation', label: 'Elevation (Z)' },
            { id: 'variance', label: 'Welford Variance' },
            { id: 'overhang', label: 'Dual Elevation' },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setColorBy(mode.id as any)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold transition-all ${
                colorBy === mode.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </header>

      {/* 2. Main Content Split View (Canvas + Side Inspection Panel) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas Center Stage */}
        <div className="flex-1 relative flex items-center justify-center bg-slate-950 overflow-hidden">
          <canvas
            ref={canvasRef}
            width={1200}
            height={800}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="w-full h-full cursor-crosshair"
          />

          {/* Canvas Floating Overlay Controls */}
          <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 backdrop-blur-md flex flex-col gap-1.5 shadow-lg text-xs font-mono">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Crosshair size={12} className="text-cyan-400" />
                <span>Ring Resolution Filter</span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setFilterRing('all')}
                  className={`px-2 py-0.5 rounded text-[10px] ${
                    filterRing === 'all' ? 'bg-cyan-600 text-white font-bold' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  All (100m)
                </button>
                {RING_CONFIGS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setFilterRing(r.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      filterRing === r.id ? 'bg-cyan-600 text-white font-bold' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    R{r.id} ({r.res})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Zoom / Reset Controls */}
          <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-1 z-20 shadow-md">
            <button
              onClick={() => setZoom((z) => Math.min(25, z * 1.25))}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-300"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(1, z / 1.25))}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-300"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={() => {
                setPan({ x: 0, y: 0 });
                setZoom(6);
              }}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-300"
              title="Reset View"
            >
              <RotateCcw size={14} />
            </button>
            <span className="text-[10px] font-mono text-slate-400 px-2">{zoom.toFixed(1)}x</span>
          </div>

          {/* Empty state: no cells came back (API offline or grid empty). Never draw a fake map. */}
          {!isLoading && cells.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <div className="max-w-sm text-center text-xs font-mono text-slate-400 bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                No grid cells available for this scene. Start the API with scene data loaded to inspect real cells.
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-30">
              <div className="flex items-center gap-2.5 text-xs font-mono text-cyan-400">
                <Activity size={16} className="animate-spin" />
                <span>Streaming 32-Byte Structured Cells from Backend...</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Cell Inspector & Verification Proof Sidebar */}
        <aside className="w-96 border-l border-slate-800 bg-slate-900/95 overflow-y-auto flex flex-col divide-y divide-slate-800 text-xs z-20 shrink-0">
          {/* Section 1: Selected Cell Verifiable Inspector */}
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Database size={13} className="text-cyan-400" />
                <span>Cell Inspection Matrix</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {selectedCell ? `ix: ${selectedCell.ix}, iy: ${selectedCell.iy}` : 'Select a cell'}
              </span>
            </div>

            {selectedCell ? (
              <div className="flex flex-col gap-2 bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                {/* Metric Coordinates */}
                <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                  <span className="text-slate-400">World Coordinate (X, Y):</span>
                  <span className="font-mono font-bold text-cyan-300">
                    ({selectedCell.x_m}m, {selectedCell.y_m}m)
                  </span>
                </div>

                {/* Resolution Tier */}
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Resolution Ring:</span>
                  <span className="font-mono font-bold text-slate-200">
                    Ring {selectedCell.ring_id} ({selectedCell.res_m * 100}cm cell)
                  </span>
                </div>

                {/* Semantic Class */}
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Dominant Semantic Class:</span>
                  <span
                    className="font-bold px-2 py-0.5 rounded text-[10px]"
                    style={{
                      backgroundColor: `${SEMANTIC_CLASS_NAMES[selectedCell.sem_id]?.color || '#94a3b8'}25`,
                      color: SEMANTIC_CLASS_NAMES[selectedCell.sem_id]?.color || '#94a3b8',
                      border: `1px solid ${SEMANTIC_CLASS_NAMES[selectedCell.sem_id]?.color || '#94a3b8'}40`,
                    }}
                  >
                    {SEMANTIC_CLASS_NAMES[selectedCell.sem_id]?.name || `Class ${selectedCell.sem_id}`}
                  </span>
                </div>

                {/* Point Count */}
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">LiDAR Return Count:</span>
                  <span className="font-mono font-bold text-slate-200">{selectedCell.count} points</span>
                </div>

                {/* Running Mean Elevation */}
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Welford Mean Z:</span>
                  <span className="font-mono font-bold text-emerald-400">{selectedCell.mean_z} m</span>
                </div>

                {/* Variance */}
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Welford Variance (M2):</span>
                  <span className="font-mono font-bold text-amber-400">{selectedCell.variance} m²</span>
                </div>

                {/* Min / Max Range */}
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Z Elevation Span:</span>
                  <span className="font-mono text-slate-300">
                    [{selectedCell.min_z}m &rarr; {selectedCell.max_z}m]
                  </span>
                </div>

                {/* Dual-Elevation Clearance */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400">Overhang Clearance:</span>
                  <span className="font-mono font-bold text-rose-400">
                    {selectedCell.clearance != null ? `${selectedCell.clearance}m Clearance` : 'Open Sky (None)'}
                  </span>
                </div>

                <div className="mt-1 p-2 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400">
                  <strong>Memory Footprint:</strong> Exactly 32 bytes flat cache-line aligned struct in preallocated pool.
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500 font-mono">
                Click any cell on the 2.5D map to inspect its real LiDAR points and Welford statistics.
              </div>
            )}
          </div>

          {/* Section 2: Statistics derived from the loaded scene (no retyped literals) */}
          <div className="p-4 flex flex-col gap-3">
            <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Cpu size={13} className="text-emerald-400" />
              <span>Scene statistics</span>
            </span>

            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 flex flex-col gap-1.5 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Occupied cells:</span>
                <span className="text-slate-200">
                  {telemetryData
                    ? `${telemetryData.telemetry.active_cells.toLocaleString()} of ${telemetryData.telemetry.capacity.toLocaleString()}`
                    : totalActive
                      ? totalActive.toLocaleString()
                      : 'n/a'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pool size (fixed by design):</span>
                <span className="text-slate-200">
                  {(telemetryData?.telemetry.total_heap_mb ?? POOL_MB).toFixed(4)} MB
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cells shown:</span>
                <span className="text-slate-200">{cells.length.toLocaleString()}</span>
              </div>
            </div>

            {cells.length > 0 && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 flex flex-col gap-1.5 text-[11px] font-mono">
                <span className="font-bold text-slate-300">Cells per resolution ring</span>
                {RING_CONFIGS.map((r) => (
                  <div key={r.id} className="flex justify-between text-slate-400">
                    <span>
                      R{r.id} ({r.res}, {r.range})
                    </span>
                    <span className="text-slate-200">{ringCounts[r.id].toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[10px] font-mono text-slate-500 leading-relaxed">
              Benchmark results (accuracy, latency, fidelity by distance, regret) are produced offline from
              <span className="text-slate-300"> benchmark/*.json</span> and are not shown on this screen.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
