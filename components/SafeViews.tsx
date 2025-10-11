import React from 'react';
import { ViewErrorBoundary } from './GranularErrorBoundary';
import Dashboard from './Dashboard';
import ProjectsView from './ProjectsView';
import TripsView from './TripsView';
import ReportsView from './ReportsView';
import Settings from './Settings';
import CalendarView from './CalendarView';
import AdvancedView from './AdvancedView';
import RouteTemplatesView from './RouteTemplatesView';
import CO2RankingView from './CO2RankingView';
import ReportDetailView from './ReportDetailView';
import { View, PersonalizationSettings } from '../types';
import { Dispatch, SetStateAction } from 'react';

/**
 * View Components Wrapped with Error Boundaries
 * 
 * These wrapped components provide error isolation for major application views.
 * Each view has its own error boundary that prevents errors from propagating
 * to the app level and crashing the entire application.
 */

// Dashboard with error boundary
export const SafeDashboard: React.FC<{
  setCurrentView: (view: View) => void;
  personalization: PersonalizationSettings;
  theme: 'light' | 'dark';
}> = (props) => (
  <ViewErrorBoundary viewName="Dashboard">
    <Dashboard {...props} />
  </ViewErrorBoundary>
);

// Projects view with error boundary
export const SafeProjectsView: React.FC<{
  setCurrentView: (view: View) => void;
  personalization: PersonalizationSettings;
  theme: 'light' | 'dark';
}> = (props) => (
  <ViewErrorBoundary viewName="Projects">
    <ProjectsView {...props} />
  </ViewErrorBoundary>
);

// Trips view with error boundary
export const SafeTripsView: React.FC<{
  personalization: PersonalizationSettings;
  theme: 'light' | 'dark';
}> = (props) => (
  <ViewErrorBoundary viewName="Trips">
    <TripsView {...props} />
  </ViewErrorBoundary>
);

// Reports view with error boundary
export const SafeReportsView: React.FC<{
  personalization: PersonalizationSettings;
  theme: 'light' | 'dark';
}> = (props) => (
  <ViewErrorBoundary viewName="Reports">
    <ReportsView {...props} />
  </ViewErrorBoundary>
);

// Settings view with error boundary
export const SafeSettings: React.FC<{
  setCurrentView: (view: View) => void;
  personalization: PersonalizationSettings;
  setPersonalization: Dispatch<SetStateAction<PersonalizationSettings>>;
  theme: 'light' | 'dark';
}> = (props) => (
  <ViewErrorBoundary viewName="Settings">
    <Settings {...props} />
  </ViewErrorBoundary>
);

// Calendar view with error boundary
export const SafeCalendarView: React.FC<{
  setCurrentView: (view: View) => void;
  personalization: PersonalizationSettings;
  theme: 'light' | 'dark';
}> = (props) => (
  <ViewErrorBoundary viewName="Calendar">
    <CalendarView {...props} />
  </ViewErrorBoundary>
);

// Advanced view with error boundary
export const SafeAdvancedView: React.FC<{
  personalization: PersonalizationSettings;
  theme: 'light' | 'dark';
}> = (props) => (
  <ViewErrorBoundary viewName="Advanced">
    <AdvancedView {...props} />
  </ViewErrorBoundary>
);

// Route templates view with error boundary
export const SafeRouteTemplatesView: React.FC<{
  onBack: () => void;
  theme: 'light' | 'dark';
  personalization: PersonalizationSettings;
}> = (props) => (
  <ViewErrorBoundary viewName="RouteTemplates">
    <RouteTemplatesView {...props} />
  </ViewErrorBoundary>
);

// CO2 ranking view with error boundary
export const SafeCO2RankingView: React.FC<{
  onBack: () => void;
  theme: 'light' | 'dark';
  personalization: PersonalizationSettings;
}> = (props) => (
  <ViewErrorBoundary viewName="CO2Ranking">
    <CO2RankingView {...props} />
  </ViewErrorBoundary>
);

// Report detail view with error boundary
export const SafeReportDetailView: React.FC<{
  report: any; // Use proper type based on your report structure
  projects: any[]; // Use proper Project[] type
  onBack: () => void;
  theme: 'light' | 'dark';
  personalization: PersonalizationSettings;
}> = (props) => (
  <ViewErrorBoundary viewName="ReportDetail">
    <ReportDetailView {...props} />
  </ViewErrorBoundary>
);

/**
 * View Error Handler
 * 
 * Centralized error handler for view-level errors.
 * Provides consistent error reporting and analytics.
 */
export const viewErrorHandler = (error: Error, errorInfo: any, errorDetails: any) => {
  // Log view-level errors with context
  console.error(`🏗️ View Error [${errorDetails.component}]:`, {
    message: error.message,
    severity: errorDetails.severity,
    metadata: errorDetails.metadata,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
  });

  // Track view errors for analytics
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'exception', {
      description: `View Error: ${errorDetails.component} - ${error.message}`,
      fatal: false,
      custom_map: {
        view_name: errorDetails.component,
        error_severity: errorDetails.severity,
        error_id: errorDetails.metadata?.errorId,
      }
    });
  }

  // Report to monitoring service in production
  if (process.env.NODE_ENV === 'production') {
    // Here you would integrate with your error monitoring service
    // Example: Sentry, LogRocket, etc.
    
    // Simulated error reporting
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'view_error',
        component: errorDetails.component,
        message: error.message,
        severity: errorDetails.severity,
        errorId: errorDetails.metadata?.errorId,
        timestamp: errorDetails.metadata?.timestamp,
        url: window.location.href,
        userAgent: navigator.userAgent,
        stack: error.stack,
      }),
    }).catch(reportError => {
      console.warn('Failed to report view error:', reportError);
    });
  }
};

/**
 * Hook for creating view-specific error boundaries
 */
export const useViewErrorBoundary = (viewName: string) => {
  const ViewBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ViewErrorBoundary 
      viewName={viewName}
      onError={viewErrorHandler}
    >
      {children}
    </ViewErrorBoundary>
  );

  return ViewBoundary;
};

/**
 * Higher-Order Component for wrapping any component with a view error boundary
 */
export const withViewErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  viewName: string
) => {
  const WrappedComponent: React.FC<P> = (props) => (
    <ViewErrorBoundary 
      viewName={viewName}
      onError={viewErrorHandler}
    >
      <Component {...props} />
    </ViewErrorBoundary>
  );

  WrappedComponent.displayName = `withViewErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
};

/**
 * Error boundary specifically for navigation components
 */
export const NavigationErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ViewErrorBoundary 
    viewName="Navigation"
    onError={(error, errorInfo, errorDetails) => {
      // Navigation errors are critical - log them specially
      console.error('🧭 Navigation Error:', error);
      viewErrorHandler(error, errorInfo, errorDetails);
    }}
  >
    {children}
  </ViewErrorBoundary>
);