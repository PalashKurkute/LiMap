import React from 'react';
import type { BaselineMetrics, TelemetryData } from '../types/telemetry';
import { Check, Cpu } from 'lucide-react';
import { POOL_CAPACITY_CELLS, POOL_MB } from '../lib/constants';

interface MemoryMeterProps {
  baselines: BaselineMetrics | null;
  telemetry: TelemetryData | null;
}

/** Log-scale bar width (%) so a 3 MB pool is visible next to a 3 GB baseline. */
function logWidth(value: number, ours: number, largest: number): number {
  const lo = Math.log10(ours / 4);
  const hi = Math.log10(largest);
  return Math.max(2, Math.min(100, ((Math.log10(value) - lo) / (hi - lo)) * 100));
}

const mb = (v: number | undefined, digits = 1) => (v != null ? `${v.toFixed(digits)} MB` : 'n/a');

export const MemoryMeter: React.FC<MemoryMeterProps> = ({ baselines, telemetry }) => {
  const heapMb = telemetry?.total_heap_mb ?? POOL_MB;
  const dense = baselines?.dense_3d_voxel_mb;
  const uniform = baselines?.uniform_25d_mb;
  const ours = baselines?.foveagrid_25d_mb ?? heapMb;
  const largest = dense ?? uniform ?? ours;

  return (
    <div className="flex flex-col gap-3 text-slate-900">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-xs font-bold tracking-tight uppercase">Memory capacity comparison</span>
          <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
            {baselines ? `${baselines.reduction_vs_3d} vs dense 3D` : 'no baseline data'}
          </span>
        </div>

        <div className="text-[10px] font-mono text-slate-500">
          CALCULATED capacities for a 100 m box (not measured allocations). Bars use a log scale.
        </div>

        {[
          { label: '1. Dense 3D voxel grid (3 cm)', value: dense, tone: 'bg-slate-800' },
          { label: '2. Uniform 2.5D elevation (5 cm)', value: uniform, tone: 'bg-slate-500' },
          { label: '3. FoveaGrid pool (ours)', value: ours, tone: 'bg-slate-950', bold: true },
        ].map((row) => (
          <div key={row.label} className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-xs">
              <span className={row.bold ? 'font-bold text-slate-900' : 'text-slate-500 font-medium'}>{row.label}</span>
              <span className="font-mono font-semibold text-slate-900">{mb(row.value, row.value && row.value < 10 ? 4 : 1)}</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              {row.value != null && (
                <div className={`h-full ${row.tone} rounded-full`} style={{ width: `${logWidth(row.value, ours, largest)}%` }} />
              )}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-[11px] font-mono text-slate-700">
          <Check size={14} className="text-slate-900 shrink-0" />
          <div>
            <span className="font-bold text-slate-900">Fixed pool. </span>
            <span className="text-slate-500">
              {POOL_CAPACITY_CELLS.toLocaleString()} cells are preallocated; the heap does not grow with input.
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-2.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Cpu size={14} className="text-slate-700" />
            <span className="text-xs font-bold tracking-tight uppercase">2.5D nested lattice pool</span>
          </div>
          <span className="text-[10px] font-mono font-semibold text-slate-500">Total: {heapMb.toFixed(4)} MB</span>
        </div>

        <div className="flex flex-col divide-y divide-slate-100 text-xs">
          {baselines?.per_ring_breakdown?.length ? (
            baselines.per_ring_breakdown.map((ring) => (
              <div key={ring.ring_id} className="py-1.5 flex justify-between items-center">
                <span className="text-slate-600">
                  Ring {ring.ring_id}: {ring.name} ({(ring.resolution_m * 100).toFixed(0)} cm cells)
                </span>
                <span className="font-mono font-semibold text-slate-900">
                  {ring.allocated_mb.toFixed(2)} MB ({(ring.allocated_cells / 1000).toFixed(0)}k cells)
                </span>
              </div>
            ))
          ) : (
            <div className="py-2 text-slate-500">Per-ring breakdown unavailable (no baseline data loaded).</div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-xs font-bold tracking-tight uppercase">Current scene occupancy</span>
        </div>

        <div className="flex flex-col gap-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Occupied cells:</span>
            <span className="font-mono font-semibold text-slate-900">
              {telemetry ? `${telemetry.active_cells.toLocaleString()} of ${telemetry.capacity.toLocaleString()}` : 'n/a'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Load factor:</span>
            <span className="font-mono font-semibold text-slate-900">
              {telemetry ? `${(telemetry.load_factor * 100).toFixed(1)}%` : 'n/a'}
            </span>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-normal">
          The pool size is fixed by design ({POOL_CAPACITY_CELLS.toLocaleString()} cells x 32 B). Capacity is not the same
          as occupancy: a scene only fills the cells its points land in.
        </div>
      </div>
    </div>
  );
};
