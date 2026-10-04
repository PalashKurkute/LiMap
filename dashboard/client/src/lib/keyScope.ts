/**
 * Keyboard scopes. App-wide shortcuts (1-5, T, Space, arrows, R ...) only fire when no scope is pushed.
 * Anything that takes over the keyboard (the tour, a dialog) pushes a scope and MUST pop it in a `finally`
 * / effect cleanup, so shortcuts always come back, even if that thing throws.
 */
const stack: string[] = [];

export function pushScope(name: string): void {
  stack.push(name);
}

export function popScope(name: string): void {
  const i = stack.lastIndexOf(name);
  if (i >= 0) stack.splice(i, 1);
}

/** True when the main app owns the keyboard. */
export function isAppScope(): boolean {
  return stack.length === 0;
}
