import React, { useState } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  Layers,
  Database,
  ShieldCheck,
  Eye,
  Sparkles,
} from 'lucide-react';

interface MatrixWalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectColorMode?: (mode: 'ring' | 'semantics' | 'elevation' | 'variance' | 'overhang') => void;
  onSelectRing?: (ring: number | 'all') => void;
}

export const MatrixWalkthroughModal: React.FC<MatrixWalkthroughModalProps> = ({
  isOpen,
  onClose,
  onSelectColorMode,
  onSelectRing,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const slides = [
    {
      title: '1. Concentric Foveation Architecture (0–100m)',
      subtitle: 'Why 4 Variable-Resolution Ring Tiers?',
      icon: <Layers size={18} className="text-cyan-600" />,
      content: (
        <div className="flex flex-col gap-3.5 text-slate-700 text-xs leading-relaxed">
          <p>
            Unlike traditional LiDAR grids that waste gigabytes of memory with uniform 3cm voxels everywhere,
            <strong> LiMap 2.5D concentrates compute where the autonomous UGV needs it most</strong>:
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 bg-cyan-50/70 border border-cyan-200 rounded-xl flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <strong className="text-cyan-900 font-bold">Ring 0: Fovea Core</strong>
                <span className="text-[10px] font-mono font-bold bg-cyan-200/70 text-cyan-800 px-1.5 py-0.5 rounded">
                  0–10m • 5cm Cell
                </span>
              </div>
              <p className="text-[11px] text-cyan-800">
                Ultra-high precision immediately around the wheels for pothole dips, curb edges, and ground clearance.
              </p>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <strong className="text-emerald-900 font-bold">Ring 1: Tactical Buffer</strong>
                <span className="text-[10px] font-mono font-bold bg-emerald-200/70 text-emerald-800 px-1.5 py-0.5 rounded">
                  10–25m • 10cm Cell
                </span>
              </div>
              <p className="text-[11px] text-emerald-800">
                Near collision-avoidance zone for sudden obstacles, pedestrians, and tight maneuvers.
              </p>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <strong className="text-amber-900 font-bold">Ring 2: Planning Window</strong>
                <span className="text-[10px] font-mono font-bold bg-amber-200/70 text-amber-800 px-1.5 py-0.5 rounded">
                  25–50m • 25cm Cell
                </span>
              </div>
              <p className="text-[11px] text-amber-800">
                Medium-range path planning, speed adjustment, and lane corridor selection.
              </p>
            </div>

            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <strong className="text-purple-900 font-bold">Ring 3: Horizon Horizon</strong>
                <span className="text-[10px] font-mono font-bold bg-purple-200/70 text-purple-800 px-1.5 py-0.5 rounded">
                  50–100m • 50cm Cell
                </span>
              </div>
              <p className="text-[11px] text-purple-800">
                Long-range situational awareness for distant terrain incline and horizon road layout.
              </p>
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-[11px]">
            <span className="text-slate-600 font-medium">Try filtering an individual ring tier on the canvas:</span>
            <div className="flex gap-1 font-mono">
              {[0, 1, 2, 3].map((r) => (
                <button
                  key={r}
                  onClick={() => onSelectRing?.(r)}
                  className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-bold shadow-2xs"
                >
                  R{r}
                </button>
              ))}
              <button
                onClick={() => onSelectRing?.('all')}
                className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold"
              >
                All
              </button>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '2. Live Cell Inspection Matrix (O(1) Memory)',
      subtitle: 'Click Any Cell to Audit its Real Math & 32-Byte Struct',
      icon: <Database size={18} className="text-blue-600" />,
      content: (
        <div className="flex flex-col gap-3.5 text-slate-700 text-xs leading-relaxed">
          <p>
            Every single cell displayed on the 2.5D map corresponds to a real, cache-aligned spatial bin.
            Clicking any cell opens the <strong>Cell Inspection Matrix</strong> on the right:
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col gap-2 font-mono text-[11px]">
            <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
              <span className="text-slate-500">Metric Coordinate:</span>
              <span className="font-bold text-slate-900">(X: +14.2m, Y: -3.8m)</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-500">Welford Running Mean (Z):</span>
              <span className="font-bold text-emerald-600">-1.71m (Ground Plane)</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-500">Bayesian Variance (M2):</span>
              <span className="font-bold text-amber-600">0.0012 m² (Smooth Road)</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-500">Overhang Clearance:</span>
              <span className="font-bold text-rose-600">2.65m Underpass Clearance</span>
            </div>
            <div className="flex justify-between items-center pt-1.5 border-t border-slate-200">
              <span className="text-slate-500">Memory Per Cell:</span>
              <span className="font-bold text-slate-900">Exactly 32 Bytes (Cache-Aligned)</span>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2 text-[11px] text-blue-900">
            <Sparkles size={15} className="text-blue-600 shrink-0 mt-0.5" />
            <p>
              <strong>Zero Raw Point Clouds Stored:</strong> By using <em>Welford's online variance algorithm</em>,
              we update the mean, variance, min, max, and overhang elevation in single-pass O(1) arithmetic without ever storing points in RAM!
            </p>
          </div>
        </div>
      ),
    },
    {
      title: '3. The 5 Diagnostic Shading Lenses',
      subtitle: 'Switch Visual Modalities to Verify Different Perception Layers',
      icon: <Eye size={18} className="text-emerald-600" />,
      content: (
        <div className="flex flex-col gap-3 text-slate-700 text-xs leading-relaxed">
          <p>
            Use the <strong>Colorize</strong> buttons in the top toolbar to switch diagnostic lenses across the map:
          </p>

          <div className="flex flex-col gap-2">
            {[
              {
                id: 'semantics',
                name: 'Semantic Class',
                badge: 'Deep Learning',
                desc: 'Colors cells by neural segmentation: Drivable road (blue), vehicles (cyan), pedestrians (red), vegetation (green), buildings (slate).',
              },
              {
                id: 'ring',
                name: 'Resolution Tier',
                badge: 'Fovea Rings',
                desc: 'Colors cells by their ring resolution (5cm cyan, 10cm green, 25cm amber, 50cm purple).',
              },
              {
                id: 'elevation',
                name: 'Elevation (Z)',
                badge: 'Heightfield',
                desc: 'Spectral color ramp from -2.0m (deep blue dips/potholes) to +3.5m (bright red overhead structures).',
              },
              {
                id: 'variance',
                name: 'Welford Variance',
                badge: 'Roughness',
                desc: 'Highlights road roughness and curb edges. Calm green = smooth asphalt; bright red = sharp drop or pothole.',
              },
              {
                id: 'overhang',
                name: 'Dual Elevation',
                badge: 'Bridge Clear',
                desc: 'Instantly identifies overhead bridges and tunnel roofs (pink) vs safe ground clearance (emerald).',
              },
            ].map((m) => (
              <div
                key={m.id}
                onClick={() => onSelectColorMode?.(m.id as any)}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <strong className="text-slate-900 font-bold">{m.name}</strong>
                    <span className="text-[9px] font-mono font-bold bg-white text-slate-600 border border-slate-200 px-1 rounded">
                      {m.badge}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">{m.desc}</span>
                </div>
                <button className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 shrink-0 ml-2">
                  Apply &rarr;
                </button>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: '4. Audited DRDO Proofs & Invariants',
      subtitle: 'Mathematically Proved System Guarantees',
      icon: <ShieldCheck size={18} className="text-emerald-600" />,
      content: (
        <div className="flex flex-col gap-3.5 text-slate-700 text-xs leading-relaxed">
          <p>
            The lower half of the right sidebar displays the audited technical invariants required by the
            <strong> DRDO SIH26053 defense specification</strong>:
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col gap-1">
              <strong className="text-emerald-900 font-bold flex items-center gap-1.5">
                <Check size={13} className="text-emerald-600" />
                <span>Deterministic RAM Bound</span>
              </strong>
              <div className="text-lg font-bold font-mono text-emerald-700">3.2616 MB</div>
              <p className="text-[11px] text-emerald-800">
                Preallocated array of 106,875 cells &times; 32B. Fully bounded below the 3.50 MB DRDO requirement.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-1">
              <strong className="text-slate-900 font-bold flex items-center gap-1.5">
                <Check size={13} className="text-blue-600" />
                <span>Zero Seam Gaps (0.00%)</span>
              </strong>
              <div className="text-lg font-bold font-mono text-slate-800">Integer-Scale</div>
              <p className="text-[11px] text-slate-600">
                Enforces integer lattice scale factors (1x, 2x, 5x, 10x) ensuring mathematically zero cracks at boundaries.
              </p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-[11px]">
            <span className="text-slate-600">
              <strong>Interactive Controls:</strong> Pan with click-drag, zoom with mouse-wheel or bottom controls, and click any cell to pin its telemetry.
            </span>
          </div>
        </div>
      ),
    },
  ];

  const slide = slides[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs select-none">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
              {slide.icon}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">{slide.title}</h2>
              <p className="text-[11px] text-slate-500 font-medium">{slide.subtitle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors"
            title="Close Walkthrough [Esc]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Slide Body */}
        <div className="p-5 overflow-y-auto max-h-[65vh]">
          {slide.content}
        </div>

        {/* Footer Navigation */}
        <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-between bg-slate-50/70">
          {/* Step Dots */}
          <div className="flex items-center gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-2 rounded-full transition-all ${
                  currentStep === idx ? 'w-6 bg-slate-900' : 'w-2 bg-slate-300 hover:bg-slate-400'
                }`}
                title={`Step ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep((s) => s - 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-200/60 transition-colors flex items-center gap-1"
              >
                <ChevronLeft size={14} />
                <span>Back</span>
              </button>
            )}

            {currentStep < slides.length - 1 ? (
              <button
                onClick={() => setCurrentStep((s) => s + 1)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 active:scale-95"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Check size={14} />
                <span>Start Exploring Matrix</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default MatrixWalkthroughModal;
