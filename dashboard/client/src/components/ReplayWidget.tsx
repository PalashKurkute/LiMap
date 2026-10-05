import { HelpTip } from '../ui/HelpTip';
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

const MAX_FRAME = 120;

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
      data-region="replay"
      data-tour="playback"
      className="absolute bottom-4 right-4 z-20 w-80 max-w-[calc(100%-2rem)] rounded-xl border border-line-strong bg-panel p-4 shadow-xl flex flex-col gap-3 select-none text-fg"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-fg">Playback</span>
          <HelpTip topic="playback" side="top" />
        </div>
        <span
          className="text-[10px] font-mono font-semibold rounded border border-warn-line bg-warn-bg px-2 py-0.5 text-warn-fg"
          title="The vehicle follows a hand-built loop. It is an illustration, not planner output or a recording."
        >
          Concept · illustrative drive
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-line">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onFrameSeek(0)}
            className="p-1.5 rounded-lg border border-line-strong bg-subtle text-fg-2 hover:text-fg transition-colors"
            aria-label="Rewind to start"
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

        <div role="group" aria-label="Playback speed" className="flex gap-1 text-[11px] font-mono">
          {([1, 2, 4] as const).map((spd) => (
            <button
              key={spd}
              onClick={() => onPlaybackSpeedChange(spd)}
              aria-pressed={playbackSpeed === spd}
              className={`px-2 py-0.5 rounded-md border transition-all ${
                playbackSpeed === spd
                  ? 'bg-accent border-line-strong text-accent-on font-semibold'
                  : 'bg-subtle border-line-strong text-fg-2 hover:text-fg'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 pt-1">
        <div className="flex justify-between items-center text-[10px] font-mono text-fg-muted font-medium">
          <span>
            Frame: {String(currentFrame).padStart(3, '0')} / {MAX_FRAME}
          </span>
          <span>+{(currentFrame * 0.033).toFixed(2)}s</span>
        </div>
        <div className="py-1">
          <input
            type="range"
            min={0}
            max={MAX_FRAME}
            value={currentFrame}
            onChange={(e) => onFrameSeek(Number(e.target.value))}
            aria-label="Playback position"
            aria-valuetext={`Frame ${currentFrame} of ${MAX_FRAME}`}
            className="w-full h-1.5 bg-line rounded-lg appearance-none cursor-pointer accent-accent block"
          />
        </div>
      </div>
    </div>
  );
};
