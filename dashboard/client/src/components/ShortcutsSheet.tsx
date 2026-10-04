import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { popScope, pushScope } from '../lib/keyScope';

// The keyboard shortcuts the app really handles (Header.tsx, App.tsx, DataInspectionScreen.tsx). Opened with `?`
// or from the Controls panel. While it is open it owns the keyboard, so nothing behind it reacts.

interface Group {
  title: string;
  rows: { keys: string[]; does: string }[];
}

const GROUPS: Group[] = [
  {
    title: 'Everywhere',
    rows: [
      { keys: ['1', '2', '3', '4', '5'], does: 'Switch scene' },
      { keys: ['T'], does: 'Open or close the Controls panel' },
      { keys: ['Shift', 'T'], does: 'Switch between light and dark' },
      { keys: ['?'], does: 'Show this list' },
      { keys: ['Esc'], does: 'Close the Controls panel or this list' },
    ],
  },
  {
    title: '3D Explore',
    rows: [
      { keys: ['R'], does: 'Reset the camera and the vehicle' },
      { keys: ['Space'], does: 'Play or pause the drive (Concept view)' },
      { keys: ['←', '→'], does: 'Step the drive back or forward (Concept view)' },
    ],
  },
  {
    title: 'Map Inspector',
    rows: [
      { keys: ['B'], does: 'Compare with the uniform 5 cm grid' },
      { keys: ['←', '↑', '→', '↓'], does: 'Pan the map (map focused)' },
      { keys: ['+', '-'], does: 'Zoom the map (map focused)' },
      { keys: ['0'], does: 'Reset the map view (map focused)' },
      { keys: ['←', '→'], does: 'Move the comparison divider (divider focused)' },
    ],
  },
];

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export const ShortcutsSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    pushScope('shortcuts');
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab') {
        // Keep focus inside the dialog.
        const items = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (!items || items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      popScope('shortcuts');
      opener?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <div
      data-region="shortcuts"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="w-full max-w-md max-h-full overflow-y-auto rounded-xl border border-line-strong bg-panel p-5 text-fg shadow-xl"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="shortcuts-title" className="text-sm font-bold tracking-tight">
            Keyboard shortcuts
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="rounded p-1 text-fg-muted transition-colors hover:bg-subtle hover:text-fg"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        {GROUPS.map((g) => (
          <section key={g.title} className="mt-4" aria-label={g.title}>
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-fg-muted">{g.title}</h3>
            <ul className="mt-1.5 divide-y divide-line">
              {g.rows.map((r) => (
                <li key={r.keys.join('+') + r.does} className="flex items-center justify-between gap-3 py-1.5 text-xs">
                  <span className="text-fg-2">{r.does}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {r.keys.map((k, i) => (
                      <kbd key={i} className="rounded border border-line-strong bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-fg">
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
};
