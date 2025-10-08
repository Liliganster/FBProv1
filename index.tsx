import React from 'react';
import ReactDOM from 'react-dom/client';
import Auth from './Auth';
import { TranslationProvider } from './i18n';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import './src/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <TranslationProvider>
        <ToastProvider>
          <AuthProvider>
            <Auth />
          </AuthProvider>
        </ToastProvider>
      </TranslationProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
