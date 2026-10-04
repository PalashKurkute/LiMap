import React, { useEffect, useRef, useState } from 'react';
import { X, ChevronRight, ChevronLeft, ArrowRight, HelpCircle, Navigation, Layers, Award } from 'lucide-react';
import type { SceneId, StressModeId } from '../types/telemetry';
import { POOL_CAPACITY_CELLS, POOL_MB } from '../lib/constants';

interface JudgeOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScene: (scene: SceneId) => void;
  onSelectStressMode: (mode: StressModeId) => void;
  onOpenInspection?: () => void;
}

const SCENARIOS: { id: SceneId; title: string; kind: 'SYNTHETIC' | 'REAL'; blurb: string }[] = [
  {
    id: 'scene_a_bridge',
    title: '1. Overhead bridge',
    kind: 'SYNTHETIC',
    blurb: 'A flat 2D grid sees a bridge as a wall. Dual elevation stores the road and the deck above it, so clearance can be read.',
  },
  {
    id: 'scene_b_potholes',
    title: '2. Potholes & ditches',
    kind: 'SYNTHETIC',
    blurb: 'Negative obstacles show up as depressions with raised per-cell variance.',
  },
  {
    id: 'scene_c_moving',
    title: '3. Passing traffic',
    kind: 'SYNTHETIC',
    blurb: 'A moving vehicle is tracked so it does not leave a smear of occupied cells behind it.',
  },
  {
    id: 'scene_d_poles',
    title: '4. Thin posts',
    kind: 'SYNTHETIC',
    blurb: 'Fine cells near the vehicle resolve thin poles that a coarse grid would blur away.',
  },
  {
    id: 'real_seq08_f00',
    title: '5. Real city driving',
    kind: 'REAL',
    blurb: 'A recorded SemanticKITTI scan (sequence 08). Colours come from the dataset labels, not from a model.',
  },
];

export const JudgeOnboardingModal: React.FC<JudgeOnboardingModalProps> = ({
  isOpen,
  onClose,
  onSelectScene,
  onOpenInspection,
}) => {
  const [step, setStep] = useState(0);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) primaryRef.current?.focus();
  }, [isOpen, step]);

  if (!isOpen) return null;

  const steps = [
    {
      title: 'Why 2.5D?',
      icon: <HelpCircle size={20} className="text-fg" />,
      body: (
        <div className="flex flex-col gap-3.5 text-fg leading-relaxed">
          <p className="text-sm text-fg-2 font-medium">
            A ground vehicle needs to know both what it can drive on and what hangs above it. The two common maps each give something up:
          </p>
          <div className="grid grid-cols-3 gap-3.5">
            <div className="bg-panel p-3.5 rounded-xl border border-line shadow-sm">
              <div className="font-bold text-sm text-fg mb-1">Flat 2D grid</div>
              <div className="h-20 bg-subtle rounded-lg border border-line mb-2 p-1.5">
                <svg viewBox="0 0 100 50" className="w-full h-full" aria-hidden="true">
                  <line x1="6" y1="42" x2="94" y2="42" className="stroke-viz-grid" strokeWidth="2.5" />
                  <rect x="46" y="10" width="38" height="7" className="fill-viz-baseline" rx="1.5" />
                  <rect x="46" y="10" width="38" height="32" className="fill-critical stroke-critical" fillOpacity="0.55" strokeWidth="1.2" strokeDasharray="3,2" />
                  <rect x="14" y="32" width="18" height="9" className="fill-scene-prop" rx="1.5" />
                </svg>
              </div>
              <p className="text-xs text-fg-2">Collapses a bridge into a solid wall, so the vehicle may stop for nothing.</p>
            </div>
            <div className="bg-panel p-3.5 rounded-xl border border-line shadow-sm">
              <div className="font-bold text-sm text-fg mb-1">Dense 3D voxels</div>
              <div className="h-20 bg-subtle rounded-lg border border-line mb-2 p-1.5">
                <svg viewBox="0 0 100 50" className="w-full h-full" aria-hidden="true">
                  <g className="fill-subtle stroke-viz-baseline" strokeWidth="0.8">
                    {[18, 30, 42].flatMap((x) => [8, 20, 32].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="12" height="12" />))}
                  </g>
                </svg>
              </div>
              <p className="text-xs text-fg-2">Stores empty air too. Memory scales with volume (gigabytes at 3 cm over 100 m).</p>
            </div>
            <div className="bg-panel p-3.5 rounded-xl border-2 border-line-strong shadow-sm">
              <div className="font-bold text-sm text-fg mb-1">LiMap 2.5D</div>
              <div className="h-20 bg-subtle rounded-lg border border-line mb-2 p-1.5">
                <svg viewBox="0 0 100 50" className="w-full h-full" aria-hidden="true">
                  <line x1="6" y1="42" x2="94" y2="42" className="stroke-viz-baseline" strokeWidth="2.5" />
                  <rect x="44" y="10" width="40" height="7" className="fill-scene-prop" rx="1.5" />
                  <line x1="64" y1="17" x2="64" y2="42" className="stroke-accent" strokeWidth="2" />
                  <rect x="52" y="32" width="18" height="9" className="fill-scene-prop" rx="1.5" />
                </svg>
              </div>
              <p className="text-xs text-fg-2">Keeps ground and ceiling per cell, in a pool preallocated at {POOL_MB.toFixed(4)} MB.</p>
            </div>
          </div>
          <div className="p-3 bg-subtle rounded-xl border border-line text-xs text-fg leading-normal">
            The pool holds {POOL_CAPACITY_CELLS.toLocaleString()} cells of 32 bytes, so memory does not grow with the amount of input.
            Capacity comparisons in this dashboard are calculated; measured figures are labelled as measured.
          </div>
        </div>
      ),
    },
    {
      title: 'How to navigate',
      icon: <Navigation size={20} className="text-fg" />,
      body: (
        <div className="flex flex-col gap-3.5 text-fg leading-relaxed">
          <p className="text-sm text-fg-2 font-medium">Mouse and keyboard controls for the 3D view and the replay bar:</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-panel rounded-xl border border-line shadow-sm flex flex-col gap-2">
              <span className="font-bold text-sm text-fg">Camera</span>
              <ul className="text-xs text-fg-2 flex flex-col gap-1.5">
                <li><b>Left-drag</b> orbit &middot; <b>Right-drag</b> pan &middot; <b>Wheel</b> zoom</li>
                <li>Switch Orbit / Follow / Top in the scene card.</li>
              </ul>
            </div>
            <div className="p-4 bg-panel rounded-xl border border-line shadow-sm flex flex-col gap-2">
              <span className="font-bold text-sm text-fg">Replay &amp; keys</span>
              <ul className="text-xs text-fg-2 flex flex-col gap-1.5">
                <li><kbd className="font-mono">Space</kbd> play / pause &middot; <kbd className="font-mono">&larr; &rarr;</kbd> step</li>
                <li><kbd className="font-mono">1</kbd>&ndash;<kbd className="font-mono">5</kbd> scenes &middot; <kbd className="font-mono">T</kbd> side panel &middot; <kbd className="font-mono">Esc</kbd> close</li>
              </ul>
              <p className="text-[11px] text-fg-muted">
                The moving vehicle is an illustrative drive along a planned path, not recorded sensor time.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Pick a scenario',
      icon: <Layers size={20} className="text-fg" />,
      body: (
        <div className="flex flex-col gap-3 text-fg leading-relaxed">
          <p className="text-sm text-fg-2 font-medium">
            Four scenes are synthetic test cases built to stress one capability each. One is a real recorded scan.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  onSelectScene(s.id);
                  onClose();
                }}
                className="group text-left p-3 bg-panel hover:bg-subtle border border-line hover:border-line-strong rounded-xl transition-all shadow-sm flex flex-col gap-1.5 apple-press"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-bold text-sm text-fg">{s.title}</span>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                      s.kind === 'REAL'
                        ? 'text-good-fg bg-good-bg border-good-line'
                        : 'text-warn-fg bg-warn-bg border-warn-line'
                    }`}
                  >
                    {s.kind}
                  </span>
                </div>
                <p className="text-xs text-fg-2 leading-normal">{s.blurb}</p>
                <span className="text-xs font-bold text-fg flex items-center gap-1 pt-1">
                  Launch <ArrowRight size={12} className="text-fg-muted group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'Where the proof is',
      icon: <Award size={20} className="text-fg" />,
      body: (
        <div className="flex flex-col gap-3.5 text-fg leading-relaxed">
          <p className="text-sm text-fg-2 font-medium">
            The 3D view is a quick visual. Claims are checked in the other places:
          </p>
          <ul className="flex flex-col gap-2.5 text-xs text-fg-2">
            <li className="p-3 bg-panel rounded-xl border border-line shadow-sm">
              <b className="text-fg">Map Inspector</b> shows the actual grid cells the pipeline produced. Click one to see its
              resolution ring, class, point count, mean height, variance and overhang clearance.
            </li>
            <li className="p-3 bg-panel rounded-xl border border-line shadow-sm">
              <b className="text-fg">Side panel &rarr; Proofs</b> has the memory comparison and the interactive clearance slicer.
            </li>
            <li className="p-3 bg-panel rounded-xl border border-line shadow-sm">
              Every figure is tagged as <b>measured</b>, <b>calculated</b> or <b>estimated</b> where it appears, and anything not
              yet measured says so.
            </li>
          </ul>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const last = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-md p-4">
      <div
        data-region="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="w-full max-w-3xl bg-panel/95 border border-line/90 rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.12)] p-6 flex flex-col gap-4 text-fg apple-slide-enter"
        style={{ fontFamily: 'var(--font-ui)' }}
      >
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-subtle rounded-xl text-fg-2">{current.icon}</div>
            <h2 id="onboarding-title" className="text-lg font-bold tracking-tight text-fg">
              {current.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close guide"
            title="Close guide (Esc)"
            className="p-1.5 rounded-lg text-fg-muted hover:text-fg-2 hover:bg-subtle transition-colors apple-press"
          >
            <X size={18} />
          </button>
        </div>

        <div key={step} className="p-1 min-h-72 flex flex-col justify-center apple-slide-enter">
          {current.body}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-line">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setStep(idx)}
                  aria-label={`Go to step ${idx + 1}`}
                  aria-current={idx === step ? 'step' : undefined}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === step ? 'w-6 bg-accent' : 'w-2 bg-line hover:bg-line-strong'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-mono text-fg-muted font-medium">
              Step {step + 1} of {steps.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-line hover:bg-subtle text-fg-2 transition-all flex items-center gap-1.5 apple-press"
              >
                <ChevronLeft size={14} />
                <span>Back</span>
              </button>
            )}
            <button
              ref={primaryRef}
              onClick={() => {
                if (last) {
                  onClose();
                  onOpenInspection?.();
                } else {
                  setStep(step + 1);
                }
              }}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-accent text-accent-on hover:bg-accent/90 transition-all flex items-center gap-1.5 shadow-sm apple-press"
            >
              <span>{last ? 'Open Map Inspector' : 'Next'}</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
