/**
 * Error Boundary Integration Guide
 * 
 * This file demonstrates how to integrate the new error boundary system
 * into existing components throughout the application.
 */

import React from 'react';
import { ViewErrorBoundary } from './GranularErrorBoundary';
import { 
  ModalErrorBoundary, 
  FormErrorBoundary, 
  TableErrorBoundary,
  ChartErrorBoundary,
  MapErrorBoundary,
  AsyncDataErrorBoundary,
  withComponentErrorBoundary 
} from './ComponentErrorBoundaries';
import { useAsyncErrorHandler } from '../hooks/useAsyncErrorHandler';
import { withAsyncErrorHandling } from './withAsyncErrorHandling';

/**
 * Example 1: Wrapping Modal Components
 */

// Before: Basic modal without error boundary
/*
const ProjectEditorModal = ({ project, onSave, onClose }) => {
  return (
    <div className="modal">
      <form onSubmit={handleSubmit}>
        // ... form content
      </form>
    </div>
  );
};
*/

// After: Modal with error boundary
const ProjectEditorModal: React.FC<{
  project: any;
  onSave: (project: any) => void;
  onClose: () => void;
}> = ({ project, onSave, onClose }) => {
  return (
    <ModalErrorBoundary modalName="ProjectEditor">
      <div className="modal">
        <FormErrorBoundary 
          formName="ProjectForm"
          onError={(error) => {
            console.error('Form error in ProjectEditor:', error);
          }}
        >
          <form onSubmit={(e) => {
            e.preventDefault();
            // Handle form submission
          }}>
            {/* ... form content */}
          </form>
        </FormErrorBoundary>
      </div>
    </ModalErrorBoundary>
  );
};

/**
 * Example 2: Wrapping Data Tables
 */

// Before: Basic table without error boundary
/*
const TripsTable = ({ trips }) => {
  return (
    <table>
      {trips.map(trip => (
        <tr key={trip.id}>
          // ... table rows
        </tr>
      ))}
    </table>
  );
};
*/

// After: Table with error boundary and async error handling
const TripsTable: React.FC<{ trips: any[] }> = ({ trips }) => {
  const asyncHandler = useAsyncErrorHandler();

  const handleTripAction = async (tripId: string, action: string) => {
    await asyncHandler.executeAsync(
      async () => {
        // Simulate API call
        const response = await fetch(`/api/trips/${tripId}/${action}`, {
          method: 'POST',
        });
        return response.json();
      },
      `trip-${action}`,
      {
        showToast: true,
        maxRetries: 2,
        onSuccess: (result) => {
          console.log(`Trip ${action} successful:`, result);
        },
        onError: (error) => {
          console.error(`Trip ${action} failed:`, error);
        }
      }
    );
  };

  return (
    <TableErrorBoundary tableName="TripsTable">
      <table className="w-full">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Destino</th>
            <th>Distancia</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {trips.map(trip => (
            <tr key={trip.id}>
              <td>{trip.date}</td>
              <td>{trip.destination}</td>
              <td>{trip.distance}</td>
              <td>
                <button 
                  onClick={() => handleTripAction(trip.id, 'edit')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Editar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableErrorBoundary>
  );
};

/**
 * Example 3: Wrapping Interactive Maps
 */

// Before: Map component without error boundary
/*
const InteractiveMap = ({ routes }) => {
  return (
    <div id="map" style={{ height: '400px' }}>
      // ... Google Maps integration
    </div>
  );
};
*/

// After: Map with error boundary
const SafeInteractiveMap: React.FC<{ routes: any[] }> = ({ routes }) => {
  return (
    <MapErrorBoundary>
      <AsyncDataErrorBoundary 
        dataSource="GoogleMaps"
        onRetry={() => {
          // Handle map reload logic
          console.log('Retrying map load...');
        }}
      >
        <div id="map" style={{ height: '400px' }}>
          {/* Google Maps integration */}
        </div>
      </AsyncDataErrorBoundary>
    </MapErrorBoundary>
  );
};

/**
 * Example 4: Wrapping Chart Components
 */

// Before: Chart without error boundary
/*
const CO2Chart = ({ data }) => {
  return (
    <canvas id="co2-chart" width="400" height="200">
      // ... Chart.js integration
    </canvas>
  );
};
*/

// After: Chart with error boundary
const SafeCO2Chart: React.FC<{ data: any[] }> = ({ data }) => {
  return (
    <ChartErrorBoundary chartName="CO2Analysis">
      <canvas id="co2-chart" width="400" height="200">
        {/* Chart.js integration */}
      </canvas>
    </ChartErrorBoundary>
  );
};

/**
 * Example 5: Using HOC for Automatic Error Boundary Wrapping
 */

// Original component
const ExpenseUploadModal: React.FC<{ onUpload: (file: File) => void }> = ({ onUpload }) => {
  const asyncHandler = useAsyncErrorHandler();

  const handleFileUpload = async (file: File) => {
    await asyncHandler.executeAsync(
      async () => {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/expenses/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }
        
        return response.json();
      },
      'expense-upload',
      {
        showToast: true,
        maxRetries: 1,
        onSuccess: (result) => {
          onUpload(result);
        }
      }
    );
  };

  return (
    <div className="upload-modal">
      <input 
        type="file" 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFileUpload(file);
          }
        }}
        accept=".pdf,.jpg,.png"
      />
    </div>
  );
};

// Wrapped with HOC
const SafeExpenseUploadModal = withComponentErrorBoundary(
  ExpenseUploadModal,
  'ExpenseUploadModal',
  <div className="p-4 text-center text-red-600">
    <p>El componente de subida no está disponible.</p>
  </div>
);

/**
 * Example 6: View-Level Integration
 */

// Update existing view to use SafeViews
/*
// Before: In App.tsx
case 'dashboard':
  return <Dashboard setCurrentView={setCurrentView} personalization={personalization} theme={theme} />;

// After: In App.tsx
case 'dashboard':
  return <SafeDashboard setCurrentView={setCurrentView} personalization={personalization} theme={theme} />;
*/

/**
 * Example 7: Context Providers with Error Boundaries
 */

const SafeExpensesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AsyncDataErrorBoundary 
      dataSource="ExpensesContext"
      onRetry={() => {
        // Handle context data reload
        console.log('Retrying expenses context...');
      }}
    >
      {/* Original ExpensesProvider */}
      {children}
    </AsyncDataErrorBoundary>
  );
};

/**
 * Example 8: Service Integration with Error Handling
 */

// Enhanced service methods with error handling (using hook in components)
const useEnhancedProjectService = () => {
  const asyncHandler = useAsyncErrorHandler();
  
  return {
    async getProjects(userId: string) {
      return asyncHandler.executeAsync(
        async () => {
          const response = await fetch(`/api/projects?userId=${userId}`);
          if (!response.ok) throw new Error('Failed to fetch projects');
          return response.json();
        },
        'fetch-projects',
        {
          maxRetries: 3,
          timeout: 10000,
          onError: (error) => {
            console.error('Failed to fetch projects:', error);
          }
        }
      );
    },

    async createProject(projectData: any, userId: string) {
      return asyncHandler.executeAsync(
        async () => {
          const response = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...projectData, userId }),
          });
          if (!response.ok) throw new Error('Failed to create project');
          return response.json();
        },
        'create-project',
        {
          maxRetries: 1,
          showToast: true,
        }
      );
    },
  };
};

/**
 * Integration Checklist:
 * 
 * ✅ 1. Wrap all modals with ModalErrorBoundary
 * ✅ 2. Wrap all forms with FormErrorBoundary  
 * ✅ 3. Wrap all data tables with TableErrorBoundary
 * ✅ 4. Wrap all charts with ChartErrorBoundary
 * ✅ 5. Wrap maps with MapErrorBoundary
 * ✅ 6. Use AsyncDataErrorBoundary for async operations
 * ✅ 7. Replace view imports with SafeViews in App.tsx
 * ✅ 8. Update service methods to use useAsyncErrorHandler
 * ✅ 9. Add error boundaries to context providers
 * ✅ 10. Update root error boundary in index.tsx
 * 
 * Priority Areas to Update:
 * - ProjectEditorModal.tsx
 * - TripEditorModal.tsx  
 * - ExpenseUploadModal.tsx
 * - BatchEditModal.tsx
 * - GenerateReportModal.tsx
 * - InteractiveMap.tsx
 * - All dashboard charts
 * - Settings panels
 * - Calendar components
 */

export {
  ProjectEditorModal,
  TripsTable,
  SafeInteractiveMap,
  SafeCO2Chart,
  SafeExpenseUploadModal,
  SafeExpensesProvider,
  useEnhancedProjectService,
};