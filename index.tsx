import React from 'react';
import ReactDOM from 'react-dom/client';
import Auth from './Auth';
import { TranslationProvider } from './i18n';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { AppErrorBoundary } from './components/GranularErrorBoundary';
import { useUnhandledPromiseRejection } from './hooks/useAsyncErrorHandler';
import './src/index.css';

// Component to initialize global error handling
const AppWithErrorHandling: React.FC = () => {
  useUnhandledPromiseRejection();
  
  return (
    <TranslationProvider>
      <ToastProvider>
        <AuthProvider>
          <Auth />
        </AuthProvider>
      </ToastProvider>
    </TranslationProvider>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
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
        // Here you would integrate with your error monitoring service
        // Example: Sentry.captureException(error, { extra: errorDetails });
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
