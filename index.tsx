import React from 'react';
import ReactDOM from 'react-dom/client';
import Auth from './Auth';
import { TranslationProvider } from './i18n';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { AppErrorBoundary } from './components/GranularErrorBoundary';
import { useUnhandledPromiseRejection } from './hooks/useAsyncErrorHandler';
import './src/index.css';
import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const SENTRY_ENVIRONMENT = import.meta.env.VITE_SENTRY_ENV || import.meta.env.MODE;
const SENTRY_RELEASE = typeof __COMMIT_HASH__ !== 'undefined' && __COMMIT_HASH__ ? __COMMIT_HASH__ : undefined;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0, // capture session only when an error happens
  });
}

// Component to initialize global error handling inside providers
const ErrorHandlerInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useUnhandledPromiseRejection();
  return <>{children}</>;
};

const AppWithErrorHandling: React.FC = () => {
  return (
    <TranslationProvider>
      <ToastProvider>
        <AuthProvider>
          <ErrorHandlerInitializer>
            <Auth />
          </ErrorHandlerInitializer>
        </AuthProvider>
      </ToastProvider>
    </TranslationProvider>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Avoid creating multiple roots in development
let root: ReactDOM.Root;
if ((rootElement as any)._reactRoot) {
  root = (rootElement as any)._reactRoot;
} else {
  root = ReactDOM.createRoot(rootElement);
  (rootElement as any)._reactRoot = root;
}

root.render(
  <AppErrorBoundary
    onError={(error, errorInfo, errorDetails) => {
      // Custom app-level error handler
      console.error('🚨 App-level error occurred:', {
        error: error.message,
        severity: errorDetails.severity,
        component: errorDetails.component,
        errorId: errorDetails.metadata?.errorId,
      });

      // Report critical errors to monitoring service
      if (errorDetails.severity === 'critical') {
        if (SENTRY_DSN) {
          Sentry.captureException(error, {
            tags: { component: errorDetails.component || 'unknown' },
            extra: { ...errorDetails, componentStack: errorInfo.componentStack },
          });
        }
        console.error('Critical error reported to monitoring service');
      }

      // Analytics tracking
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'exception', {
          description: `App Error: ${error.message}`,
          fatal: true,
          custom_map: {
            error_severity: errorDetails.severity,
            error_component: errorDetails.component,
            error_id: errorDetails.metadata?.errorId,
          }
        });
      }
    }}
  >
    <AppWithErrorHandling />
  </AppErrorBoundary>
);
