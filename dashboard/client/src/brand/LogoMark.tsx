/**
 * The LiMap mark: a lotus. Each petal row is a height layer of the 2.5D grid, the rows open outward like the resolution
 * rings (fine near the centre, coarse far away), the green leaves and water line stand for the ground, and the small dot at
 * the base is the vehicle. Colours are theme tokens. public/favicon.svg is generated from the same numbers
 * (scripts/make-logo.mjs), so keep PETALS in step with it.
 */
import React from 'react';

const BASE = { x: 32, y: 49 };

type Tone = 'leaf' | 'outer' | 'mid' | 'centre';
const FILL: Record<Tone, string> = {
  leaf: 'var(--brand-green)',
  outer: 'var(--brand-saffron)',
  mid: 'var(--brand-saffron-soft)',
  centre: 'var(--brand-cream)',
};

const PETALS: { tone: Tone; angle: number; len: number; wid: number }[] = [
  { tone: 'leaf', angle: -82, len: 20, wid: 8 },
  { tone: 'leaf', angle: 82, len: 20, wid: 8 },
  { tone: 'outer', angle: -56, len: 27, wid: 11 },
  { tone: 'outer', angle: 56, len: 27, wid: 11 },
  { tone: 'mid', angle: -28, len: 30, wid: 11 },
  { tone: 'mid', angle: 28, len: 30, wid: 11 },
  { tone: 'centre', angle: 0, len: 32, wid: 11.5 },
];

const n = (v: number) => +v.toFixed(2);
const petalPath = (len: number, wid: number) =>
  `M0 0C${n(-wid * 0.9)} ${n(-len * 0.25)} ${n(-wid * 0.55)} ${n(-len * 0.75)} 0 ${-len}C${n(wid * 0.55)} ${n(-len * 0.75)} ${n(wid * 0.9)} ${n(-len * 0.25)} 0 0Z`;

interface LogoMarkProps {
  size?: number;
  className?: string;
  /** Leave unset for a purely decorative mark (it is then hidden from assistive technology). */
  title?: string;
}

const LogoMark: React.FC<LogoMarkProps> = ({ size = 28, className, title }) => (
  <svg
    viewBox="0 0 64 64"
    width={size}
    height={size}
    className={className}
    role={title ? 'img' : undefined}
    aria-label={title}
    aria-hidden={title ? undefined : true}
    focusable="false"
  >
    <g strokeLinejoin="round" strokeWidth={0.7} style={{ stroke: 'var(--panel)' }}>
      {PETALS.map((p) => (
        <path
          key={`${p.tone}${p.angle}`}
          transform={`translate(${BASE.x} ${BASE.y}) rotate(${p.angle})`}
          d={petalPath(p.len, p.wid)}
          style={{ fill: FILL[p.tone] }}
        />
      ))}
    </g>
    <path d="M9 51.5Q20.5 47.5 32 51.5T55 51.5" fill="none" strokeWidth={2.4} strokeLinecap="round" style={{ stroke: 'var(--brand-green)' }} />
    <circle cx={BASE.x} cy={BASE.y + 0.5} r={2.7} strokeWidth={0.8} style={{ fill: 'var(--accent)', stroke: 'var(--panel)' }} />
  </svg>
);

export default LogoMark;
