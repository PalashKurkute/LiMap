import React from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

interface ReplayWidgetProps {
  controlMode: 'wasd' | 'playback';
  onControlModeChange: (mode: 'wasd' | 'playback') => void;
  isPlaying: boolean;
  onIsPlayingChange: (playing: boolean) => void;
  currentFrame: number;
  onFrameSeek: (frame: number) => void;
  playbackSpeed: number;
  onPlaybackSpeedChange: (speed: number) => void;
}

export const ReplayWidget: React.FC<ReplayWidgetProps> = ({
  controlMode,
  onControlModeChange,
  isPlaying,
  onIsPlayingChange,
  currentFrame,
  onFrameSeek,
  playbackSpeed,
  onPlaybackSpeedChange,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        width: '360px',
        maxWidth: 'calc(100vw - 40px)',
        background: 'rgba(10, 14, 24, 0.90)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 1px rgba(0, 240, 255, 0.3)',
        zIndex: 25,
      }}
    >
      {/* Top Header: Title + Mode Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: 'var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            letterSpacing: '0.6px',
          }}
        >
          <Play size={14} />
          <span>REPLAY &amp; TIMELINE</span>
        </div>

        {/* Drive vs Replay Mode Toggle */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(0,0,0,0.5)',
            borderRadius: '5px',
            padding: '2px',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <button
            onClick={() => onControlModeChange('wasd')}
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              border: 'none',
              background: controlMode === 'wasd' ? 'rgba(0, 230, 118, 0.25)' : 'transparent',
              color: controlMode === 'wasd' ? 'var(--accent-emerald)' : 'var(--text-muted)',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Manual Drive
          </button>
          <button
            onClick={() => onControlModeChange('playback')}
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              border: 'none',
              background: controlMode === 'playback' ? 'rgba(0, 240, 255, 0.25)' : 'transparent',
              color: controlMode === 'playback' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Auto Replay
          </button>
        </div>
      </div>

      {/* Transport Controls & Speed Selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => onFrameSeek(0)}
            title="Rewind to Frame 0"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-muted)',
              borderRadius: '5px',
              cursor: 'pointer',
              padding: '5px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            <SkipBack size={13} />
          </button>

          <button
            onClick={() => {
              if (controlMode !== 'playback') onControlModeChange('playback');
              onIsPlayingChange(!isPlaying);
            }}
            title={isPlaying && controlMode === 'playback' ? 'Pause Replay' : 'Start Replay'}
            style={{
              background: isPlaying && controlMode === 'playback' ? 'rgba(0, 240, 255, 0.18)' : 'rgba(0, 240, 255, 0.12)',
              border: '1.5px solid var(--accent-cyan)',
              color: 'var(--accent-cyan)',
              borderRadius: '5px',
              cursor: 'pointer',
              padding: '5px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 600,
              transition: 'all 0.15s ease',
            }}
          >
            {isPlaying && controlMode === 'playback' ? <Pause size={13} /> : <Play size={13} />}
            <span>{isPlaying && controlMode === 'playback' ? 'Pause' : 'Play'}</span>
          </button>

          <button
            onClick={() => onFrameSeek(120)}
            title="Seek to Frame 120"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-muted)',
              borderRadius: '5px',
              cursor: 'pointer',
              padding: '5px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            <SkipForward size={13} />
          </button>
        </div>

        {/* Playback Speed Multipliers */}
        <div style={{ display: 'flex', gap: '3px' }}>
          {([1, 2, 4] as const).map((spd) => {
            const isSelected = playbackSpeed === spd;
            return (
              <button
                key={spd}
                onClick={() => onPlaybackSpeedChange(spd)}
                style={{
                  background: isSelected ? 'rgba(0, 240, 255, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${isSelected ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.08)'}`,
                  color: isSelected ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  borderRadius: '4px',
                  padding: '4px 7px',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {spd}x
              </button>
            );
          })}
        </div>
      </div>

      {/* Frame Scrubber Slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
          }}
        >
          <span>Frame: {String(currentFrame).padStart(3, '0')} / 120</span>
          <span style={{ color: 'var(--accent-cyan)' }}>Time: +{(currentFrame * 0.033).toFixed(2)}s</span>
        </div>
        <input
          type="range"
          min={0}
          max={120}
          value={currentFrame}
          onChange={(e) => {
            if (controlMode !== 'playback') onControlModeChange('playback');
            onFrameSeek(Number(e.target.value));
          }}
          style={{
            width: '100%',
            accentColor: 'var(--accent-cyan)',
            cursor: 'pointer',
            height: '4px',
          }}
        />
      </div>
    </div>
  );
};
