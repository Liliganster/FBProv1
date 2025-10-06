import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Global runtime error captured:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background-dark text-on-surface-dark p-6">
          <h1 className="text-2xl font-bold mb-4">Se ha producido un error</h1>
          <p className="mb-2 text-sm opacity-80">La aplicación encontró un problema inesperado.</p>
          {this.state.error && (
            <pre className="bg-black/40 text-red-300 p-4 rounded max-w-xl w-full overflow-auto text-xs mb-4 border border-red-500/30">
{this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 transition text-white text-sm"
          >
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
