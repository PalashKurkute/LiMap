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
} from './types/telemetry';
import { Header } from './components/Header';
import { ThreeViewport } from './components/ThreeViewport';
import { MemoryMeter } from './components/MemoryMeter';
import { RegretPanel } from './components/RegretPanel';
import { DisplaysPanel } from './components/DisplaysPanel';
import { StressHarnessPanel } from './components/StressHarnessPanel';
import { ReplayWidget } from './components/ReplayWidget';
import { JudgeOnboardingModal } from './components/JudgeOnboardingModal';
import { InteractiveCrossSection } from './components/InteractiveCrossSection';
import { TacticalObjectiveCard } from './components/TacticalObjectiveCard';
import { DataInspectionScreen } from './components/DataInspectionScreen';
import { POOL_MB } from './lib/constants';
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

const SCENES: { id: SceneId; label: string; short: string; badge: string; desc: string; key: string }[] = [
  { id: 'scene_a_bridge', label: 'Bridge Underpass', short: 'Bridge', badge: '2.5m Clearance', desc: 'Checks overhead bridge clearance', key: '1' },
  { id: 'scene_b_potholes', label: 'Potholes & Craters', short: 'Potholes', badge: 'Road Dips', desc: 'Detects hazardous holes & ditches in road', key: '2' },
  { id: 'scene_c_moving', label: 'Moving Traffic', short: 'Traffic', badge: 'Anti-Ghost', desc: 'Filters moving cars without ghost trails', key: '3' },
  { id: 'scene_d_poles', label: 'Thin Poles & Trees', short: 'Poles', badge: 'Obstacles', desc: 'High-detail zoom on lamp posts & trees', key: '4' },
  { id: 'real_seq08_f00', label: 'Real City Driving', short: 'Real city', badge: 'KITTI Data', desc: 'Real LiDAR recorded on a public road', key: '5' },
];

export const App: React.FC = () => {
  const [activeScene, setActiveScene] = useState<SceneId>('scene_a_bridge');
  const [currentView, setCurrentView] = useState<'hook_3d' | 'data_inspection'>('hook_3d');
  const [telemetryData, setTelemetryData] = useState<TelemetryResponse | null>(null);
  const [crossSectionData, setCrossSectionData] = useState<CrossSectionResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('limap.welcomeSeen') !== '1';
    } catch {
      return true;
    }
  });
  const closeOnboarding = () => {
    setIsOnboardingOpen(false);
    try {
      localStorage.setItem('limap.welcomeSeen', '1');
    } catch {
      /* storage unavailable (private window): the guide will simply show again */
    }
  };
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

  // SIH26053 §9.2 Defense Sensor Degradation Stress Mode
  const [stressMode, setStressMode] = useState<StressModeId>('nominal');

  // Live Backend Connection & Throttling Telemetry
  const [backendPing, setBackendPing] = useState<number>(0);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);

  // Poll live telemetry and cross-section from backend FastAPI
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      const t0 = performance.now();
      try {
        const [telRes, csRes] = await Promise.all([
          fetch('/api/telemetry'),
          fetch('/api/cross_section'),
        ]);

        const roundtrip = Math.round(performance.now() - t0);

        if (telRes.ok && isMounted) {
          const telJson: TelemetryResponse = await telRes.json();
          setTelemetryData(telJson);
          setIsBackendConnected(true);
          setBackendPing(roundtrip);
        }

        if (csRes.ok && isMounted) {
          const csJson: CrossSectionResponse = await csRes.json();
          setCrossSectionData(csJson);
        }
      } catch {
        if (isMounted) {
          setIsBackendConnected(false);
        }
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeScene]);

  // Global shortcuts: Space = play/pause, Left/Right = step 2 frames, Esc = close modal / drawer.
  // Ignored while focus is on an interactive element so native Space/Enter behaviour still works.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const interactive = !!el?.closest('input, textarea, select, button, a, [contenteditable="true"]');

      if (e.key === 'Escape') {
        if (isOnboardingOpen) closeOnboarding();
        else if (isSidebarOpen) setIsSidebarOpen(false);
        return;
      }
      if (interactive || isOnboardingOpen || currentView !== 'hook_3d') return;
      if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 'ArrowRight') {
        setCurrentFrame((f) => Math.min(120, f + 2));
      } else if (e.key === 'ArrowLeft') {
        setCurrentFrame((f) => Math.max(0, f - 2));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOnboardingOpen, isSidebarOpen, currentView]);

  // Handle scene switching via backend REST trigger
  const handleSelectScene = async (scene: SceneId) => {
    setActiveScene(scene);
    setCurrentFrame(0);
    setResetSignal((prev) => prev + 1);
    setIsLoading(true);
    try {
      await fetch(`/api/load_scene/${scene}`, { method: 'POST' });
      // Fetch fresh telemetry and cross section for newly loaded scene
      const [telRes, csRes] = await Promise.all([
        fetch('/api/telemetry'),
        fetch('/api/cross_section'),
      ]);
      if (telRes.ok) {
        const telJson: TelemetryResponse = await telRes.json();
        setTelemetryData(telJson);
      }
      if (csRes.ok) {
        const csJson: CrossSectionResponse = await csRes.json();
        setCrossSectionData(csJson);
      }
    } catch {
      // Offline fallback handling
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Top Streamlined Header */}
      <Header
        onSelectScene={handleSelectScene}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        backendConnected={isBackendConnected}
        backendPingMs={backendPing}
        memoryMb={telemetryData?.telemetry?.total_heap_mb ?? POOL_MB}
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      {/* Main Workspace (Tier A Hook vs Tier B Data-Inspection) */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        {currentView === 'data_inspection' ? (
          <DataInspectionScreen
            activeScene={activeScene}
            telemetryData={telemetryData}
            onBackToHook={() => setCurrentView('hook_3d')}
            onSelectScene={handleSelectScene}
          />
        ) : (
          /* Center: 100% Immersive 3D Viewport with Movable UGV */
          <div style={{ flex: 1, height: '100%', position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <ThreeViewport
              sceneId={activeScene}
              telemetry={telemetryData?.telemetry ?? null}
              layerVisibility={layerVisibility}
              stressMode={stressMode}
              onLayerVisibilityChange={setLayerVisibility}
              onStressModeChange={setStressMode}
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

            {/* Top-left stack: scene switcher, provenance stamp, scene card. One column, so nothing can
                overlap at any viewport width, and the provenance stamp is always visible. */}
            <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2.5 pointer-events-none max-w-[calc(100%-16rem)]">
              <div
                role="group"
                aria-label="Scenes"
                className="pointer-events-auto max-w-full overflow-x-auto bg-panel/90 backdrop-blur-md border border-line rounded-full px-1.5 py-1 shadow-lg flex items-center gap-0.5 text-fg"
              >
                {SCENES.map((s) => {
                  const isActive = activeScene === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSelectScene(s.id)}
                      disabled={isLoading}
                      aria-pressed={isActive}
                      aria-label={`${s.label}: ${s.desc} (key ${s.key})`}
                      title={`${s.label}: ${s.desc} [${s.key}]`}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all apple-press ${
                        isActive ? 'bg-accent text-accent-on shadow-sm' : 'text-fg-2 hover:text-fg hover:bg-subtle'
                      }`}
                    >
                      <span className={`text-[10px] font-mono font-bold ${isActive ? 'text-accent-on/80' : 'text-fg-muted'}`}>
                        {s.key}
                      </span>
                      <span>{s.short}</span>
                    </button>
                  );
                })}
              </div>

              <span
                data-region="provenance"
                className={`pointer-events-auto px-2.5 py-1 rounded-md font-mono text-[10px] font-bold shadow-sm tracking-wider uppercase border ${
                  activeScene.startsWith('real_')
                    ? 'bg-good-bg text-good-fg border-good-line'
                    : 'bg-warn-bg text-warn-fg border-warn-line'
                }`}
              >
                {activeScene.startsWith('real_')
                  ? 'Real recording · SemanticKITTI seq 08 · dataset labels'
                  : 'Synthetic scene · illustrative'}
              </span>

              <TacticalObjectiveCard
                sceneId={activeScene}
                memoryMb={telemetryData?.telemetry?.total_heap_mb ?? POOL_MB}
                baselines={telemetryData?.baselines ?? null}
                tacticalSummary={telemetryData?.telemetry?.tactical_summary}
                cameraMode={cameraMode}
                onCameraModeChange={setCameraMode}
                colorMode={colorMode}
                onColorModeChange={setColorMode}
              />
            </div>

            {/* Primary call to action */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
              <button
                onClick={() => setCurrentView('data_inspection')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent hover:bg-accent/90 text-accent-on text-xs font-semibold shadow-lg transition-all active:scale-95 whitespace-nowrap"
                title="Inspect the actual grid cells: resolution ring, class, variance, clearance"
              >
                <Database size={13} />
                <span>Open Map Inspector &rarr;</span>
              </button>
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
        )}

        {/* Slide-out Telemetry Drawer (Apple / Swiss Light Minimalism) */}
        <aside data-region="drawer" className={`telemetry-drawer ${isSidebarOpen ? 'open' : 'closed'}`}>
          {/* Drawer Top Bar */}
          <div className="p-4 border-b border-line flex items-center justify-between bg-panel">
            <div>
              <div className="text-xs font-bold text-fg tracking-wider uppercase">
                Control Panel &amp; Telemetry
              </div>
              <div className="text-[11px] text-fg-muted">
                DRDO SIH26053 Perception System
              </div>
            </div>

            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 rounded-lg border border-line text-fg-muted hover:text-fg hover:bg-subtle transition-colors"
              title="Close Panel [Esc]"
            >
              <X size={16} />
            </button>
          </div>

          {/* Navigation Tabs (View, Vehicle, Proofs, Stress) */}
          <div className="flex border-b border-line bg-panel p-2 gap-1">
            <button
              onClick={() => setActiveTab('displays')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'displays'
                  ? 'bg-accent text-accent-on shadow-sm'
                  : 'text-fg-2 hover:bg-subtle hover:text-fg'
              }`}
            >
              <Radio size={13} />
              <span>View</span>
            </button>

            <button
              onClick={() => setActiveTab('telemetry')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'telemetry'
                  ? 'bg-accent text-accent-on shadow-sm'
                  : 'text-fg-2 hover:bg-subtle hover:text-fg'
              }`}
            >
              <Gauge size={13} />
              <span>Vehicle</span>
            </button>

            <button
              onClick={() => setActiveTab('proofs')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'proofs'
                  ? 'bg-accent text-accent-on shadow-sm'
                  : 'text-fg-2 hover:bg-subtle hover:text-fg'
              }`}
            >
              <ShieldCheck size={13} />
              <span>Proofs</span>
            </button>

            <button
              onClick={() => setActiveTab('stress')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'stress'
                  ? 'bg-accent text-accent-on shadow-sm'
                  : 'text-fg-2 hover:bg-subtle hover:text-fg'
              }`}
            >
              <ShieldAlert size={13} />
              <span>Stress</span>
            </button>
          </div>

          {/* Drawer Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-fg bg-subtle">
            {/* Tab 1: View & Camera Controls (Clean Vertical Layout) */}
            {activeTab === 'displays' && (
              <div className="flex flex-col gap-4">
                {/* Visual Viewport Controls Card */}
                <div className="bg-panel border border-line-strong rounded-xl p-4 shadow-sm flex flex-col gap-4">
                  {/* TERRAIN RENDERING MODE (Vertical Stack) */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-fg uppercase tracking-wide">
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
                                ? 'bg-accent-subtle text-fg border-accent shadow-sm'
                                : 'bg-subtle text-fg-2 border-line hover:border-line-strong'
                            }`}
                          >
                            <div className="flex flex-col">
                              <span className="text-xs font-bold">{grid.label}</span>
                              <span className={`text-[10px] text-fg-muted`}>{grid.desc}</span>
                            </div>
                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${isSelected ? 'border-accent bg-panel' : 'border-line-strong'}`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* CAMERA PERSPECTIVE (Vertical Stack) */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-fg uppercase tracking-wide">
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
                                ? 'bg-accent-subtle text-fg border-accent shadow-sm'
                                : 'bg-subtle text-fg-2 border-line hover:border-line-strong'
                            }`}
                          >
                            <div className="flex flex-col">
                              <span className="text-xs font-bold">{cam.label}</span>
                              <span className={`text-[10px] text-fg-muted`}>{cam.desc}</span>
                            </div>
                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${isSelected ? 'border-accent bg-panel' : 'border-line-strong'}`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* COLOR SHADING (Vertical Stack) */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-fg uppercase tracking-wide">
                      Color Shading Metric
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {[
                        { id: 'elevation', label: 'Height Elevation', desc: 'Turbo Jet spectrum (-1.5m to +4m)' },
                        { id: 'traversability', label: 'Ground Slope Incline', desc: 'Green drivable to red steep hazard' },
                        { id: 'uncertainty', label: 'Lateral Distance (illustrative)', desc: 'Distance from the driving corridor, not a measured uncertainty' },
                      ].map((col) => {
                        const isSelected = colorMode === col.id;
                        return (
                          <button
                            key={col.id}
                            onClick={() => setColorMode(col.id as ColorMapMode)}
                            className={`p-2.5 rounded-xl text-left border transition-all flex items-center justify-between apple-press ${
                              isSelected
                                ? 'bg-accent-subtle text-fg border-accent shadow-sm'
                                : 'bg-subtle text-fg-2 border-line hover:border-line-strong'
                            }`}
                          >
                            <div className="flex flex-col">
                              <span className="text-xs font-bold">{col.label}</span>
                              <span className={`text-[10px] text-fg-muted`}>{col.desc}</span>
                            </div>
                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${isSelected ? 'border-accent bg-panel' : 'border-line-strong'}`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
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
                <div className="bg-panel border border-line rounded-xl p-4 shadow-sm flex flex-col gap-3">
                  <div className="flex justify-between items-center border-b border-line pb-2">
                    <div className="text-xs font-bold text-fg uppercase flex items-center gap-1.5">
                      <Gauge size={14} className="text-fg" />
                      <span>Vehicle Telemetry (Simulated)</span>
                    </div>
                    <button
                      onClick={() => setResetSignal((prev) => prev + 1)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md border border-line text-fg-2 hover:bg-subtle font-mono text-[10px] font-semibold transition-colors"
                      title="Reset Pose to Origin [R]"
                    >
                      <RotateCcw size={11} />
                      <span>Reset [R]</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-subtle p-2.5 rounded-lg border border-line/80">
                      <div className="text-[10px] text-fg-muted font-mono">SPEED</div>
                      <div className="text-lg font-bold font-mono text-fg">
                        {carTelemetry.speed.toFixed(1)} <small className="text-xs font-normal text-fg-muted">km/h</small>
                      </div>
                    </div>

                    <div className="bg-subtle p-2.5 rounded-lg border border-line/80">
                      <div className="text-[10px] text-fg-muted font-mono flex items-center gap-1">
                        <Compass size={11} className="text-fg-2" />
                        <span>HEADING</span>
                      </div>
                      <div className="text-lg font-bold font-mono text-fg">
                        {carTelemetry.heading.toFixed(0)}&deg;
                      </div>
                    </div>
                  </div>

                  <div className="bg-subtle p-2 rounded-lg border border-line/80 flex justify-between font-mono text-xs">
                    <span className="text-fg-muted">COORDINATES</span>
                    <span className="text-fg font-semibold">
                      X: {carTelemetry.x.toFixed(2)}m &bull; Y: {carTelemetry.y.toFixed(2)}m &bull; Z: {carTelemetry.z.toFixed(2)}m
                    </span>
                  </div>

                  <div className="p-3 bg-subtle rounded-lg border border-line-strong text-xs text-fg-2 leading-relaxed">
                    <strong className="text-fg block mb-1">Autonomous Trajectory Tracking:</strong>
                    The vehicle autonomously follows the planned collision-free 2.5D trajectory using its onboard kinematic model. Use the Mission Playback controller below to pause, rewind, or scrub frame-by-frame.
                  </div>
                </div>

                {/* Real-Time Spatial Hash Metrics Card */}
                <div className="bg-panel border border-line rounded-xl p-4 shadow-sm flex flex-col gap-3">
                  <div className="text-xs font-bold text-fg uppercase flex items-center gap-1.5 border-b border-line pb-2">
                    <ShieldCheck size={14} className="text-fg" />
                    <span>Memory Footprint (Invariant)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 font-mono">
                    <div className="bg-subtle p-2.5 rounded-lg border border-line/80">
                      <div className="text-[10px] text-fg-muted">TOTAL HEAP</div>
                      <div className="text-sm font-bold text-fg">
                        {telemetryData ? `${telemetryData.telemetry.total_heap_mb.toFixed(4)} MB` : 'n/a'}
                      </div>
                    </div>

                    <div className="bg-subtle p-2.5 rounded-lg border border-line/80">
                      <div className="text-[10px] text-fg-muted">ACTIVE CELLS</div>
                      <div className="text-sm font-bold text-fg">
                        {telemetryData ? telemetryData.telemetry.active_cells.toLocaleString() : 'n/a'}
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
                <div className="flex gap-1 bg-subtle p-1 rounded-lg">
                  <button
                    onClick={() => setProofsSubTab('memory')}
                    className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all ${
                      proofsSubTab === 'memory'
                        ? 'bg-panel text-fg shadow-sm'
                        : 'text-fg-2 hover:text-fg'
                    }`}
                  >
                    Memory
                  </button>
                  <button
                    onClick={() => setProofsSubTab('clearance')}
                    className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all ${
                      proofsSubTab === 'clearance'
                        ? 'bg-panel text-fg shadow-sm'
                        : 'text-fg-2 hover:text-fg'
                    }`}
                  >
                    Bridge Clearance
                  </button>
                  <button
                    onClick={() => setProofsSubTab('regret')}
                    className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all ${
                      proofsSubTab === 'regret'
                        ? 'bg-panel text-fg shadow-sm'
                        : 'text-fg-2 hover:text-fg'
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
                onSelectStressMode={setStressMode}
              />
            )}
          </div>
        </aside>
      </div>

      {/* Status bar: every value is derived from loaded data or the API; nothing retyped. */}
      <footer
        data-region="statusbar"
        className="h-8 shrink-0 border-t border-line bg-panel flex items-center justify-between gap-4 px-4 text-[11px] font-mono text-fg-muted z-30"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="whitespace-nowrap">
            API:{' '}
            <strong className={isBackendConnected ? 'text-good-fg' : 'text-warn-fg'}>
              {isBackendConnected ? `online (${backendPing}ms)` : 'offline'}
            </strong>
          </span>
          <span aria-hidden="true">&bull;</span>
          <span className="whitespace-nowrap">
            ACTIVE CELLS:{' '}
            <strong className="text-fg">
              {telemetryData
                ? `${telemetryData.telemetry.active_cells.toLocaleString()} / ${telemetryData.telemetry.capacity.toLocaleString()}`
                : 'no scene data'}
            </strong>
          </span>
          <span aria-hidden="true">&bull;</span>
          <span className="whitespace-nowrap">
            POOL:{' '}
            <strong className="text-fg">
              {telemetryData
                ? `${telemetryData.telemetry.total_heap_mb.toFixed(4)} MB fixed`
                : `${POOL_MB.toFixed(4)} MB fixed (by design)`}
            </strong>
          </span>
        </div>

        <span className="hidden xl:inline shrink-0 whitespace-nowrap text-[10px] text-fg-2 bg-subtle px-2 py-0.5 rounded">
          Scope: CPU-only &bull; single scans, not a live stream
        </span>

        <span className="whitespace-nowrap">
          LABELS: <strong className="text-fg">{telemetryData?.telemetry?.label_source ?? 'n/a'}</strong>
        </span>
      </footer>
      
      {/* Onboarding Dialog for DRDO Hackathon Evaluator */}
      <JudgeOnboardingModal
        isOpen={isOnboardingOpen}
        onClose={closeOnboarding}
        onSelectScene={handleSelectScene}
        onSelectStressMode={setStressMode}
        onOpenInspection={() => setCurrentView('data_inspection')}
      />
    </div>
  );
};

export default App;
