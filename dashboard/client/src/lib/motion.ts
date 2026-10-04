/** True when the user (or OS) asked for reduced motion. Read at call time so it reflects the current setting. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
