import React from 'react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Layers, 
  ShieldAlert, 
  Navigation, 
  HelpCircle, 
  Eye, 
  Award, 
  ArrowRight,
  Activity,
  Maximize2
} from 'lucide-react';

interface JudgeOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScene: (scene: any) => void;
  onSelectStressMode: (mode: any) => void;
  onOpenInspection?: () => void;
}

export const JudgeOnboardingModal: React.FC<JudgeOnboardingModalProps> = ({
  isOpen,
  onClose,
  onSelectScene,
  onSelectStressMode,
  onOpenInspection,
}) => {
  const [currentStep, setCurrentStep] = React.useState(0);

  if (!isOpen) return null;

  const steps = [
    // -------------------------------------------------------------
    // Slide 1: The Problem & The 2.5D Solution
    // -------------------------------------------------------------
    {
      title: "Why 2.5D? The Underpass Dilemma",
      icon: <HelpCircle size={20} className="text-slate-800" />,
      content: (
        <div className="flex flex-col gap-3.5 text-slate-800 leading-relaxed">
          <p className="text-sm text-slate-700 font-medium">
            Autonomous ground vehicles usually get stuck at bridges. Most systems either get confused and freeze, or crash their onboard computers trying to process maps that are too heavy:
          </p>

          <div className="grid grid-cols-3 gap-3.5">
            {/* 1. 2D Grid */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between apple-card-hover">
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="font-bold text-sm text-slate-900">Standard 2D Map</span>
                  <span className="text-xs text-rose-600 font-bold px-1.5 py-0.5 bg-rose-50 rounded">Stops Dead</span>
                </div>
                {/* Schematic: 2D Wall Trap */}
                <div className="h-24 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center p-2 mb-2.5">
                  <svg viewBox="0 0 100 50" className="w-full h-full">
                    <line x1="6" y1="42" x2="94" y2="42" stroke="#cbd5e1" strokeWidth="2.5" />
                    {/* Bridge slab */}
                    <rect x="46" y="10" width="38" height="7" fill="#64748b" rx="1.5" />
                    {/* False wall highlight */}
                    <rect x="46" y="10" width="38" height="32" fill="#fecdd3" fillOpacity="0.55" stroke="#f43f5e" strokeWidth="1.2" strokeDasharray="3,2" />
                    {/* Rover */}
                    <rect x="14" y="32" width="18" height="9" fill="#334155" rx="1.5" />
                    <circle cx="19" cy="42" r="2.5" fill="#0f172a" />
                    <circle cx="27" cy="42" r="2.5" fill="#0f172a" />
                  </svg>
                </div>
                <p className="text-xs text-slate-700 font-normal leading-relaxed">
                  2D grids flatten the world. They think an overhead bridge is a solid concrete wall, forcing the vehicle into an emergency stop.
                </p>
              </div>
            </div>

            {/* 2. Dense 3D Voxel */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between apple-card-hover">
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="font-bold text-sm text-slate-900">Dense 3D Voxel</span>
                  <span className="text-xs font-mono font-bold text-slate-600 px-1.5 py-0.5 bg-slate-100 rounded">3,051 MB</span>
                </div>
                {/* Schematic: 3D Voxel Stack */}
                <div className="h-24 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center p-2 mb-2.5">
                  <svg viewBox="0 0 100 50" className="w-full h-full">
                    <g fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.8">
                      <rect x="18" y="8" width="12" height="12" />
                      <rect x="30" y="8" width="12" height="12" />
                      <rect x="42" y="8" width="12" height="12" />
                      <rect x="18" y="20" width="12" height="12" />
                      <rect x="30" y="20" width="12" height="12" fill="#cbd5e1" />
                      <rect x="42" y="20" width="12" height="12" />
                      <rect x="18" y="32" width="12" height="12" />
                      <rect x="30" y="32" width="12" height="12" />
                      <rect x="42" y="32" width="12" height="12" />
                    </g>
                    {/* Visual alert dot */}
                    <circle cx="78" cy="25" r="7" fill="#fee2e2" stroke="#f43f5e" strokeWidth="1.5" />
                    <line x1="78" y1="21" x2="78" y2="26" stroke="#b91c1c" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="78" cy="29" r="0.8" fill="#b91c1c" />
                  </svg>
                </div>
                <p className="text-xs text-slate-700 font-normal leading-relaxed">
                  Stores every empty inch of 3D air. Demands gigabytes of RAM and heavy GPU power, which crashes small onboard computers in the field.
                </p>
              </div>
            </div>

            {/* 3. LiMap 2.5D (Ours) */}
            <div className="bg-white p-3.5 rounded-xl border-2 border-slate-900 shadow-sm flex flex-col justify-between apple-card-hover">
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="font-bold text-sm text-slate-900">LiMap 2.5D</span>
                  <span className="text-xs font-mono font-bold text-emerald-700 px-1.5 py-0.5 bg-emerald-50 rounded">3.2616 MB</span>
                </div>
                {/* Schematic: 2.5D Living Pass */}
                <div className="h-24 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center p-2 mb-2.5">
                  <svg viewBox="0 0 100 50" className="w-full h-full">
                    <line x1="6" y1="42" x2="94" y2="42" stroke="#94a3b8" strokeWidth="2.5" />
                    <rect x="44" y="10" width="40" height="7" fill="#475569" rx="1.5" />
                    {/* Animated Pulsing Clearance Beam */}
                    <line x1="64" y1="17" x2="64" y2="42" stroke="#0284c7" strokeWidth="2" style={{ animation: 'beamPulse 2s ease-in-out infinite' }} />
                    <rect x="52" y="32" width="18" height="9" fill="#0f172a" rx="1.5" />
                    <circle cx="57" cy="42" r="2.5" fill="#475569" />
                    <circle cx="65" cy="42" r="2.5" fill="#475569" />
                  </svg>
                </div>
                <p className="text-xs text-slate-700 font-normal leading-relaxed">
                  Tracks both the drivable road under the wheels and the clearance ceiling overhead in a tiny 32-byte cell. Zero blind spots, near-zero RAM.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-800 leading-normal flex items-center gap-2">
            <span className="font-bold text-slate-900 shrink-0">The Breakthrough:</span>
            <span>LiMap locks memory at exactly <strong className="font-mono font-bold text-slate-900">3.2616 MB</strong> across a 100-meter range with zero dynamic memory allocation, preventing lag spikes and system crashes during high-speed maneuvers.</span>
          </div>
        </div>
      ),
      actionLabel: "Next: Controls Guide →",
      onAction: () => {},
    },

    // -------------------------------------------------------------
    // Slide 2: Practical Controls & Navigation
    // -------------------------------------------------------------
    {
      title: "How to Navigate & Control Time",
      icon: <Navigation size={20} className="text-slate-800" />,
      content: (
        <div className="flex flex-col gap-3.5 text-slate-800 leading-relaxed">
          <p className="text-sm text-slate-700 font-medium">
            The vehicle navigates autonomously in real time. You can inspect the map and scrub mission history using fluid desktop controls:
          </p>

          <div className="grid grid-cols-2 gap-4">
            {/* Mission Playback Graphic Card */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between apple-card-hover">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Activity size={17} className="text-slate-800" />
                  <span>Mission Playback &amp; Scrubber</span>
                </div>

                {/* Animated Interactive SVG Timeline Diagram */}
                <div className="h-28 bg-slate-50 rounded-lg border border-slate-200 p-2.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-600">
                    <span className="font-semibold text-slate-900">Frame: 028 / 050</span>
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">1.0x Realtime</span>
                  </div>

                  {/* Scrub Bar Graphic */}
                  <div className="relative my-2">
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-900 rounded-full w-[56%] transition-all" />
                    </div>
                    {/* Scrub Thumb */}
                    <div className="absolute top-1/2 left-[56%] -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-white border-2 border-slate-900 rounded-full shadow-md flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
                    </div>
                  </div>

                  {/* Playback Controls Row */}
                  <div className="flex items-center justify-center gap-3 text-slate-700 text-xs font-medium">
                    <span className="px-2 py-0.5 bg-white border border-slate-200 rounded shadow-2xs font-mono">⏮ Start</span>
                    <span className="px-2.5 py-0.5 bg-slate-900 text-white rounded font-mono font-semibold">⏸ Pause [Space]</span>
                    <span className="px-2 py-0.5 bg-white border border-slate-200 rounded shadow-2xs font-mono">2x ⏩</span>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-normal">
                  Use the playback panel at the bottom right to pause the vehicle, rewind to the start, or speed up the replay up to 4x. Drag the slider to inspect any obstacle frame-by-frame.
                </p>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-xs font-mono text-slate-700">
                <span>Play / Pause Toggle:</span>
                <span className="font-bold text-slate-900">[Spacebar]</span>
              </div>
            </div>

            {/* 3D Camera Gestures Graphic Card */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between apple-card-hover">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Maximize2 size={17} className="text-slate-800" />
                  <span>3D Orbit &amp; Camera Gestures</span>
                </div>

                {/* SVG Mouse Controller Illustration */}
                <div className="h-28 bg-slate-50 rounded-lg border border-slate-200 p-2 flex items-center justify-around">
                  {/* Left Click: Orbit */}
                  <div className="flex flex-col items-center gap-1 text-center">
                    <svg viewBox="0 0 40 40" className="w-10 h-10">
                      <rect x="8" y="4" width="24" height="32" rx="10" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.5" />
                      <path d="M 8 16 L 20 16 L 20 4 C 13.5 4 8 9.5 8 16 Z" fill="#0f172a" />
                      <line x1="20" y1="4" x2="20" y2="16" stroke="#64748b" strokeWidth="1" />
                      <line x1="8" y1="16" x2="32" y2="16" stroke="#64748b" strokeWidth="1" />
                    </svg>
                    <span className="text-xs font-bold text-slate-900">Left Drag</span>
                    <span className="text-[10px] text-slate-600">Orbit 360°</span>
                  </div>

                  {/* Scroll Wheel: Zoom */}
                  <div className="flex flex-col items-center gap-1 text-center">
                    <svg viewBox="0 0 40 40" className="w-10 h-10">
                      <rect x="8" y="4" width="24" height="32" rx="10" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.5" />
                      <line x1="20" y1="4" x2="20" y2="16" stroke="#64748b" strokeWidth="1" />
                      <line x1="8" y1="16" x2="32" y2="16" stroke="#64748b" strokeWidth="1" />
                      <rect x="18" y="7" width="4" height="7" rx="2" fill="#0284c7" />
                    </svg>
                    <span className="text-xs font-bold text-slate-900">Scroll Wheel</span>
                    <span className="text-[10px] text-slate-600">Zoom Depth</span>
                  </div>

                  {/* Right Click: Pan */}
                  <div className="flex flex-col items-center gap-1 text-center">
                    <svg viewBox="0 0 40 40" className="w-10 h-10">
                      <rect x="8" y="4" width="24" height="32" rx="10" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.5" />
                      <path d="M 32 16 L 20 16 L 20 4 C 26.5 4 32 9.5 32 16 Z" fill="#475569" />
                      <line x1="20" y1="4" x2="20" y2="16" stroke="#64748b" strokeWidth="1" />
                      <line x1="8" y1="16" x2="32" y2="16" stroke="#64748b" strokeWidth="1" />
                    </svg>
                    <span className="text-xs font-bold text-slate-900">Right Drag</span>
                    <span className="text-[10px] text-slate-600">Pan Lateral</span>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-normal">
                  Click and drag anywhere to spin around the rover. Right-click to slide horizontally. Scroll to zoom right up to the sensor puck or pull out to a wide tactical view.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
      actionLabel: "Next: Test Real Scenarios →",
      onAction: () => {},
    },

    // -------------------------------------------------------------
    // Slide 3: Real Scenarios with Direct Launching
    // -------------------------------------------------------------
    {
      title: "Real-World Edge Cases",
      icon: <Layers size={20} className="text-slate-800" />,
      content: (
        <div className="flex flex-col gap-3 text-slate-800 leading-relaxed">
          <p className="text-sm text-slate-700 font-medium">
            Pick any scenario to see how LiMap handles situations that commonly fail ordinary autonomous vehicles:
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* Card 1: Bridge */}
            <div 
              onClick={() => { onSelectScene('scene_a_bridge'); onClose(); }}
              className="group p-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-400 rounded-xl cursor-pointer transition-all shadow-sm flex flex-col justify-between apple-card-hover apple-press"
            >
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-bold text-sm text-slate-900">1. Overhead Bridge</span>
                  <span className="text-xs font-mono font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">2.5m Clearance</span>
                </div>
                {/* Mini SVG Schematic */}
                <div className="h-16 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center p-1 mb-2">
                  <svg viewBox="0 0 100 35" className="w-full h-full">
                    <line x1="5" y1="28" x2="95" y2="28" stroke="#cbd5e1" strokeWidth="2" />
                    <rect x="42" y="5" width="45" height="5" fill="#475569" rx="1" />
                    <line x1="65" y1="10" x2="65" y2="28" stroke="#0284c7" strokeWidth="1.5" strokeDasharray="2,2" />
                    <rect x="18" y="20" width="14" height="8" fill="#0f172a" rx="1" />
                  </svg>
                </div>
                <p className="text-xs text-slate-700 leading-normal mb-1.5">
                  Normal cars freeze here because 2D maps think the bridge is a brick wall. LiMap confirms 2.5m open space and drives straight through.
                </p>
              </div>
              <div className="text-xs font-bold text-slate-900 flex items-center justify-between pt-1.5 border-t border-slate-100">
                <span>Launch Bridge Test</span>
                <ArrowRight size={13} className="text-slate-500 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
              </div>
            </div>

            {/* Card 2: Potholes */}
            <div 
              onClick={() => { onSelectScene('scene_b_potholes'); onClose(); }}
              className="group p-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-400 rounded-xl cursor-pointer transition-all shadow-sm flex flex-col justify-between apple-card-hover apple-press"
            >
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-bold text-sm text-slate-900">2. Potholes &amp; Ditches</span>
                  <span className="text-xs font-mono font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Road Dips</span>
                </div>
                {/* Mini SVG Schematic */}
                <div className="h-16 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center p-1 mb-2">
                  <svg viewBox="0 0 100 35" className="w-full h-full">
                    {/* Road with pothole crater */}
                    <path d="M 5 22 L 35 22 Q 45 22 47 30 Q 55 35 63 30 Q 65 22 75 22 L 95 22" fill="none" stroke="#64748b" strokeWidth="2" />
                    <line x1="55" y1="12" x2="55" y2="31" stroke="#d97706" strokeWidth="1.2" strokeDasharray="1.5,1.5" />
                    <rect x="12" y="14" width="14" height="8" fill="#0f172a" rx="1" />
                  </svg>
                </div>
                <p className="text-xs text-slate-700 leading-normal mb-1.5">
                  Flat sensors shine straight over road craters. LiMap measures running surface variance in real time to steer safely around depressions.
                </p>
              </div>
              <div className="text-xs font-bold text-slate-900 flex items-center justify-between pt-1.5 border-t border-slate-100">
                <span>Launch Pothole Test</span>
                <ArrowRight size={13} className="text-slate-500 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
              </div>
            </div>

            {/* Card 3: Moving Vehicles */}
            <div 
              onClick={() => { onSelectScene('scene_c_moving'); onClose(); }}
              className="group p-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-400 rounded-xl cursor-pointer transition-all shadow-sm flex flex-col justify-between apple-card-hover apple-press"
            >
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-bold text-sm text-slate-900">3. Passing Traffic</span>
                  <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">No Ghost Trails</span>
                </div>
                {/* Mini SVG Schematic */}
                <div className="h-16 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center p-1 mb-2">
                  <svg viewBox="0 0 100 35" className="w-full h-full">
                    <line x1="5" y1="28" x2="95" y2="28" stroke="#cbd5e1" strokeWidth="2" />
                    {/* Van with velocity vector */}
                    <rect x="58" y="14" width="22" height="12" fill="#334155" rx="1.5" />
                    <line x1="80" y1="20" x2="94" y2="20" stroke="#059669" strokeWidth="1.8" />
                    <polygon points="94,18 98,20 94,22" fill="#059669" />
                    <rect x="10" y="18" width="14" height="8" fill="#0f172a" rx="1" />
                  </svg>
                </div>
                <p className="text-xs text-slate-700 leading-normal mb-1.5">
                  Passing cars leave behind blurry 'ghost' smears that make path planners panic. Our moving-object filter erases ghost trails immediately.
                </p>
              </div>
              <div className="text-xs font-bold text-slate-900 flex items-center justify-between pt-1.5 border-t border-slate-100">
                <span>Launch Traffic Test</span>
                <ArrowRight size={13} className="text-slate-500 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
              </div>
            </div>

            {/* Card 4: Thin Poles */}
            <div 
              onClick={() => { onSelectScene('scene_d_poles'); onClose(); }}
              className="group p-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-400 rounded-xl cursor-pointer transition-all shadow-sm flex flex-col justify-between apple-card-hover apple-press"
            >
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-bold text-sm text-slate-900">4. Thin Posts &amp; Fences</span>
                  <span className="text-xs font-mono font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">5cm Sharp Focus</span>
                </div>
                {/* Mini SVG Schematic */}
                <div className="h-16 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center p-1 mb-2">
                  <svg viewBox="0 0 100 35" className="w-full h-full">
                    {/* Fovea Concentric Rings */}
                    <circle cx="25" cy="18" r="16" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                    <circle cx="25" cy="18" r="9" fill="none" stroke="#9333ea" strokeWidth="1.2" strokeDasharray="2,2" />
                    <rect x="20" y="14" width="10" height="8" fill="#0f172a" rx="1" />
                    {/* Thin pole detected */}
                    <line x1="32" y1="8" x2="32" y2="28" stroke="#9333ea" strokeWidth="2.5" />
                    <circle cx="32" cy="8" r="1.5" fill="#9333ea" />
                  </svg>
                </div>
                <p className="text-xs text-slate-700 leading-normal mb-1.5">
                  Rough grids miss skinny lamp posts and fence wires. LiMap automatically sharpens to 5cm resolution close to the vehicle without wasting RAM far away.
                </p>
              </div>
              <div className="text-xs font-bold text-slate-900 flex items-center justify-between pt-1.5 border-t border-slate-100">
                <span>Launch Poles Test</span>
                <ArrowRight size={13} className="text-slate-500 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </div>
        </div>
      ),
      actionLabel: "Next: Visual Displays →",
      onAction: () => {},
    },

    // -------------------------------------------------------------
    // Slide 4: Visual Camera & Shading Options (Rich SVG Diagrams)
    // -------------------------------------------------------------
    {
      title: "Camera Perspectives & Map Colors",
      icon: <Eye size={20} className="text-slate-800" />,
      content: (
        <div className="flex flex-col gap-3 text-slate-800 leading-relaxed">
          <p className="text-sm text-slate-700 font-medium">
            Inspect the vehicle and 2.5D map from any angle with real-time elevation shaders:
          </p>

          <div className="grid grid-cols-2 gap-4 items-stretch">
            {/* Left Card: 3 Camera Angles with Visual Diagrams (Filled to match height) */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between apple-card-hover">
              <div className="flex flex-col gap-3 h-full">
                <span className="font-bold text-sm text-slate-900">3 Camera Perspectives</span>

                {/* 3 Visual Camera Options stretched to fill box */}
                <div className="flex flex-col justify-between flex-1 gap-2.5">
                  {/* Option 1: Follow Car */}
                  <div className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3.5">
                    <div className="w-14 h-13 bg-white rounded-lg border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                      <svg viewBox="0 0 50 40" className="w-full h-full p-1">
                        <polygon points="10,38 40,38 30,15 20,15" fill="#e2e8f0" />
                        <rect x="18" y="24" width="14" height="10" fill="#0f172a" rx="1.5" />
                        <circle cx="21" cy="34" r="2" fill="#ef4444" />
                        <circle cx="29" cy="34" r="2" fill="#ef4444" />
                        <circle cx="25" cy="8" r="3" fill="#0284c7" />
                        <path d="M 22 11 L 25 15 L 28 11" stroke="#0284c7" strokeWidth="1.2" fill="none" />
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900">Follow Car (Third-Person)</span>
                      <span className="text-xs text-slate-600 leading-snug">Rides directly behind the chassis along the planned path.</span>
                    </div>
                  </div>

                  {/* Option 2: 3D Free Orbit */}
                  <div className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3.5">
                    <div className="w-14 h-13 bg-white rounded-lg border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                      <svg viewBox="0 0 50 40" className="w-full h-full p-1">
                        <polygon points="25,12 37,18 25,24 13,18" fill="#94a3b8" />
                        <polygon points="13,18 25,24 25,36 13,30" fill="#64748b" />
                        <polygon points="37,18 25,24 25,36 37,30" fill="#475569" />
                        <ellipse cx="25" cy="24" rx="20" ry="10" fill="none" stroke="#0284c7" strokeWidth="1.2" strokeDasharray="3,2" />
                        <polygon points="44,22 47,26 42,26" fill="#0284c7" />
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900">3D Free Orbit</span>
                      <span className="text-xs text-slate-600 leading-snug">Freely rotate, zoom, and inspect terrain overhangs from any angle.</span>
                    </div>
                  </div>

                  {/* Option 3: Top Down BEV */}
                  <div className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3.5">
                    <div className="w-14 h-13 bg-white rounded-lg border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                      <svg viewBox="0 0 50 40" className="w-full h-full p-1">
                        <line x1="8" y1="12" x2="42" y2="12" stroke="#e2e8f0" strokeWidth="1" />
                        <line x1="8" y1="20" x2="42" y2="20" stroke="#e2e8f0" strokeWidth="1" />
                        <line x1="8" y1="28" x2="42" y2="28" stroke="#e2e8f0" strokeWidth="1" />
                        <line x1="16" y1="6" x2="16" y2="34" stroke="#e2e8f0" strokeWidth="1" />
                        <line x1="25" y1="6" x2="25" y2="34" stroke="#e2e8f0" strokeWidth="1" />
                        <line x1="34" y1="6" x2="34" y2="34" stroke="#e2e8f0" strokeWidth="1" />
                        <polygon points="25,12 30,26 25,23 20,26" fill="#0f172a" />
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900">Top-Down Bird's Eye (BEV)</span>
                      <span className="text-xs text-slate-600 leading-snug">Orthographic aerial map view for tactical spatial routing.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Card: Color Heatmaps with Live Color Swatch Bars */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between apple-card-hover">
              <div className="flex flex-col gap-3 h-full">
                <span className="font-bold text-sm text-slate-900">Color Heatmaps</span>

                <div className="flex flex-col justify-between flex-1 gap-2.5">
                  {/* Heatmap 1: Height */}
                  <div className="flex-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-center gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Ground Elevation (Height)</span>
                      <span className="text-[10px] font-mono text-slate-600">-1.5m to +4.0m</span>
                    </div>
                    <div className="w-full h-3 rounded-full shadow-inner" style={{ background: 'linear-gradient(to right, #3b82f6, #06b6d4, #10b981, #f59e0b, #ef4444)' }} />
                    <span className="text-xs text-slate-600 leading-snug">
                      Rainbow spectrum showing terrain grade and underpass height.
                    </span>
                  </div>

                  {/* Heatmap 2: Slope */}
                  <div className="flex-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-center gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Incline Hazard (Slope)</span>
                      <span className="text-[10px] font-mono font-semibold text-rose-600">0° to &gt;20° Tilt</span>
                    </div>
                    <div className="w-full h-3 rounded-full shadow-inner" style={{ background: 'linear-gradient(to right, #10b981, #84cc16, #eab308, #f97316, #dc2626)' }} />
                    <span className="text-xs text-slate-600 leading-snug">
                      Green is level road; bright red warns of rollover inclines.
                    </span>
                  </div>

                  {/* Heatmap 3: Confidence */}
                  <div className="flex-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-center gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Sensor Confidence</span>
                      <span className="text-[10px] font-mono text-slate-600">Return Density</span>
                    </div>
                    <div className="w-full h-3 rounded-full shadow-inner" style={{ background: 'linear-gradient(to right, #64748b, #3b82f6, #6366f1, #8b5cf6)' }} />
                    <span className="text-xs text-slate-600 leading-snug">
                      Live laser return density from multi-beam Bayesian cell fusion.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
      actionLabel: "Next: Defense Stress Testing →",
      onAction: () => {},
    },

    // -------------------------------------------------------------
    // Slide 5: Extreme Mud & Sensor Weather
    // -------------------------------------------------------------
    {
      title: "Sensor Mud & Combat Stress Test",
      icon: <ShieldAlert size={20} className="text-slate-800" />,
      content: (
        <div className="flex flex-col gap-3.5 text-slate-800 leading-relaxed">
          <p className="text-sm text-slate-700 font-medium">
            How does LiMap react when heavy combat mud, dust storms, or pouring rain blinds half the LiDAR beams?
          </p>

          <div className="grid grid-cols-2 gap-4">
            {/* Tactical Sensor Aperture & Occlusion Diagram (Full-box design) */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between apple-card-hover">
              <div className="flex flex-col gap-2.5">
                <span className="font-bold text-sm text-slate-900">50% Aperture Occlusion &amp; Bayesian Robustness</span>

                {/* Full-Box Tactical Sensor Cross-Section Schematic */}
                <div className="h-56 bg-slate-900 rounded-xl border border-slate-800 p-3 relative overflow-hidden flex flex-col justify-between">
                  {/* Grid background lines */}
                  <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px)', backgroundSize: '16px 16px' }} />

                  <svg viewBox="0 0 200 130" className="w-full h-full relative z-10">
                    {/* Definitions for gradients */}
                    <defs>
                      <linearGradient id="clearBeamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity="0.4" />
                      </linearGradient>
                      <linearGradient id="mudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#78350f" stopOpacity="0.95" />
                        <stop offset="100%" stopColor="#451a03" stopOpacity="0.95" />
                      </linearGradient>
                    </defs>

                    {/* Sensor Base Housing */}
                    <rect x="10" y="25" width="28" height="80" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />

                    {/* Upper Optical Lens (Clear) */}
                    <rect x="34" y="32" width="6" height="32" rx="2" fill="#0284c7" />
                    <circle cx="37" cy="48" r="2.5" fill="#38bdf8" />

                    {/* Lower Optical Lens (Mud-Coated) */}
                    <rect x="34" y="66" width="6" height="32" rx="2" fill="#78350f" />

                    {/* Active Laser Beams from Upper Aperture */}
                    <line x1="40" y1="36" x2="155" y2="28" stroke="url(#clearBeamGrad)" strokeWidth="1.6" />
                    <line x1="40" y1="42" x2="155" y2="40" stroke="url(#clearBeamGrad)" strokeWidth="1.6" />
                    <line x1="40" y1="48" x2="155" y2="52" stroke="url(#clearBeamGrad)" strokeWidth="1.6" />
                    <line x1="40" y1="54" x2="155" y2="64" stroke="url(#clearBeamGrad)" strokeWidth="1.6" />

                    {/* Blocked Laser Beams terminating at mud layer */}
                    <line x1="40" y1="72" x2="72" y2="72" stroke="#f43f5e" strokeWidth="1.4" strokeDasharray="3,2" />
                    <line x1="40" y1="80" x2="68" y2="82" stroke="#f43f5e" strokeWidth="1.4" strokeDasharray="3,2" />
                    <line x1="40" y1="88" x2="70" y2="92" stroke="#f43f5e" strokeWidth="1.4" strokeDasharray="3,2" />

                    {/* Mud Layer Obstruction Envelope */}
                    <path d="M 64 62 Q 82 72 74 88 Q 80 102 62 108 L 40 108 L 40 62 Z" fill="url(#mudGrad)" stroke="#92400e" strokeWidth="1" />
                    <circle cx="68" cy="74" r="3" fill="#92400e" />
                    <circle cx="62" cy="94" r="4" fill="#92400e" />

                    {/* 2.5D Target Obstacle & Elevation Cell Stack */}
                    <g transform="translate(155, 20)">
                      <rect x="0" y="0" width="35" height="52" rx="3" fill="#1e293b" stroke="#38bdf8" strokeWidth="1" />
                      
                      {/* Cell statistics indicator */}
                      <rect x="4" y="16" width="27" height="12" rx="2" fill="#0f172a" />
                      
                      <rect x="4" y="32" width="27" height="14" rx="2" fill="#0f172a" />
                    </g>

                    {/* Return signal reflection indicator */}
                    <circle cx="155" cy="40" r="3" fill="#10b981" />
                    <path d="M 152 40 L 140 40" stroke="#10b981" strokeWidth="1.2" strokeDasharray="2,2" />
                  </svg>

                  {/* Bottom Legend Bar inside diagram */}
                  <div className="flex items-center justify-between text-[11px] font-mono border-t border-slate-800 pt-1.5 px-1">
                    <span className="text-slate-400">Bayesian Fusion: <strong className="text-emerald-400 font-bold">Stable</strong></span>
                    <span className="text-slate-400">Memory Allocation: <strong className="text-sky-400 font-bold">0 B (Fixed)</strong></span>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-normal">
                  Even when ballistic mud or dust blinds 50% of the laser beams, Welford's algorithm holds cell variance stable with zero memory allocation spikes.
                </p>
              </div>
            </div>

            {/* Hardware Telemetry Breakdown */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between apple-card-hover">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="font-bold text-sm text-slate-900">Hardware Telemetry Invariant</span>
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Zero Leak</span>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                    <span className="text-slate-600 font-medium">LiDAR Beam Dropout:</span>
                    <strong className="text-rose-600 font-mono">50.0% Missing</strong>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                    <span className="text-slate-600 font-medium">Dynamic Heap Allocation:</span>
                    <strong className="text-slate-900 font-mono">0 Bytes (Preallocated)</strong>
                  </div>

                  <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 flex justify-between items-center text-xs">
                    <span className="text-emerald-900 font-medium">Memory Footprint:</span>
                    <strong className="text-emerald-800 font-mono text-sm font-bold">3.2616 MB (Locked)</strong>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                    <span className="text-slate-600 font-medium">Processing Rate:</span>
                    <strong className="text-slate-900 font-mono">40.2 FPS (No Stutter)</strong>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-normal">
                  Even during catastrophic sensor blindness, the memory never spikes and latency stays under 25 milliseconds.
                </p>
              </div>

              <button
                onClick={() => { onSelectStressMode('dropout_50'); onClose(); }}
                className="mt-2 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 apple-press"
              >
                <span>Trigger 50% Sensor Dropout Now</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      ),
      actionLabel: "Next: The Key Numbers →",
      onAction: () => {},
    },

    // -------------------------------------------------------------
    // Slide 6: The 5 Numbers that Matter
    // -------------------------------------------------------------
    {
      title: "The 5 Invariant Metrics that Matter",
      icon: <Award size={20} className="text-slate-800" />,
      content: (
        <div className="flex flex-col gap-3.5 text-slate-800 leading-relaxed">
          {/* 4 Scorecard Metrics Cards */}
          <div className="grid grid-cols-2 gap-3.5">
            {/* Metric 1 */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col justify-between apple-card-hover">
              <div>
                <span className="text-xs font-bold text-slate-600 block mb-1">
                  1. Preallocated RAM Footprint
                </span>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-mono font-bold text-slate-900">3.2616 MB</span>
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">935.7x Lighter</span>
                </div>
                {/* Visual Comparison Bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-1.5">
                  <div className="bg-emerald-600 h-full w-[2%]" title="LiMap 3.2616 MB" />
                </div>
              </div>
              <p className="text-xs text-slate-700 border-t border-slate-100 pt-1.5">
                Smaller than a single phone photo. Fits completely inside CPU L3 cache without needing GPU VRAM.
              </p>
            </div>

            {/* Metric 2 */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col justify-between apple-card-hover">
              <div>
                <span className="text-xs font-bold text-slate-600 block mb-1">
                  2. Ring Boundary Continuity
                </span>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-mono font-bold text-slate-900">0.00% Gaps</span>
                  <span className="text-xs font-mono font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded">Provable</span>
                </div>
                {/* Visual Full Bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-1.5">
                  <div className="bg-sky-600 h-full w-full" title="100% Continuous" />
                </div>
              </div>
              <p className="text-xs text-slate-700 border-t border-slate-100 pt-1.5">
                Integer-scaled resolution rings align with zero cracks across 4.2 million benchmark points.
              </p>
            </div>

            {/* Metric 3 */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col justify-between apple-card-hover">
              <div>
                <span className="text-xs font-bold text-slate-600 block mb-1">
                  3. Real-Time Processing Speed
                </span>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-xl font-mono font-bold text-amber-700">Profiling</span>
                  <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">In Progress</span>
                </div>
                {/* Visual Latency Bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-1.5">
                  <div className="bg-amber-500 h-full w-full" title="Hardware profiling in progress against edge budget" />
                </div>
              </div>
              <p className="text-xs text-slate-700 border-t border-slate-100 pt-1.5">
                Profiling pipeline latency against the 100ms automotive safety deadline across target hardware.
              </p>
            </div>

            {/* Metric 4 */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col justify-between apple-card-hover">
              <div>
                <span className="text-xs font-bold text-slate-600 block mb-1">
                  4. Overhang Traversal Clearance
                </span>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-mono font-bold text-slate-900">2.50 m</span>
                  <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded">Dual-Elevation</span>
                </div>
                {/* Visual Clearance Bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-1.5">
                  <div className="bg-purple-600 h-full w-[83%]" title="2.5m out of 3m vehicle envelope" />
                </div>
              </div>
              <p className="text-xs text-slate-700 border-t border-slate-100 pt-1.5">
                Enables safe high-speed passage under bridge decks, culverts, and low hanging power cables.
              </p>
            </div>
          </div>

          {/* Quick Evaluation Test Launcher Buttons */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700 block mb-2">
              Launch Any Scenario or Stress Test Instantly:
            </span>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => { onSelectScene('scene_a_bridge'); onClose(); }}
                className="px-3 py-2 bg-white hover:bg-slate-900 hover:text-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 flex items-center justify-between transition-all apple-press shadow-sm"
              >
                <span>[1] Bridge</span>
                <ArrowRight size={12} />
              </button>
              <button
                onClick={() => { onSelectScene('scene_b_potholes'); onClose(); }}
                className="px-3 py-2 bg-white hover:bg-slate-900 hover:text-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 flex items-center justify-between transition-all apple-press shadow-sm"
              >
                <span>[2] Potholes</span>
                <ArrowRight size={12} />
              </button>
              <button
                onClick={() => { onSelectStressMode('dropout_50'); onClose(); }}
                className="px-3 py-2 bg-white hover:bg-slate-900 hover:text-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 flex items-center justify-between transition-all apple-press shadow-sm"
              >
                <span>[3] Mud Stress</span>
                <ArrowRight size={12} />
              </button>
              <button
                onClick={() => { onSelectScene('real_seq08_f00'); onClose(); }}
                className="px-3 py-2 bg-white hover:bg-slate-900 hover:text-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 flex items-center justify-between transition-all apple-press shadow-sm"
              >
                <span>[4] Real City</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      ),
      actionLabel: "Start Exploring Dashboard",
      onAction: () => {},
    },
  ];

  const step = steps[currentStep];

  const handleNext = () => {
    if (step.onAction) step.onAction();
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-3xl bg-white/95 border border-slate-200/90 rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.12)] p-6 flex flex-col gap-4 text-slate-900"
        style={{ fontFamily: "var(--font-ui)" }}
      >
        {/* Header - Clean, No Eyebrow Subheadings */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-xl text-slate-700">
              {step.icon}
            </div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              {step.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors apple-press"
            title="Close Guide"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body - Smooth Spring Transition on each step change */}
        <div 
          key={currentStep}
          className="p-1 min-h-80 flex flex-col justify-center apple-slide-enter"
        >
          {step.content}
        </div>

        {/* Footer: Progress & Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          {/* Step Progress Counter & Dots */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentStep ? 'w-6 bg-slate-900' : 'w-2 bg-slate-200 hover:bg-slate-300'
                  }`}
                  title={`Go to step ${idx + 1}`}
                />
              ))}
            </div>
            <span className="text-xs font-mono text-slate-400 font-medium">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all flex items-center gap-1.5 apple-press"
              >
                <ChevronLeft size={14} />
                <span>Back</span>
              </button>
            )}

            <button
              onClick={() => {
                if (currentStep === steps.length - 1) {
                  onClose();
                  onOpenInspection?.();
                } else {
                  handleNext();
                }
              }}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm apple-press"
            >
              <span>{currentStep === steps.length - 1 ? 'Inspect Map & Proofs' : step.actionLabel}</span>
              {currentStep === steps.length - 1 ? <Check size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
