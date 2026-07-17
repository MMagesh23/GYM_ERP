import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Swap for a real error-reporting service (Sentry, etc.) when one is wired up.
    console.error('Unhandled UI error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-3 bg-gray-50 px-4 text-center dark:bg-gray-950">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-950/40">
            <AlertTriangle size={22} />
          </span>
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="max-w-sm text-sm text-gray-500">
            The app hit an unexpected error. Reloading usually fixes it — your data hasn't been affected.
          </p>
          <button
            onClick={this.handleReload}
            className="mt-2 flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <RefreshCw size={14} /> Reload app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;