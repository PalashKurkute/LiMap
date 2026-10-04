import React from 'react';

// A view that fails (its code could not be fetched after a new deploy or a dropped connection, or it threw while
// rendering) must not blank the whole app: the header, scene picker and the other views keep working, and this says what
// happened. React.lazy keeps a failed load as failed, and a browser may cache a failed module fetch for the life of the
// page, so the dependable recovery is a reload. The boundary clears itself when the user switches to another view
// (`resetKey`).

interface Props {
  resetKey: string;
  children: React.ReactNode;
}

interface State {
  failed: boolean;
  key: string;
}

export class ViewBoundary extends React.Component<Props, State> {
  state: State = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }

  componentDidCatch(error: unknown) {
    console.error('A view failed to load or render', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <p className="max-w-sm text-sm text-fg-2">
          This view could not be loaded. If the dashboard was just updated, reloading the page fixes it. The other views still work.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-on shadow-sm transition-colors hover:bg-accent/90"
        >
          Reload
        </button>
      </div>
    );
  }
}
