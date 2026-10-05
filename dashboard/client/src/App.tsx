import React, { Suspense, useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import type {
  SceneId,
  RenderMode,
  PipelineData,
  LayerVisibility,
  StressModeId,
  CameraViewMode,
  DEMDisplayMode,
  ColorMapMode,
} from './types/telemetry';
import { Header } from './components/Header';
import { DisplaysPanel } from './components/DisplaysPanel';
import { StressHarnessPanel } from './components/StressHarnessPanel';
import { ReplayWidget } from './components/ReplayWidget';
import { InteractiveCrossSection } from './components/InteractiveCrossSection';
import { TacticalObjectiveCard } from './components/TacticalObjectiveCard';
import { DataInspectionScreen, EvidenceView, ThreeViewport, ViewLoading } from './components/lazyViews';
import { prefetchViews } from './components/viewLoaders';
import { ViewBoundary } from './components/ViewBoundary';
import { POOL_MB } from './lib/constants';
import { useSceneData } from './data/useSceneData';
import { computeGroundZ } from './data/pipeline';
import { SCENES, sceneInfo } from './data/scenes';
import { drawOptionsFor } from './data/viewOptions';
import { ViewportLegend } from './features/viewport/ViewportLegend';
import { fetchJson } from './data/api';
import { loadPlanner } from './data/planner';
import { prefersReducedMotion } from './lib/motion';
import { isAppScope } from './lib/keyScope';
import { pollDelayMs } from './lib/pollDelay';
import { clearReady, markReady } from './state/readiness';
import { getInspector, replaceInspector, setInspector } from './state/inspector';
import { AppActionsContext, AppDataContext, type AppActions, type AppSnapshot, type AppView, type DrawerTab } from './state/AppActions';
import { getThemePreference, setThemePreference } from './theme/theme';
import { X, Gauge, Radio, ShieldCheck, ShieldAlert, RotateCcw, Compass, Layers, Keyboard } from 'lucide-react';
import { ShortcutsSheet } from './components/ShortcutsSheet';

const DEFAULT_LAYERS: LayerVisibility = {
  demSurface: false,
  demVoxels: false,
  rawPoints: true,
  bridgeDeck: true,
  trajectory: true,
  trackers: true,
  foveaRings: true,
  sweepWave: false,
  headlights: true,
};

const DRAWER_TABS: { id: DrawerTab; label: string; icon: React.ReactNode }[] = [
  { id: 'displays', label: 'Layers', icon: <Radio size={13} /> },
  { id: 'telemetry', label: 'Vehicle', icon: <Gauge size={13} /> },
  { id: 'proofs', label: 'Section', icon: <Layers size={13} /> },
  { id: 'stress', label: 'Stress', icon: <ShieldAlert size={13} /> },
];

export const App: React.FC = () => {
  const [activeScene, setActiveScene] = useState<SceneId>('scene_a_bridge');
  const [currentView, setCurrentView] = useState<AppView>('hook_3d');
  // Scene data: precomputed snapshot first (static, no backend needed), upgraded to the live API when it has data.
  const { data: sceneData, status: sceneStatus } = useSceneData(activeScene);
  const telemetryData = sceneData?.telemetry ?? null;
  const crossSectionData = sceneData?.crossSection ?? null;
  const isLoading = sceneStatus === 'loading';

  // 'pipeline' = the grid cells and raw returns the pipeline produced; 'concept' = the hand-built illustration.
  const [viewMode, setViewMode] = useState<RenderMode>('pipeline');
  const pipelineData = useMemo<PipelineData | null>(
    () =>
      sceneData && sceneData.cells.length > 0
        ? { cells: sceneData.cells, points: sceneData.points, groundZ: computeGroundZ(sceneData.cells) }
        : null,
    [sceneData],
  );
  const renderMode: RenderMode = viewMode === 'pipeline' && pipelineData ? 'pipeline' : 'concept';
  const isRealScene = activeScene.startsWith('real_');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);
  const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);
  const [activeTab, setActiveTab] = useState<DrawerTab>('displays');

  // Live UGV Kinematics
  const [carTelemetry, setCarTelemetry] = useState({
    speed: 0,
    heading: 0,
    x: 0,
    y: 0,
    z: -1.41,
  });
  const [resetSignal, setResetSignal] = useState<number>(0);
  // Fly-through: the route comes from the planner snapshot (only the bridge scene has one).
  const [flySignal, setFlySignal] = useState<number>(0);
  const [flying, setFlying] = useState<boolean>(false);
  const [route, setRoute] = useState<{ scene: SceneId; path: [number, number, number][] | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadPlanner(activeScene).then((d) => {
      if (!cancelled) setRoute({ scene: activeScene, path: d?.results.aware.path ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [activeScene]);
  const routePath = route?.scene === activeScene ? route.path : null;

  // Viewport & Shading controls
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('orbit');
  const [displayMode, setDisplayMode] = useState<DEMDisplayMode>('voxels');
  const [colorMode, setColorMode] = useState<ColorMapMode>('elevation');
  const [isWireframe, setIsWireframe] = useState<boolean>(false);
  const [showScaleBar] = useState<boolean>(false);

  // Playback & Replay timeline
  const [isPlaying, setIsPlaying] = useState<boolean>(() => !prefersReducedMotion());
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // ROS 2 Layer Visibility state
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>(DEFAULT_LAYERS);

  // SIH26053 §9.2 Defense Sensor Degradation Stress Mode
  const [stressMode, setStressMode] = useState<StressModeId>('nominal');

  // Live Backend Connection & Throttling Telemetry
  const [backendPing, setBackendPing] = useState<number>(0);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);

  // API health ping (status bar only). Scene data never depends on it: snapshots are static files. While the API is
  // down the ping backs off (see pollDelayMs).
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let misses = 0;
    const ping = async () => {
      if (document.visibilityState !== 'hidden') {
        const t0 = performance.now();
        const h = await fetchJson<{ status: string }>('/api/health', { timeoutMs: 3000 });
        if (!alive) return;
        const up = !!h && h.status === 'ONLINE';
        setIsBackendConnected(up);
        if (h) setBackendPing(Math.round(performance.now() - t0));
        misses = up ? 0 : misses + 1;
      }
      timer = setTimeout(ping, pollDelayMs(misses));
    };
    void ping();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  // The Map Inspector and Evidence code is fetched once the browser is idle, so switching views is instant.
  useEffect(() => prefetchViews(), []);

  // Readiness signal for the tour and tests: the active scene's data has finished loading.
  useEffect(() => {
    if (sceneStatus === 'ready') markReady('scene-data');
    else clearReady('scene-data');
    return () => clearReady('scene-data');
  }, [sceneStatus, activeScene]);

  // Global shortcuts: Space = play/pause, Left/Right = step 2 frames, R = reset, Esc = close the drawer.
  // Ignored while focus is on an interactive element so native Space/Enter behaviour still works, and while
  // something else (the tour, a dialog) owns the keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const interactive = !!el?.closest('input, textarea, select, button, a, [contenteditable="true"]');

      if (e.key === 'Escape') {
        if (isAppScope() && isSidebarOpen) setIsSidebarOpen(false);
        return;
      }
      if (e.key === '?' && isAppScope() && !el?.closest('input, textarea, select, [contenteditable="true"]')) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (!isAppScope() || interactive || currentView !== 'hook_3d') return;
      if (e.key === 'r' || e.key === 'R') {
        setResetSignal((p) => p + 1);
        setCameraMode('orbit');
        return;
      }
      if (renderMode === 'pipeline') return;
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
  }, [isSidebarOpen, currentView, renderMode]);

  // ---- public actions (the only way anything but the user's own clicks drives the app) ----
  const snapshotRef = useRef<AppSnapshot | null>(null);
  useLayoutEffect(() => {
    snapshotRef.current = {
      scene: activeScene,
      view: currentView,
      viewMode,
      cameraMode,
      displayMode,
      colorMode,
      drawerOpen: isSidebarOpen,
      drawerTab: activeTab,
      stressMode,
      playing: isPlaying,
      frame: currentFrame,
      inspector: getInspector(),
      theme: getThemePreference(),
    };
  });

  const changeViewMode = useCallback((mode: RenderMode) => {
    setViewMode(mode);
    // Each mode has its own meaning for the terrain/colour options, so reset them to that mode's defaults.
    setDisplayMode(mode === 'pipeline' ? 'voxels' : 'points');
    setColorMode('elevation');
  }, []);

  const selectScene = useCallback(
    (scene: SceneId) => {
      setActiveScene(scene);
      setCurrentFrame(0);
      setResetSignal((prev) => prev + 1);
      // A new scene invalidates the inspector's selection and any pending focus request.
      setInspector({ selectedKey: null, focus: null });
      // The real scene has no concept view, so never carry concept mode into it (there would be no control to leave it).
      if (sceneInfo(scene).kind === 'real' && snapshotRef.current?.viewMode === 'concept') changeViewMode('pipeline');
    },
    [changeViewMode],
  );

  const actions = useMemo<AppActions>(
    () => ({
      selectScene,
      setView: setCurrentView,
      changeViewMode,
      setColorMode,
      setCameraMode,
      setDisplayMode,
      openDrawer: (tab) => {
        if (tab) setActiveTab(tab);
        setIsSidebarOpen(true);
      },
      closeDrawer: () => setIsSidebarOpen(false),
      setPlaying: setIsPlaying,
      seekFrame: setCurrentFrame,
      setStressMode,
      getSnapshot: () => ({ ...(snapshotRef.current as AppSnapshot), inspector: getInspector(), theme: getThemePreference() }),
      restore: (s) => {
        setActiveScene(s.scene);
        setCurrentView(s.view);
        setViewMode(s.viewMode);
        setCameraMode(s.cameraMode);
        setDisplayMode(s.displayMode);
        setColorMode(s.colorMode);
        setIsSidebarOpen(s.drawerOpen);
        setActiveTab(s.drawerTab);
        setStressMode(s.stressMode);
        setIsPlaying(s.playing);
        setCurrentFrame(s.frame);
        replaceInspector(s.inspector);
        setThemePreference(s.theme, { persist: false });
      },
    }),
    [selectScene, changeViewMode],
  );

  const terrainOptions = drawOptionsFor(renderMode);
  const sceneLabel = sceneInfo(activeScene).label;

  const appData = useMemo(() => ({ scene: activeScene, sceneData }), [activeScene, sceneData]);

  return (
    <AppActionsContext.Provider value={actions}>
      <AppDataContext.Provider value={appData}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <Header
          onSelectScene={selectScene}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((o) => !o)}
          dataSource={sceneData?.source ?? null}
          dataStatus={sceneStatus}
          snapshotMeta={sceneData?.meta ?? null}
          currentView={currentView}
          onViewChange={setCurrentView}
        />

        {/* Main workspace */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          {currentView === 'evidence' ? (
            <ViewBoundary resetKey={currentView}>
              <Suspense fallback={<ViewLoading label="Loading evidence…" />}>
                <EvidenceView baselines={telemetryData?.baselines ?? null} />
              </Suspense>
            </ViewBoundary>
          ) : currentView === 'data_inspection' ? (
            <ViewBoundary resetKey={currentView}>
              <Suspense fallback={<ViewLoading label="Loading map inspector…" />}>
                <DataInspectionScreen
                  activeScene={activeScene}
                  telemetryData={telemetryData}
                  sceneData={sceneData}
                  isLoading={isLoading}
                  onBackToHook={() => setCurrentView('hook_3d')}
                  onOpenEvidence={() => setCurrentView('evidence')}
                />
              </Suspense>
            </ViewBoundary>
          ) : (
            <main style={{ flex: 1, height: '100%', position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <h1 className="sr-only">3D Explore</h1>
              <ViewBoundary resetKey={currentView}>
                <Suspense fallback={<ViewLoading label="Loading 3D view…" />}>
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
                    renderMode={renderMode}
                    pipelineData={pipelineData}
                    flightPath={routePath}
                    flySignal={flySignal}
                    onFlightChange={setFlying}
                  />
                </Suspense>
              </ViewBoundary>

              {/* Top-left stack: scene switcher, view mode, provenance stamp, scene card. One column, so nothing can
                  overlap at any viewport width, and the provenance stamp is always visible. */}
              <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2.5 pointer-events-none max-w-[calc(100%-2rem)]">
                <div
                  role="group"
                  aria-label="Scenes"
                  data-tour="scenes"
                  className="pointer-events-auto max-w-full overflow-x-auto bg-panel/90 backdrop-blur-md border border-line rounded-full px-1.5 py-1 shadow-lg flex items-center gap-0.5 text-fg"
                >
                  {SCENES.map((s) => {
                    const isActive = activeScene === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => selectScene(s.id)}
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

                {pipelineData && !isRealScene && (
                  <div
                    role="group"
                    aria-label="What the 3D view shows"
                    data-tour="mode-toggle"
                    className="pointer-events-auto flex rounded-full border border-line bg-panel/90 p-0.5 text-[11px] font-semibold shadow-sm backdrop-blur-md"
                  >
                    {(['pipeline', 'concept'] as RenderMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => changeViewMode(m)}
                        aria-pressed={viewMode === m}
                        title={
                          m === 'pipeline'
                            ? 'The grid cells and raw returns the pipeline produced for this scan'
                            : 'A hand-built illustration of the scenario (not pipeline output)'
                        }
                        className={`rounded-full px-3 py-1 whitespace-nowrap transition-colors ${
                          viewMode === m ? 'bg-accent text-accent-on' : 'text-fg-2 hover:text-fg'
                        }`}
                      >
                        {m === 'pipeline' ? 'Pipeline output' : 'Concept view'}
                      </button>
                    ))}
                  </div>
                )}

                <span
                  data-region="provenance"
                  data-tour="provenance"
                  className={`pointer-events-auto px-2.5 py-1 rounded-md font-mono text-[10px] font-bold shadow-sm tracking-wider uppercase border ${
                    renderMode === 'concept'
                      ? 'bg-warn-bg text-warn-fg border-warn-line'
                      : isRealScene
                        ? 'bg-good-bg text-good-fg border-good-line'
                        : 'bg-accent-subtle text-accent-text border-accent-line'
                  }`}
                >
                  {renderMode === 'concept'
                    ? isRealScene
                      ? 'Real recording · sample points'
                      : 'Concept illustration · hand-built'
                    : isRealScene
                      ? sceneData?.meta?.note?.includes('Sparse')
                        ? 'Real recording · SemanticKITTI · sparse sample · dataset labels'
                        : 'Real recording · SemanticKITTI seq 08 · dataset labels'
                      : 'Synthetic scan · pipeline output'}
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
                  renderMode={renderMode}
                  onFly={routePath && renderMode === 'pipeline' ? () => setFlySignal((n) => n + 1) : undefined}
                  flying={flying}
                />
              </div>

              <ViewportLegend renderMode={renderMode} colorMode={colorMode} cells={sceneData?.cells ?? []} />

              {/* Bottom-right: illustrative replay in concept mode; a plain note in pipeline mode (one scan, no timeline) */}
              {renderMode === 'concept' ? (
                <ReplayWidget
                  isPlaying={isPlaying}
                  onIsPlayingChange={setIsPlaying}
                  currentFrame={currentFrame}
                  onFrameSeek={setCurrentFrame}
                  playbackSpeed={playbackSpeed}
                  onPlaybackSpeedChange={setPlaybackSpeed}
                />
              ) : (
                <div
                  data-region="replay"
                  className="absolute bottom-4 right-4 z-20 w-80 max-w-[calc(100%-2rem)] rounded-xl border border-line-strong bg-panel p-4 text-xs text-fg-2 shadow-xl"
                >
                  <div className="mb-1 font-bold uppercase tracking-wider text-fg">Single scan</div>
                  <p className="leading-relaxed">
                    This is one LiDAR scan run through the pipeline, not a recording in time, so there is nothing to play
                    back. The vehicle model marks the sensor position.
                  </p>
                </div>
              )}
            </main>
          )}

          {/* Slide-out Controls drawer */}
          <aside id="controls-drawer" data-region="drawer" aria-label="Controls" className={`telemetry-drawer ${isSidebarOpen ? 'open' : 'closed'}`}>
            <div className="p-4 border-b border-line flex items-center justify-between bg-panel">
              <div>
                <div className="text-xs font-bold text-fg tracking-wider uppercase">Controls</div>
                <div className="text-[11px] text-fg-muted">{sceneLabel}</div>
              </div>

              <button
                onClick={() => setIsSidebarOpen(false)}
                aria-label="Close controls"
                className="p-1.5 rounded-lg border border-line text-fg-muted hover:text-fg hover:bg-subtle transition-colors"
                title="Close (Esc)"
              >
                <X size={16} />
              </button>
            </div>

            <div role="tablist" aria-label="Controls" className="flex border-b border-line bg-panel p-2 gap-1">
              {DRAWER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  id={`drawer-tab-${tab.id}`}
                  role="tab"
                  data-tour={`drawer-tab-${tab.id}`}
                  aria-selected={activeTab === tab.id}
                  aria-controls={`drawer-panel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === tab.id ? 'bg-accent text-accent-on shadow-sm' : 'text-fg-2 hover:bg-subtle hover:text-fg'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div
              id={`drawer-panel-${activeTab}`}
              role="tabpanel"
              aria-labelledby={`drawer-tab-${activeTab}`}
              className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-fg bg-subtle"
            >
              {/* Layers: what the 3D view draws, plus overlays. Camera and colour live on the scene card. */}
              {activeTab === 'displays' && (
                <div className="flex flex-col gap-4">
                  <div data-tour="draw-mode" className="bg-panel border border-line-strong rounded-xl p-4 shadow-sm flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-fg uppercase tracking-wide">
                      {renderMode === 'pipeline' ? 'What to draw' : 'Terrain'}
                    </span>
                    <div role="radiogroup" aria-label="What to draw" className="flex flex-col gap-1.5">
                      {terrainOptions.map((grid) => {
                        const isSelected = displayMode === grid.id;
                        return (
                          <button
                            key={grid.id}
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => setDisplayMode(grid.id)}
                            className={`p-2.5 rounded-xl text-left border transition-all flex items-center justify-between apple-press ${
                              isSelected
                                ? 'bg-accent-subtle text-fg border-accent shadow-sm'
                                : 'bg-subtle text-fg-2 border-line hover:border-line-strong'
                            }`}
                          >
                            <div className="flex flex-col">
                              <span className="text-xs font-bold">{grid.label}</span>
                              <span className="text-[10px] text-fg-muted">{grid.desc}</span>
                            </div>
                            <div
                              aria-hidden="true"
                              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${isSelected ? 'border-accent bg-panel' : 'border-line-strong'}`}
                            >
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <DisplaysPanel
                    layers={layerVisibility}
                    renderMode={renderMode}
                    onToggleLayer={(k) => setLayerVisibility((prev) => ({ ...prev, [k]: !prev[k] }))}
                    onResetLayers={() => setLayerVisibility(DEFAULT_LAYERS)}
                  />
                </div>
              )}

              {/* Vehicle model telemetry */}
              {activeTab === 'telemetry' && (
                <div className="flex flex-col gap-4">
                  <div className="bg-panel border border-line rounded-xl p-4 shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between items-center border-b border-line pb-2">
                      <div className="text-xs font-bold text-fg uppercase flex items-center gap-1.5">
                        <Gauge size={14} className="text-fg" />
                        <span>Vehicle model (simulated)</span>
                      </div>
                      <button
                        onClick={() => {
                          setResetSignal((prev) => prev + 1);
                          setCameraMode('orbit');
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md border border-line text-fg-2 hover:bg-subtle font-mono text-[10px] font-semibold transition-colors"
                        title="Reset the vehicle and camera (R)"
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
                        <div className="text-lg font-bold font-mono text-fg">{carTelemetry.heading.toFixed(0)}&deg;</div>
                      </div>
                    </div>

                    <div className="bg-subtle p-2 rounded-lg border border-line/80 flex justify-between font-mono text-xs">
                      <span className="text-fg-muted">COORDINATES</span>
                      <span className="text-fg font-semibold">
                        X: {carTelemetry.x.toFixed(2)}m &bull; Y: {carTelemetry.y.toFixed(2)}m &bull; Z: {carTelemetry.z.toFixed(2)}m
                      </span>
                    </div>

                    <div className="p-3 bg-subtle rounded-lg border border-line-strong text-xs text-fg-2 leading-relaxed">
                      <strong className="text-fg block mb-1">An illustration, not a drive.</strong>
                      In the Concept view the vehicle follows a hand-built loop. These values describe that loop; they are not planner
                      output or a recording. Use Playback in the Concept view to pause or scrub.
                    </div>
                  </div>

                  <div className="bg-panel border border-line rounded-xl p-4 shadow-sm flex flex-col gap-3">
                    <div className="text-xs font-bold text-fg uppercase flex items-center gap-1.5 border-b border-line pb-2">
                      <ShieldCheck size={14} className="text-fg" />
                      <span>Memory</span>
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

              {/* Section: clearance slicer. Benchmark figures live on the Evidence page. */}
              {activeTab === 'proofs' && (
                <div className="flex flex-col gap-3">
                  <InteractiveCrossSection data={crossSectionData} sceneId={activeScene} />
                  <div className="bg-panel border border-line rounded-xl p-4 flex flex-col gap-2 text-xs text-fg-2">
                    <span className="font-semibold text-fg">Memory, accuracy, speed, regret</span>
                    <p className="leading-relaxed">
                      These are computed offline and shown on the Evidence page, each with its source file.
                    </p>
                    <button
                      onClick={() => {
                        setCurrentView('evidence');
                        setIsSidebarOpen(false);
                      }}
                      className="self-start px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-accent-on font-semibold"
                    >
                      Open Evidence &rarr;
                    </button>
                  </div>
                </div>
              )}

              {/* Stress: dropout preview (SIH26053 §9.2) */}
              {activeTab === 'stress' && <StressHarnessPanel activeStressMode={stressMode} onSelectStressMode={setStressMode} />}
            </div>

            <div className="shrink-0 border-t border-line bg-panel px-4 py-2">
              <button
                onClick={() => setShortcutsOpen(true)}
                className="flex items-center gap-2 rounded text-xs font-semibold text-fg-2 transition-colors hover:text-fg"
              >
                <Keyboard size={14} aria-hidden="true" />
                <span>Keyboard shortcuts</span>
                <kbd className="rounded border border-line-strong bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-fg">?</kbd>
              </button>
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
            LABELS: <strong className="text-fg">{sceneData?.meta?.label_source ?? 'n/a'}</strong>
          </span>
        </footer>

        {shortcutsOpen && <ShortcutsSheet onClose={closeShortcuts} />}
      </div>
      </AppDataContext.Provider>
    </AppActionsContext.Provider>
  );
};

export default App;
