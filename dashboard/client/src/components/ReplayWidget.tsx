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
      className="absolute bottom-6 right-6 bg-white border border-slate-300 rounded-2xl p-4 shadow-xl flex flex-col gap-3 z-20 select-none text-slate-900"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
          Mission Playback
        </span>
        <span className="text-[10px] font-mono text-slate-500 font-semibold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
          Autonomous Nav
        </span>
      </div>

      {/* Transport Controls & Speed */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onFrameSeek(0)}
            className="p-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
            title="Rewind to start"
          >
            <RotateCcw size={13} />
          </button>

          <button
            onClick={() => onIsPlayingChange(!isPlaying)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
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
                  ? 'bg-slate-900 border-slate-900 text-white font-semibold'
                  : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Frame Scrubber */}
      <div className="flex flex-col gap-1.5 pt-1">
        <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 font-medium">
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
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900 block"
          />
        </div>
      </div>
    </div>
  );
};
