import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface ReplayWidgetProps {
  isPlaying: boolean;
  onIsPlayingChange: (playing: boolean) => void;
  currentFrame: number;
  onFrameSeek: (frame: number) => void;
  playbackSpeed: number;
  onPlaybackSpeedChange: (speed: number) => void;
}

export const ReplayWidget: React.FC<ReplayWidgetProps> = ({
  isPlaying,
  onIsPlayingChange,
  currentFrame,
  onFrameSeek,
  playbackSpeed,
  onPlaybackSpeedChange,
}) => {
  return (
    <div
      style={{ width: '320px', minWidth: '320px' }}
      data-region="replay" className="absolute bottom-6 right-6 bg-panel border border-line-strong rounded-2xl p-4 shadow-xl flex flex-col gap-3 z-20 select-none text-fg"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-fg">
          Mission Playback
        </span>
        <span className="text-[10px] font-mono text-fg-muted font-semibold bg-subtle border border-line px-2 py-0.5 rounded">
          Autonomous Nav
        </span>
      </div>

      {/* Transport Controls & Speed */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-line">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onFrameSeek(0)}
            className="p-1.5 rounded-lg border border-line-strong bg-subtle hover:bg-subtle text-fg-2 transition-colors"
            title="Rewind to start"
          >
            <RotateCcw size={13} />
          </button>

          <button
            onClick={() => onIsPlayingChange(!isPlaying)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-accent-on text-xs font-semibold shadow-sm transition-all active:scale-95"
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
        </div>

        {/* Speed Selector */}
        <div className="flex gap-1 text-[11px] font-mono">
          {([1, 2, 4] as const).map((spd) => (
            <button
              key={spd}
              onClick={() => onPlaybackSpeedChange(spd)}
              className={`px-2 py-0.5 rounded-md border transition-all ${
                playbackSpeed === spd
                  ? 'bg-accent border-line-strong text-accent-on font-semibold'
                  : 'bg-subtle border-line-strong text-fg-2 hover:bg-subtle'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Frame Scrubber */}
      <div className="flex flex-col gap-1.5 pt-1">
        <div className="flex justify-between items-center text-[10px] font-mono text-fg-muted font-medium">
          <span>Frame: {String(currentFrame).padStart(3, '0')} / 120</span>
          <span>+{(currentFrame * 0.033).toFixed(2)}s</span>
        </div>
        <div className="py-1">
          <input
            type="range"
            min={0}
            max={120}
            value={currentFrame}
            onChange={(e) => onFrameSeek(Number(e.target.value))}
            className="w-full h-1.5 bg-line rounded-lg appearance-none cursor-pointer accent-slate-900 block"
          />
        </div>
      </div>
    </div>
  );
};
