import React, { useRef } from 'react';

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  /** Tooltip; also announced as the accessible description. */
  title?: string;
  disabled?: boolean;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (id: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * One-of-N control: a radiogroup with roving focus (arrows move and select, like native radios).
 * Used for colour modes, camera, projection and fovea presets so they all look and behave the same.
 */
export function Segmented<T extends string>({ value, options, onChange, ariaLabel, size = 'sm', className = '' }: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.filter((o) => !o.disabled);

  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    for (let step = 1; step <= options.length; step++) {
      const next = (idx + dir * step + options.length * step) % options.length;
      if (!options[next].disabled) {
        onChange(options[next].id);
        refs.current[next]?.focus();
        return;
      }
    }
  };

  const pad = size === 'md' ? 'px-3 py-1.5 text-xs' : 'px-2 py-1 text-[11px]';
  // Roving tabindex: the selected option is the tab stop (or the first enabled one if the value is not selectable).
  const tabStopId = enabled.some((o) => o.id === value) ? value : enabled[0]?.id;

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-0.5 rounded-lg border border-line bg-subtle p-0.5 ${className}`}
    >
      {options.map((o, i) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o.label}
            title={o.title}
            disabled={o.disabled}
            tabIndex={o.id === tabStopId ? 0 : -1}
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`${pad} rounded-md font-semibold whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              selected ? 'bg-accent text-accent-on shadow-xs' : 'text-fg-2 hover:text-fg hover:bg-line/60'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
