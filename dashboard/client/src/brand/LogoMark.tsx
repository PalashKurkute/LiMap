/**
 * The LiMap mark: a LiDAR-scanning ground vehicle over a stepped 2.5D height grid. The artwork is a static SVG in
 * public/brand/ (limap-mark-light.svg / limap-mark-dark.svg, plus the full lockup with the wordmark in limap-logo-*.svg),
 * picked to match the theme like the team logo. The mark is wider than tall, so `size` sets its height.
 */
import React from 'react';
import { useTheme } from '../theme/theme';

/** Width / height of the mark's viewBox. */
const ASPECT = 820 / 596;

interface LogoMarkProps {
  size?: number;
  className?: string;
  /** Leave unset for a purely decorative mark (it is then hidden from assistive technology). */
  title?: string;
}

const LogoMark: React.FC<LogoMarkProps> = ({ size = 28, className, title }) => {
  const { theme } = useTheme();
  return (
    <img
      src={`/brand/limap-mark-${theme}.svg`}
      width={Math.round(size * ASPECT)}
      height={size}
      className={className}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      draggable={false}
    />
  );
};

export default LogoMark;
