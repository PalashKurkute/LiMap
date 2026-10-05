import React, { useEffect, useId, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import type { SceneSnapshot } from '../types/telemetry';
import { HelpTip } from '../ui/HelpTip';
import { registerUpload } from '../data/snapshots';
import { analyzeScan, tooLargeMessage } from '../data/uploadScan';

/**
 * "Analyze your own scan": pick a .bin LiDAR file, the local API grids it, and the result becomes the "Your scan" scene.
 * Needs the API (the analysis runs on the server), so the button is truly disabled while the health ping says offline.
 * The scan is kept in memory only. The "?" sits beside the button, never inside anything disabled.
 */
interface AnalyzeScanProps {
  /** From the app's health ping. */
  apiOnline: boolean;
  /** The size limit the API published in /api/health, or null when it did not say (an older server). */
  maxScanBytes: number | null;
  /** Called after the analysed scan is stored; the app switches to it. */
  onAnalyzed: (snapshot: SceneSnapshot, fileName: string) => void;
}

type Status = { phase: 'idle' | 'running' | 'done' | 'error'; message: string };

export const AnalyzeScan: React.FC<AnalyzeScanProps> = ({ apiOnline, maxScanBytes, onAnalyzed }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const hintId = useId();
  const [status, setStatus] = useState<Status>({ phase: 'idle', message: '' });
  const running = status.phase === 'running';

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onChoose = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // so choosing the same file again fires another change
    if (!file) return;
    if (maxScanBytes != null && file.size > maxScanBytes) {
      setStatus({ phase: 'error', message: tooLargeMessage(file.size, maxScanBytes) });
      return;
    }
    setStatus({ phase: 'running', message: 'Analyzing...' });
    const result = await analyzeScan(file);
    if (!result.ok) {
      if (mounted.current) setStatus({ phase: 'error', message: result.message });
      return;
    }
    registerUpload(result.snapshot);
    if (mounted.current) setStatus({ phase: 'done', message: 'Your scan is ready.' });
    onAnalyzed(result.snapshot, file.name);
  };

  const visible = status.phase === 'running' || status.phase === 'error';

  return (
    <div data-region="upload" className="pointer-events-none flex max-w-full flex-col items-start gap-1.5">
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-line bg-panel/90 py-1 pl-1.5 pr-2.5 text-fg shadow-lg backdrop-blur-md">
        <input
          ref={inputRef}
          type="file"
          accept=".bin"
          hidden
          tabIndex={-1}
          aria-label="Choose a LiDAR scan file (.bin)"
          data-region="upload-input"
          onChange={(e) => void onChoose(e)}
        />
        <button
          type="button"
          disabled={!apiOnline || running}
          aria-busy={running}
          aria-describedby={apiOnline ? undefined : hintId}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold text-fg-2 transition-colors hover:bg-subtle hover:text-fg disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-fg-2"
        >
          <Upload size={13} aria-hidden="true" />
          <span>Analyze your own scan</span>
        </button>
        {!apiOnline && (
          <span id={hintId} className="whitespace-nowrap text-[11px] text-fg-2">
            Needs the local API running
          </span>
        )}
        <HelpTip topic="upload" />
      </div>

      {/* Always in the page so a screen reader announces the change; it only takes space while it has something to say. */}
      <div
        role="status"
        aria-live="polite"
        data-region="upload-status"
        className={
          visible
            ? `pointer-events-auto flex max-w-sm items-start gap-2 rounded-lg border px-2.5 py-1.5 text-xs shadow-lg backdrop-blur-md ${
                status.phase === 'error' ? 'border-critical-line bg-critical-bg text-critical-fg' : 'border-line bg-panel/90 text-fg-2'
              }`
            : 'sr-only'
        }
      >
        <span className="min-w-0 break-words">{status.phase === 'idle' ? '' : status.message}</span>
        {status.phase === 'error' && (
          <button
            type="button"
            aria-label="Dismiss this message"
            onClick={() => setStatus({ phase: 'idle', message: '' })}
            className="shrink-0 rounded p-0.5 text-critical-fg hover:bg-critical-line/40"
          >
            <X size={12} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};
