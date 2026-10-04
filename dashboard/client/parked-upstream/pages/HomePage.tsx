import React, { useState, useEffect } from 'react';
import type {
  SceneId,
  TelemetryResponse,
  CrossSectionResponse,
  LayerVisibility,
  StressModeId,
  CameraViewMode,
  DEMDisplayMode,
  ColorMapMode,
} from '../types/telemetry';
import { ThreeViewport } from '../components/ThreeViewport';
import { CityDrivingViewport } from '../components/CityDrivingViewport';
import { MemoryMeter } from '../components/MemoryMeter';
import { RegretPanel } from '../components/RegretPanel';
import { DisplaysPanel } from '../components/DisplaysPanel';
import { StressHarnessPanel } from '../components/StressHarnessPanel';
import { ReplayWidget } from '../components/ReplayWidget';
import { InteractiveCrossSection } from '../components/InteractiveCrossSection';
import { TacticalObjectiveCard } from '../components/TacticalObjectiveCard';
import {
  X,
  Gauge,
  Radio,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  Compass,
  Database,
} from 'lucide-react';

const SCENES: { id: SceneId; label: string; badge: string; desc: string; key: string }[] = [
  { id: 'scene_a_bridge', label: 'Bridge Underpass', badge: '2.5m Clearance', desc: 'Checks overhead bridge clearance', key: '1' },
  { id: 'scene_b_potholes', label: 'Potholes & Craters', badge: 'Road Dips', desc: 'Detects hazardous holes & ditches in road', key: '2' },
  { id: 'scene_c_moving', label: 'Moving Traffic', badge: 'Anti-Ghost', desc: 'Filters moving cars without ghost trails', key: '3' },
  { id: 'scene_d_poles', label: 'Thin Poles & Trees', badge: 'Obstacles', desc: 'High-detail zoom on lamp posts & trees', key: '4' },
  { id: 'real_seq08_f00', label: 'Real City Driving', badge: 'KITTI Data', desc: 'Real LiDAR recorded on a public road', key: '5' },
];

interface HomePageProps {
  activeScene: SceneId;
  onSelectScene: (scene: SceneId) => void;
  telemetryData: TelemetryResponse | null;
  crossSectionData: CrossSectionResponse | null;
  isLoading: boolean;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNavigateToInspection: () => void;
  stressMode: StressModeId;
  onSelectStressMode: (mode: StressModeId) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  activeScene,
  onSelectScene,
  telemetryData,
  crossSectionData,
  isLoading,
  isSidebarOpen,
  onToggleSidebar,
  onNavigateToInspection,
  stressMode,
  onSelectStressMode,
}) => {
  const [activeTab, setActiveTab] = useState<'displays' | 'telemetry' | 'proofs' | 'stress'>('displays');
  const [proofsSubTab, setProofsSubTab] = useState<'memory' | 'clearance' | 'regret'>('memory');

  // Live UGV Kinematics
  const [carTelemetry, setCarTelemetry] = useState({
    speed: 0,
    heading: 0,
    x: 0,
    y: 0,
    z: -1.41,
  });
  const [resetSignal, setResetSignal] = useState<number>(0);

  // Viewport & Shading controls
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('orbit');
  const [displayMode, setDisplayMode] = useState<DEMDisplayMode>('points');
  const [colorMode, setColorMode] = useState<ColorMapMode>('elevation');
  const [isWireframe, setIsWireframe] = useState<boolean>(false);
  const [showScaleBar] = useState<boolean>(false);

  // Playback & Replay timeline
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // ROS 2 Layer Visibility state
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    demSurface: false,
    demVoxels: false,
    rawPoints: true,
    bridgeDeck: true,
    trajectory: true,
    trackers: true,
    foveaRings: true,
    sweepWave: false,
    headlights: true,
  });

  // Dispatch window resize when sidebar opens/closes so Three.js canvas dynamically adjusts
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 280);
    return () => clearTimeout(timer);
  }, [isSidebarOpen]);

  return (
    <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: 'var(--bg-primary)' }}>
      {/* Center: 100% Immersive 3D Viewport with Movable UGV */}
      <div style={{ flex: 1, height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {activeScene === 'real_seq08_f00' ? (
          <CityDrivingViewport
            isPlaying={isPlaying}
            onIsPlayingChange={setIsPlaying}
            playbackSpeed={playbackSpeed}
            onPlaybackSpeedChange={setPlaybackSpeed}
            onTelemetryUpdate={setCarTelemetry}
          />
        ) : (
          <ThreeViewport
            sceneId={activeScene}
            telemetry={telemetryData?.telemetry ?? null}
            layerVisibility={layerVisibility}
            stressMode={stressMode}
            onLayerVisibilityChange={setLayerVisibility}
            onStressModeChange={onSelectStressMode}
            cameraMode={cameraMode}
            onCameraModeChange={setCameraMode}
            displayMode={displayMode}
            onDisplayModeChange={setDisplayMode}
            colorMode={colorMode}
            onColorModeChange={setColorMode}
            isWireframe={isWireframe}
            onWireframeChange={setIsWireframe}
            isPlaying={isPlaying}
            onIsPlayingChange={setIsPlaying}
            currentFrame={currentFrame}
            onFrameSeek={setCurrentFrame}
            onCurrentFrameChange={setCurrentFrame}
            playbackSpeed={playbackSpeed}
            onPlaybackSpeedChange={setPlaybackSpeed}
            onTelemetryUpdate={setCarTelemetry}
            resetSignal={resetSignal}
            showScaleBar={showScaleBar}
          />
        )}

        {/* Truth-in-Advertising Badge — hidden for city scene, its panel has its own header */}
        {activeScene !== 'real_seq08_f00' && (
          <div className="absolute top-18 left-4 z-20">
            <span className="px-2.5 py-1 rounded-md bg-amber-500/90 text-white font-mono text-[10px] font-bold shadow-md tracking-wider uppercase border border-amber-400">
              SYNTHETIC TEST SCENE (ILLUSTRATIVE)
            </span>
          </div>
        )}

        {/* Tactical Scenario Mission & Verification Objective HUD */}
        <TacticalObjectiveCard
          sceneId={activeScene}
          memoryMb={telemetryData?.telemetry?.total_heap_mb ?? 3.2616}
          tacticalSummary={telemetryData?.telemetry?.tactical_summary}
          cameraMode={cameraMode}
          onCameraModeChange={setCameraMode}
          colorMode={colorMode}
          onColorModeChange={setColorMode}
        />

        {/* Primary Call-To-Action: Inspect Map & Proofs Button */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <button
            onClick={onNavigateToInspection}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-900 text-white text-xs font-semibold shadow-lg backdrop-blur-md transition-all border border-slate-700/80 active:scale-95"
            title="Open separate Data-Inspection Matrix page"
          >
            <Database size={13} className="text-cyan-400" />
            <span>Inspect Map &amp; Proofs &rarr;</span>
          </button>
        </div>

        {/* Floating Top Quick-Scenario Bar (Apple / Linear minimal pill) */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white/90 backdrop-blur-md border border-slate-200/90 rounded-full px-2 py-1.5 shadow-lg flex items-center gap-1 text-slate-800">
          {SCENES.map((s) => {
            const isActive = activeScene === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onSelectScene(s.id)}
                disabled={isLoading}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all apple-press ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title={`${s.label} (${s.desc}) [${s.key}]`}
              >
                <span className={`text-[10px] font-mono font-bold ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                  [{s.key}]
                </span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Floating Bottom-Right Replay & Timeline Widget */}
        <ReplayWidget
          isPlaying={isPlaying}
          onIsPlayingChange={setIsPlaying}
          currentFrame={currentFrame}
          onFrameSeek={setCurrentFrame}
          playbackSpeed={playbackSpeed}
          onPlaybackSpeedChange={setPlaybackSpeed}
        />
      </div>

      {/* Slide-out Telemetry Drawer (Apple / Swiss Light Minimalism) */}
      <aside className={`telemetry-drawer ${isSidebarOpen ? 'open' : 'closed'}`}>
        {/* Drawer Top Bar */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div>
            <div className="text-xs font-bold text-slate-900 tracking-wider uppercase">
              Control Panel &amp; Telemetry
            </div>
            <div className="text-[11px] text-slate-500">
              DRDO SIH26053 Perception System
            </div>
          </div>

          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
            title="Close Panel [Esc]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation Tabs (View, Vehicle, Proofs, Stress) */}
        <div className="flex border-b border-slate-200 bg-white p-2 gap-1">
          <button
            onClick={() => setActiveTab('displays')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'displays'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Radio size={13} />
            <span>View</span>
          </button>

          <button
            onClick={() => setActiveTab('telemetry')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'telemetry'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Gauge size={13} />
            <span>Vehicle</span>
          </button>

          <button
            onClick={() => setActiveTab('proofs')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'proofs'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <ShieldCheck size={13} />
            <span>Proofs</span>
          </button>

          <button
            onClick={() => setActiveTab('stress')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'stress'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <ShieldAlert size={13} />
            <span>Stress</span>
          </button>
        </div>

        {/* Drawer Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-slate-900 bg-slate-100">
          {/* Tab 1: View & Camera Controls (Clean Vertical Layout) */}
          {activeTab === 'displays' && (
            <div className="flex flex-col gap-4">
              {/* Visual Viewport Controls Card */}
              <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-sm flex flex-col gap-4">
                {/* TERRAIN RENDERING MODE (Vertical Stack) */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                    Terrain Rendering
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {[
                      { id: 'points', label: 'Fovea Laser Dots', desc: 'Adaptive nested rings (5cm to 50cm)' },
                      { id: 'surface', label: 'Terrain Surface Mesh', desc: 'Continuous heightfield geometry' },
                      { id: 'voxels', label: '3D Voxel Blocks', desc: 'Discrete elevation column stacks' },
                    ].map((grid) => {
                      const isSelected = displayMode === grid.id;
                      return (
                        <button
                          key={grid.id}
                          onClick={() => setDisplayMode(grid.id as DEMDisplayMode)}
                          className={`p-2.5 rounded-xl text-left border transition-all flex items-center justify-between apple-press ${
                            isSelected
                              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-bold">{grid.label}</span>
                            <span className={`text-[10px] ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>{grid.desc}</span>
                          </div>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${isSelected ? 'border-white bg-white' : 'border-slate-400'}`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* CAMERA PERSPECTIVE (Vertical Stack) */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                    Camera Perspective
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {[
                      { id: 'orbit', label: '3D Free Orbit', desc: 'Mouse drag to rotate, pan & zoom' },
                      { id: 'chase', label: 'Follow Vehicle', desc: 'Third-person chase behind rover' },
                      { id: 'bev', label: 'Top-Down (BEV)', desc: 'Orthographic tactical aerial view' },
                    ].map((cam) => {
                      const isSelected = cameraMode === cam.id;
                      return (
                        <button
                          key={cam.id}
                          onClick={() => setCameraMode(cam.id as CameraViewMode)}
                          className={`p-2.5 rounded-xl text-left border transition-all flex items-center justify-between apple-press ${
                            isSelected
                              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-bold">{cam.label}</span>
                            <span className={`text-[10px] ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>{cam.desc}</span>
                          </div>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${isSelected ? 'border-white bg-white' : 'border-slate-400'}`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* COLOR SHADING (Vertical Stack) */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                    Color Shading Metric
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {[
                      { id: 'elevation', label: 'Height Elevation', desc: 'Turbo Jet spectrum (-1.5m to +4m)' },
                      { id: 'traversability', label: 'Ground Slope Incline', desc: 'Green drivable to red steep hazard' },
                      { id: 'uncertainty', label: 'Bayesian Confidence', desc: 'Multi-beam return density' },
                    ].map((col) => {
                      const isSelected = colorMode === col.id;
                      return (
                        <button
                          key={col.id}
                          onClick={() => setColorMode(col.id as ColorMapMode)}
                          className={`p-2.5 rounded-xl text-left border transition-all flex items-center justify-between apple-press ${
                            isSelected
                              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-bold">{col.label}</span>
                            <span className={`text-[10px] ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>{col.desc}</span>
                          </div>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${isSelected ? 'border-white bg-white' : 'border-slate-400'}`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Streamlined Perception Overlays Panel */}
              <DisplaysPanel
                layers={layerVisibility}
                onToggleLayer={(k) => setLayerVisibility((prev) => ({ ...prev, [k]: !prev[k] }))}
                onResetLayers={() => setLayerVisibility({
                  demSurface: false,
                  demVoxels: false,
                  rawPoints: true,
                  bridgeDeck: true,
                  trajectory: true,
                  trackers: true,
                  foveaRings: true,
                  sweepWave: false,
                  headlights: true,
                })}
              />
            </div>
          )}

          {/* Tab 2: Vehicle Telemetry & Drive Instructions */}
          {activeTab === 'telemetry' && (
            <div className="flex flex-col gap-4">
              {/* UGV Kinematic HUD Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <div className="text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5">
                    <Gauge size={14} className="text-slate-800" />
                    <span>Vehicle Telemetry (Simulated)</span>
                  </div>
                  <button
                    onClick={() => setResetSignal((prev) => prev + 1)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 font-mono text-[10px] font-semibold transition-colors"
                    title="Reset Pose to Origin [R]"
                  >
                    <RotateCcw size={11} />
                    <span>Reset [R]</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                    <div className="text-[10px] text-slate-500 font-mono">SPEED</div>
                    <div className="text-lg font-bold font-mono text-slate-900">
                      {carTelemetry.speed.toFixed(1)} <small className="text-xs font-normal text-slate-500">km/h</small>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                      <Compass size={11} className="text-slate-600" />
                      <span>HEADING</span>
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-900">
                      {carTelemetry.heading.toFixed(0)}&deg;
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/80 flex justify-between font-mono text-xs">
                  <span className="text-slate-500">COORDINATES</span>
                  <span className="text-slate-800 font-semibold">
                    X: {carTelemetry.x.toFixed(2)}m &bull; Y: {carTelemetry.y.toFixed(2)}m &bull; Z: {carTelemetry.z.toFixed(2)}m
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-300 text-xs text-slate-700 leading-relaxed">
                  <strong className="text-slate-900 block mb-1">Autonomous Trajectory Tracking:</strong>
                  The vehicle autonomously follows the planned collision-free 2.5D trajectory using its onboard kinematic model. Use the Mission Playback controller below to pause, rewind, or scrub frame-by-frame.
                </div>
              </div>

              {/* Real-Time Spatial Hash Metrics Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                <div className="text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <ShieldCheck size={14} className="text-slate-800" />
                  <span>Memory Footprint (Invariant)</span>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                    <div className="text-[10px] text-slate-500">TOTAL HEAP</div>
                    <div className="text-sm font-bold text-slate-900">
                      {telemetryData ? `${telemetryData.telemetry.total_heap_mb.toFixed(4)} MB` : '3.2616 MB'}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                    <div className="text-[10px] text-slate-500">ACTIVE CELLS</div>
                    <div className="text-sm font-bold text-slate-900">
                      {telemetryData ? telemetryData.telemetry.active_cells.toLocaleString() : '47,307'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: DRDO Technical Proofs (Memory, Clearance, Regret) */}
          {activeTab === 'proofs' && (
            <div className="flex flex-col gap-3">
              {/* Subtab Selector */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setProofsSubTab('memory')}
                  className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all ${
                    proofsSubTab === 'memory'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Memory Bound
                </button>
                <button
                  onClick={() => setProofsSubTab('clearance')}
                  className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all ${
                    proofsSubTab === 'clearance'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Bridge Clearance
                </button>
                <button
                  onClick={() => setProofsSubTab('regret')}
                  className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all ${
                    proofsSubTab === 'regret'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Planner Regret
                </button>
              </div>

              {proofsSubTab === 'memory' && (
                <MemoryMeter
                  baselines={telemetryData?.baselines ?? null}
                  telemetry={telemetryData?.telemetry ?? null}
                />
              )}

              {proofsSubTab === 'clearance' && (
                <InteractiveCrossSection
                  data={crossSectionData}
                  sceneId={activeScene}
                />
              )}

              {proofsSubTab === 'regret' && (
                <RegretPanel />
              )}
            </div>
          )}

          {/* Tab 4: Adversarial Stress Test (SIH26053 §9.2) */}
          {activeTab === 'stress' && (
            <StressHarnessPanel
              activeStressMode={stressMode}
              onSelectStressMode={onSelectStressMode}
            />
          )}
        </div>
      </aside>
    </div>
  );
};
