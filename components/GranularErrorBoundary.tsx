import React, { Component, ReactNode, ErrorInfo } from 'react';
import { logger } from '../lib/logger';

/**
 * Comprehensive Error Boundary System
 * 
 * Provides granular error boundaries with different levels of error handling:
 * - App Level: Catches fatal errors that would crash the entire app
 * - View Level: Catches errors in specific views/pages
 * - Component Level: Catches errors in individual components
 * - Async Level: Handles async operation errors
 * 
 * Features:
 * - Customizable fallback UIs
 * - Error reporting and logging
 * - Recovery mechanisms
 * - Error categorization
 * - User-friendly error messages
 */

export type ErrorLevel = 'app' | 'view' | 'component' | 'async';
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorDetails {
  level: ErrorLevel;
  severity: ErrorSeverity;
  component: string;
  action?: string;
  metadata?: Record<string, any>;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  retryCount: number;
}

export interface ErrorBoundaryProps {
  level: ErrorLevel;
  componentName: string;
  fallback?: ReactNode | ((error: Error, retry: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo, errorDetails: ErrorDetails) => void;
  maxRetries?: number;
  showErrorDetails?: boolean;
  isolate?: boolean; // If true, prevents error from bubbling up
  children: ReactNode;
}

/**
 * Enhanced Error Boundary with granular control
 */
export class GranularErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId?: number;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { level, componentName, onError } = this.props;
    
    // Update state with error info
    this.setState({ errorInfo });

    // Create error details
    const errorDetails: ErrorDetails = {
      level,
      severity: this.categorizeErrorSeverity(error, level),
      component: componentName,
      metadata: {
        errorId: this.state.errorId,
        retryCount: this.state.retryCount,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      },
    };

    // Log error
    this.logError(error, errorInfo, errorDetails);

    // Call custom error handler
    if (onError) {
      try {
        onError(error, errorInfo, errorDetails);
      } catch (handlerError) {
        logger.error('Error in custom error handler:', handlerError);
      }
    }

    // Report to external services (if configured)
    this.reportError(error, errorDetails);
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private categorizeErrorSeverity(error: Error, level: ErrorLevel): ErrorSeverity {
    // Network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return level === 'app' ? 'high' : 'medium';
    }
    
    // Auth errors
    if (error.message.includes('auth') || error.message.includes('unauthorized')) {
      return 'high';
    }
    
    // Render errors
    if (error.message.includes('render') || error.stack?.includes('render')) {
      return level === 'app' ? 'critical' : 'medium';
    }
    
    // Component level errors are usually less severe
    if (level === 'component') {
      return 'low';
    }
    
    // App level errors are more severe
    if (level === 'app') {
      return 'critical';
    }
    
    return 'medium';
  }

  private logError(error: Error, errorInfo: ErrorInfo, errorDetails: ErrorDetails) {
    const logLevel = errorDetails.severity === 'critical' || errorDetails.severity === 'high' 
      ? 'error' : 'warn';
    
    logger[logLevel](`🚨 Error Boundary [${errorDetails.level}/${errorDetails.severity}]:`, {
      error: error.message,
      component: errorDetails.component,
      errorId: errorDetails.metadata?.errorId,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  private reportError(error: Error, errorDetails: ErrorDetails) {
    // Here you would integrate with error reporting services
    // like Sentry, LogRocket, Bugsnag, etc.
    
    if (process.env.NODE_ENV === 'production' && errorDetails.severity !== 'low') {
      // Example: Sentry integration
      // Sentry.captureException(error, { extra: errorDetails });
      
      // Example: Custom analytics
      // analytics.track('Error Occurred', errorDetails.metadata);
      
      logger.debug('Error reported to external services');
    }
  }

  private retry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount < maxRetries) {
      logger.debug(`Retrying component render (attempt ${retryCount + 1}/${maxRetries})`);
      
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1,
      });
    } else {
      logger.warn('Max retries exceeded, giving up');
    }
  };

  private retryWithDelay = (delay: number = 1000) => {
    this.retryTimeoutId = window.setTimeout(() => {
      this.retry();
    }, delay);
  };

  private renderFallback(): ReactNode {
    const { fallback, level, componentName, showErrorDetails = false } = this.props;
    const { error, retryCount, errorId } = this.state;
    
    if (!error) return null;

    // Custom fallback
    if (fallback) {
      if (typeof fallback === 'function') {
        return fallback(error, this.retry);
      }
      return fallback;
    }

    // Default fallback based on level
    return this.renderDefaultFallback(level, error, componentName, retryCount, errorId, showErrorDetails);
  }

  private renderDefaultFallback(
    level: ErrorLevel,
    error: Error,
    componentName: string,
    retryCount: number,
    errorId: string,
    showErrorDetails: boolean
  ): ReactNode {
    const maxRetries = this.props.maxRetries || 3;

    switch (level) {
      case 'app':
        return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 text-red-900 p-6">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">💥</div>
              <h1 className="text-3xl font-bold mb-4">¡Oops! Algo salió mal</h1>
              <p className="text-lg mb-6">
                La aplicación encontró un error inesperado. Por favor recarga la página.
              </p>
              
              {showErrorDetails && (
                <details className="mb-4 text-left">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Detalles técnicos
                  </summary>
                  <pre className="mt-2 p-3 bg-red-100 rounded text-xs overflow-auto">
                    {error.message}
                    {error.stack && `\n\nStack:\n${error.stack}`}
                  </pre>
                </details>
              )}
              
              <div className="space-y-2">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                >
                  Recargar Aplicación
                </button>
                
                {retryCount < maxRetries && (
                  <button
                    onClick={this.retry}
                    className="w-full px-4 py-2 bg-red-200 text-red-800 rounded hover:bg-red-300 transition"
                  >
                    Reintentar ({retryCount + 1}/{maxRetries})
                  </button>
                )}
              </div>
              
              <p className="text-xs text-red-600 mt-4">
                ID del error: {errorId}
              </p>
            </div>
          </div>
        );

      case 'view':
        return (
          <div className="flex flex-col items-center justify-center min-h-96 bg-yellow-50 text-yellow-900 p-6 rounded-lg border border-yellow-200">
            <div className="text-center max-w-sm">
              <div className="text-4xl mb-3">⚠️</div>
              <h2 className="text-xl font-semibold mb-3">Error en la Vista</h2>
              <p className="mb-4">
                Esta sección de la aplicación no se puede cargar correctamente.
              </p>
              
              {showErrorDetails && (
                <details className="mb-4 text-left">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Ver detalles
                  </summary>
                  <pre className="mt-2 p-2 bg-yellow-100 rounded text-xs overflow-auto">
                    {error.message}
                  </pre>
                </details>
              )}
              
              <div className="space-y-2">
                {retryCount < maxRetries ? (
                  <button
                    onClick={this.retry}
                    className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition"
                  >
                    Reintentar
                  </button>
                ) : (
                  <button
                    onClick={() => window.history.back()}
                    className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition"
                  >
                    Volver Atrás
                  </button>
                )}
              </div>
            </div>
          </div>
        );

      case 'component':
        return (
          <div className="flex items-center justify-center p-4 bg-blue-50 text-blue-900 rounded border border-blue-200">
            <div className="text-center">
              <div className="text-2xl mb-2">🔧</div>
              <p className="font-medium mb-2">Componente no disponible</p>
              <p className="text-sm mb-3">
                El componente "{componentName}" no se puede cargar.
              </p>
              
              {retryCount < maxRetries && (
                <button
                  onClick={this.retry}
                  className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  Reintentar
                </button>
              )}
            </div>
          </div>
        );

      case 'async':
        return (
          <div className="flex items-center justify-center p-3 bg-orange-50 text-orange-900 rounded border border-orange-200">
            <div className="text-center">
              <div className="text-xl mb-1">📡</div>
              <p className="font-medium text-sm">Error de conexión</p>
              <button
                onClick={() => this.retryWithDelay(2000)}
                className="mt-2 text-xs px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 transition"
              >
                Reintentar en 2s
              </button>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-4 bg-gray-100 text-gray-700 rounded border">
            <p>Error desconocido en {componentName}</p>
            <button
              onClick={this.retry}
              className="mt-2 px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
            >
              Reintentar
            </button>
          </div>
        );
    }
  }

  render() {
    if (this.state.hasError) {
      return this.renderFallback();
    }

    return this.props.children;
  }
}

/**
 * Convenience components for specific use cases
 */

// App-level error boundary
export const AppErrorBoundary: React.FC<{
  children: ReactNode;
  onError?: ErrorBoundaryProps['onError'];
}> = ({ children, onError }) => (
  <GranularErrorBoundary
    level="app"
    componentName="Application"
    onError={onError}
    showErrorDetails={process.env.NODE_ENV === 'development'}
  >
    {children}
  </GranularErrorBoundary>
);

// View-level error boundary
export const ViewErrorBoundary: React.FC<{
  viewName: string;
  children: ReactNode;
  onError?: ErrorBoundaryProps['onError'];
}> = ({ viewName, children, onError }) => (
  <GranularErrorBoundary
    level="view"
    componentName={viewName}
    onError={onError}
    maxRetries={2}
    showErrorDetails={process.env.NODE_ENV === 'development'}
  >
    {children}
  </GranularErrorBoundary>
);

// Component-level error boundary
export const ComponentErrorBoundary: React.FC<{
  componentName: string;
  children: ReactNode;
  fallback?: ReactNode;
}> = ({ componentName, children, fallback }) => (
  <GranularErrorBoundary
    level="component"
    componentName={componentName}
    fallback={fallback}
    maxRetries={1}
    isolate={true}
  >
    {children}
  </GranularErrorBoundary>
);

// Async operation error boundary
export const AsyncErrorBoundary: React.FC<{
  operationName: string;
  children: ReactNode;
  onError?: ErrorBoundaryProps['onError'];
}> = ({ operationName, children, onError }) => (
  <GranularErrorBoundary
    level="async"
    componentName={operationName}
    onError={onError}
    maxRetries={3}
    isolate={true}
  >
    {children}
  </GranularErrorBoundary>
);