import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback; defaults to a small "reload" card. */
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-time exceptions so one broken view cannot take down the whole app.
 *
 * React 19 unmounts the entire root on an uncaught render error — which is how a
 * single undefined callback on the Coverage page produced a completely blank screen
 * (no sidebar, no error) for every user. See CHANGELOG 2026-09-03.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            padding: '2rem',
            fontFamily: 'system-ui, sans-serif',
            maxWidth: 560,
            margin: '4rem auto',
            textAlign: 'center',
          }}
        >
          <h2 style={{ marginBottom: '0.5rem' }}>Something went wrong on this screen.</h2>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>
            The rest of Fodda is fine. Reload to continue, and let us know if it keeps happening.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: 8,
              border: '1px solid #ccc',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
