import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../utils/errorReporting';
import { IconClipboard, IconWarning, IconWrench, IconClose, IconBrand } from './icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Called when the boundary resets (via resetKey change) or its default retry button. */
  onRetry?: () => void;
  /** Changing this value resets the boundary if it is in an error state. */
  resetKey?: unknown;
}

interface State {
  hasError: boolean;
  error: Error | null;
  resetKey: unknown;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  // Resets the boundary when `resetKey` changes while in an error state.
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (state.hasError && state.resetKey !== props.resetKey) {
      return { hasError: false, error: null, resetKey: props.resetKey };
    }
    if (!state.hasError && state.resetKey !== props.resetKey) {
      return { resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportError(error, `ErrorBoundary caught\n${errorInfo.componentStack ?? ''}`);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary-icon"><IconWarning width={48} height={48} /></div>
          <h2 className="error-boundary-title">Something went wrong</h2>
          <p className="error-boundary-message">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            type="button"
            className="error-boundary-retry"
            onClick={this.handleRetry}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Model List Error Boundary Fallback
export function ModelListFallback({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="error-boundary error-boundary--inline">
      <div className="error-boundary-icon"><IconClipboard width={48} height={48} /></div>
      <h3>Failed to load models</h3>
      <p>Unable to display the model list. Please try again.</p>
      <button
        type="button"
        className="error-boundary-retry"
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  );
}

// Sidebar Error Boundary Fallback
export function SidebarFallback({ onRetry }: { onRetry?: () => void }) {
  return (
    <aside className="sidebar sidebar--error">
      <div className="sidebar-header">
        <div className="brand">
          <IconBrand className="brand-icon" width={22} height={22} />
          <div>
            <div className="brand-name">BaseModel</div>
            <div className="brand-sub">Explorer</div>
          </div>
        </div>
      </div>
      <div className="sidebar-menu">
        <div className="error-boundary error-boundary--inline">
          <div className="error-boundary-icon"><IconWrench width={48} height={48} /></div>
          <h3>Sidebar unavailable</h3>
          <p>Provider filters could not be loaded.</p>
          <button
            type="button"
            className="error-boundary-retry"
            onClick={onRetry}
          >
            Try again
          </button>
        </div>
      </div>
    </aside>
  );
}

// Content Header Error Boundary Fallback
export function ContentHeaderFallback({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="content-header">
      <div className="header-left">
        <h2 className="content-title">Error</h2>
      </div>
      <div className="header-controls">
        <button type="button" className="retry-btn" onClick={onRetry}>↻ Retry</button>
      </div>
    </div>
  );
}

// Modal Error Boundary Fallback
export function ModalFallback({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" role="presentation">
      <div className="modal-content error-boundary error-boundary--inline" role="dialog" aria-modal="true">
        <button
          type="button"
          className="close-button"
          onClick={onClose}
          aria-label="Close error modal"
        >
          <IconClose width={14} height={14} />
        </button>
        <div className="modal-header">
          <h2 className="modal-title">Error</h2>
        </div>
        <div className="alt-list">
          <div className="error-boundary error-boundary--inline">
            <div className="error-boundary-icon"><IconWarning width={48} height={48} /></div>
            <h3>Failed to load model details</h3>
            <p>Could not display this model's details.</p>
            <button
              type="button"
              className="error-boundary-retry"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
