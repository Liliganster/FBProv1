import React, { ReactNode } from 'react';
import { ComponentErrorBoundary, AsyncErrorBoundary } from './GranularErrorBoundary';

/**
 * Component-Level Error Boundaries
 * 
 * These specialized error boundaries protect critical UI components
 * from errors without affecting the entire view or application.
 * They provide granular error isolation for forms, modals, and async operations.
 */

/**
 * Modal Error Boundary
 * Prevents modal errors from crashing the parent view
 */
export const ModalErrorBoundary: React.FC<{
  children: ReactNode;
  modalName: string;
}> = ({ children, modalName }) => (
  <ComponentErrorBoundary
    componentName={`Modal:${modalName}`}
    fallback={
      <div className="flex flex-col items-center justify-center p-8 text-center bg-red-50 text-red-700 rounded-lg border border-red-200">
        <div className="text-3xl mb-3">⚠️</div>
        <h3 className="text-lg font-semibold mb-2">Error en Modal</h3>
        <p className="text-sm mb-4">
          El modal "{modalName}" no se puede mostrar correctamente.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
        >
          Recargar Página
        </button>
      </div>
    }
  >
    {children}
  </ComponentErrorBoundary>
);

/**
 * Form Error Boundary
 * Protects forms from rendering errors while preserving form state
 */
export const FormErrorBoundary: React.FC<{
  children: ReactNode;
  formName: string;
  onError?: (error: Error) => void;
}> = ({ children, formName, onError }) => (
  <ComponentErrorBoundary
    componentName={`Form:${formName}`}
    fallback={
      <div className="p-6 border border-orange-200 bg-orange-50 text-orange-700 rounded-lg">
        <div className="flex items-center mb-3">
          <div className="text-2xl mr-3">📝</div>
          <div>
            <h3 className="font-semibold">Error en Formulario</h3>
            <p className="text-sm">El formulario "{formName}" no se puede cargar.</p>
          </div>
        </div>
        <div className="text-sm text-orange-600">
          Por favor, recarga la página e intenta de nuevo.
        </div>
      </div>
    }
  >
    {children}
  </ComponentErrorBoundary>
);

/**
 * Data Table Error Boundary
 * Prevents table rendering errors from crashing the view
 */
export const TableErrorBoundary: React.FC<{
  children: ReactNode;
  tableName: string;
}> = ({ children, tableName }) => (
  <ComponentErrorBoundary
    componentName={`Table:${tableName}`}
    fallback={
      <div className="w-full p-8 border border-gray-200 bg-gray-50 text-gray-600 rounded-lg text-center">
        <div className="text-3xl mb-3">📊</div>
        <h3 className="font-semibold mb-2">Error en Tabla</h3>
        <p className="text-sm mb-4">
          La tabla "{tableName}" no se puede mostrar correctamente.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
        >
          Recargar Datos
        </button>
      </div>
    }
  >
    {children}
  </ComponentErrorBoundary>
);

/**
 * Chart/Visualization Error Boundary
 * Handles errors in data visualization components
 */
export const ChartErrorBoundary: React.FC<{
  children: ReactNode;
  chartName: string;
}> = ({ children, chartName }) => (
  <ComponentErrorBoundary
    componentName={`Chart:${chartName}`}
    fallback={
      <div className="w-full h-64 flex flex-col items-center justify-center border border-blue-200 bg-blue-50 text-blue-700 rounded-lg">
        <div className="text-4xl mb-3">📈</div>
        <h3 className="font-semibold mb-2">Error en Gráfico</h3>
        <p className="text-sm text-center px-4">
          El gráfico "{chartName}" no se puede renderizar.
        </p>
      </div>
    }
  >
    {children}
  </ComponentErrorBoundary>
);

/**
 * Map Error Boundary
 * Handles errors in map components (Google Maps, etc.)
 */
export const MapErrorBoundary: React.FC<{
  children: ReactNode;
}> = ({ children }) => (
  <ComponentErrorBoundary
    componentName="InteractiveMap"
    fallback={
      <div className="w-full h-96 flex flex-col items-center justify-center border border-green-200 bg-green-50 text-green-700 rounded-lg">
        <div className="text-5xl mb-4">🗺️</div>
        <h3 className="text-xl font-semibold mb-2">Error en Mapa</h3>
        <p className="text-sm text-center px-4 mb-4">
          El mapa interactivo no se puede cargar correctamente.
        </p>
        <p className="text-xs text-green-600">
          Verifica tu conexión a internet y las claves de API de Google Maps.
        </p>
      </div>
    }
  >
    {children}
  </ComponentErrorBoundary>
);

/**
 * File Upload Error Boundary
 * Protects file upload components from errors
 */
export const FileUploadErrorBoundary: React.FC<{
  children: ReactNode;
}> = ({ children }) => (
  <ComponentErrorBoundary
    componentName="FileUpload"
    fallback={
      <div className="p-4 border-2 border-dashed border-red-300 bg-red-50 text-red-700 rounded-lg text-center">
        <div className="text-2xl mb-2">📎</div>
        <p className="font-medium">Error en Subida de Archivos</p>
        <p className="text-sm mt-1">
          El componente de subida no está disponible.
        </p>
      </div>
    }
  >
    {children}
  </ComponentErrorBoundary>
);

/**
 * Settings Panel Error Boundary
 * Protects settings/configuration panels
 */
export const SettingsPanelErrorBoundary: React.FC<{
  children: ReactNode;
  panelName: string;
}> = ({ children, panelName }) => (
  <ComponentErrorBoundary
    componentName={`SettingsPanel:${panelName}`}
    fallback={
      <div className="p-4 border border-yellow-200 bg-yellow-50 text-yellow-700 rounded-lg">
        <div className="flex items-center">
          <div className="text-xl mr-3">⚙️</div>
          <div>
            <p className="font-medium">Panel de configuración no disponible</p>
            <p className="text-sm">"{panelName}" no se puede cargar.</p>
          </div>
        </div>
      </div>
    }
  >
    {children}
  </ComponentErrorBoundary>
);

/**
 * Async Data Error Boundary
 * Specifically for components that load data asynchronously
 */
export const AsyncDataErrorBoundary: React.FC<{
  children: ReactNode;
  dataSource: string;
  onRetry?: () => void;
}> = ({ children, dataSource, onRetry }) => (
  <AsyncErrorBoundary
    operationName={`AsyncData:${dataSource}`}
    onError={(error, errorInfo, errorDetails) => {
      console.error(`📡 Async Data Error [${dataSource}]:`, error);
      
      // Custom handling for specific error types
      if (error.message.includes('network') || error.message.includes('fetch')) {
        // Network error - might be temporary
        console.warn('Network error detected, will auto-retry');
      } else if (error.message.includes('unauthorized') || error.message.includes('403')) {
        // Auth error - redirect to login
        console.error('Auth error detected, user needs to re-authenticate');
      }
    }}
  >
    {children}
  </AsyncErrorBoundary>
);

/**
 * Calendar Component Error Boundary
 * Handles errors in calendar/date picker components
 */
export const CalendarErrorBoundary: React.FC<{
  children: ReactNode;
}> = ({ children }) => (
  <ComponentErrorBoundary
    componentName="Calendar"
    fallback={
      <div className="w-full p-6 border border-purple-200 bg-purple-50 text-purple-700 rounded-lg text-center">
        <div className="text-3xl mb-3">📅</div>
        <h3 className="font-semibold mb-2">Error en Calendario</h3>
        <p className="text-sm">
          El componente de calendario no se puede mostrar.
        </p>
      </div>
    }
  >
    {children}
  </ComponentErrorBoundary>
);

/**
 * Export/PDF Error Boundary
 * Handles errors in PDF generation and export functionality
 */
export const ExportErrorBoundary: React.FC<{
  children: ReactNode;
  exportType: string;
}> = ({ children, exportType }) => (
  <ComponentErrorBoundary
    componentName={`Export:${exportType}`}
    fallback={
      <div className="p-3 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded text-center">
        <div className="text-lg mb-1">📄</div>
        <p className="text-sm font-medium">Error en Exportación</p>
        <p className="text-xs">No se puede generar el {exportType}.</p>
      </div>
    }
  >
    {children}
  </ComponentErrorBoundary>
);

/**
 * Higher-Order Component for automatic component error boundary wrapping
 */
export const withComponentErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string,
  fallback?: ReactNode
) => {
  const WrappedComponent: React.FC<P> = (props) => (
    <ComponentErrorBoundary
      componentName={componentName}
      fallback={fallback}
    >
      <Component {...props} />
    </ComponentErrorBoundary>
  );

  WrappedComponent.displayName = `withComponentErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
};

/**
 * Hook for creating component-specific error boundaries
 */
export const useComponentErrorBoundary = (componentName: string, fallback?: ReactNode) => {
  const ErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
    <ComponentErrorBoundary
      componentName={componentName}
      fallback={fallback}
    >
      {children}
    </ComponentErrorBoundary>
  );

  return ErrorBoundary;
};