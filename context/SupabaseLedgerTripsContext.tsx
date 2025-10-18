import React, { createContext, ReactNode, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Trip, CallsheetFile, TripLedgerSource } from '../types';
import { useAuth } from '../hooks/useAuth';
import { createTripLedgerService, TripLedgerService } from '../services/supabaseTripLedgerService';
import { useProjects } from '../hooks/useProjects';
import useToast from '../hooks/useToast';

interface LedgerTripsContextType {
  trips: Trip[];
  loading: boolean;
  error: string | null;
  
  // Trip CRUD operations
  addTrip: (trip: Omit<Trip, 'id'>) => Promise<void>;
  updateTrip: (updatedTrip: Trip) => Promise<void>;
  deleteTrip: (tripId: string) => Promise<void>;
  deleteMultipleTrips: (tripIds: string[]) => Promise<void>;
  updateMultipleTrips: (tripIds: string[], updates: Partial<Omit<Trip, 'id'>>) => Promise<void>;
  addMultipleTrips: (newTrips: Omit<Trip, 'id'>[]) => Promise<void>;
  addCsvTrips: (drafts: Omit<Trip, 'id'>[]) => Promise<void>;
  
  // Project operations (proxied to ProjectsContext)
  projects: any[];
  addProject: (project: any) => Promise<void>;
  updateProject: (updatedProject: any) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  deleteMultipleProjects: (projectIds: string[]) => Promise<void>;
  
  // File operations
  addCallsheetToProject: (projectId: string, file: File) => Promise<void>;
  deleteCallsheetFromProject: (projectId: string, callsheetId: string) => Promise<void>;
  
  // CSV and bulk operations  
  downloadCsv: () => void;
  uploadCsv: (file: File) => Promise<void>;
  replaceAllTrips: (newTrips: Trip[]) => Promise<void>;
  replaceAllProjects: (newProjects: any[]) => Promise<void>;
  deleteAllData: () => Promise<void>;
  
  // Ledger-specific functions
  verifyLedgerIntegrity: () => Promise<{ isValid: boolean; errors: string[] }>;
  getRootHash: () => Promise<string | null>;
  refreshTrips: () => Promise<void>;
}

export const LedgerTripsContext = createContext<LedgerTripsContextType | undefined>(undefined);

export const LedgerTripsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  // Use ProjectsContext for project operations
  const projectsContext = useProjects();
  
  // State for trips from Supabase ledger
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Create ledger service instance
  const ledgerService = useMemo(() => {
    if (!user?.id) return null;
    return createTripLedgerService(user.id);
  }, [user?.id]);

  // Auto-migrate from localStorage on first load
  useEffect(() => {
    if (ledgerService && user?.id) {
      ledgerService.migrateFromLocalStorage().then(({ migrated, entriesCount }) => {
        if (migrated) {
          showToast(`Migrated ${entriesCount} trips to cloud storage`, 'success');
          refreshTrips();
        }
      }).catch(error => {
        console.error('Migration failed:', error);
      });
    }
  }, [ledgerService, user?.id, showToast]);

  // Load trips from ledger
  const refreshTrips = useCallback(async () => {
    if (!ledgerService) {
      setTrips([]);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const ledgerTrips = await ledgerService.getTrips();
      setTrips(ledgerTrips);
    } catch (err) {
      console.error('Error loading trips from ledger:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load trips';
      setError(errorMessage);
      showToast('Error loading trips', 'error');
    } finally {
      setLoading(false);
    }
  }, [ledgerService, showToast]);

  // Initial load and refresh on service change
  useEffect(() => {
    refreshTrips();
  }, [refreshTrips]);

  // ===== TRIP OPERATIONS =====

  const addTrip = useCallback(async (trip: Omit<Trip, 'id'>): Promise<void> => {
    if (!ledgerService) {
      throw new Error('Ledger service not available');
    }

    setLoading(true);
    try {
      await ledgerService.createTrip(trip, TripLedgerSource.MANUAL);
      await refreshTrips();
      showToast('Trip added successfully', 'success');
    } catch (err) {
      console.error('Error adding trip:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add trip';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [ledgerService, refreshTrips, showToast]);

  const updateTrip = useCallback(async (updatedTrip: Trip): Promise<void> => {
    if (!ledgerService) {
      throw new Error('Ledger service not available');
    }

    const originalTrip = trips.find(t => t.id === updatedTrip.id);
    if (!originalTrip) {
      throw new Error('Trip not found');
    }

    // Find changed fields using shallow comparison (avoid JSON.stringify)
    const changedFields = (Object.keys(updatedTrip) as (keyof Trip)[]).filter((key) => {
      if (key === 'hash' || key === 'previousHash' || key === 'id' || key === 'editJustification') return false;
      const oldVal = (originalTrip as Trip)[key] as unknown;
      const newVal = (updatedTrip as Trip)[key] as unknown;

      // Shallow compare arrays
      if (Array.isArray(oldVal) && Array.isArray(newVal)) {
        if (oldVal.length !== newVal.length) return true;
        for (let i = 0; i < oldVal.length; i++) {
          if (oldVal[i] !== newVal[i]) return true;
        }
        return false;
      }

      // Primitive and by-reference compare
      return oldVal !== newVal;
    });

    if (changedFields.length === 0) {
      return; // No changes
    }

    setLoading(true);
    try {
      const justification = (updatedTrip as any).editJustification || 'Trip updated';
      await ledgerService.amendTrip(
        updatedTrip.id,
        updatedTrip,
        justification,
        TripLedgerSource.MANUAL
      );
      await refreshTrips();
      showToast('Trip updated successfully', 'success');
    } catch (err) {
      console.error('Error updating trip:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update trip';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [ledgerService, trips, refreshTrips, showToast]);

  const deleteTrip = useCallback(async (tripId: string): Promise<void> => {
    if (!ledgerService) {
      throw new Error('Ledger service not available');
    }

    setLoading(true);
    try {
      await ledgerService.voidTrip(tripId, 'Trip deleted by user', TripLedgerSource.MANUAL);
      await refreshTrips();
      showToast('Trip deleted successfully', 'success');
    } catch (err) {
      console.error('Error deleting trip:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete trip';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [ledgerService, refreshTrips, showToast]);

  const deleteMultipleTrips = useCallback(async (tripIds: string[]): Promise<void> => {
    if (!ledgerService) {
      throw new Error('Ledger service not available');
    }

    setLoading(true);
    try {
      for (const tripId of tripIds) {
        await ledgerService.voidTrip(tripId, 'Batch delete by user', TripLedgerSource.MANUAL);
      }
      await refreshTrips();
      showToast(`${tripIds.length} trips deleted successfully`, 'success');
    } catch (err) {
      console.error('Error deleting multiple trips:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete trips';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [ledgerService, refreshTrips, showToast]);

  const updateMultipleTrips = useCallback(async (tripIds: string[], updates: Partial<Omit<Trip, 'id'>>): Promise<void> => {
    if (!ledgerService) {
      throw new Error('Ledger service not available');
    }

    setLoading(true);
    try {
      for (const tripId of tripIds) {
        const existingTrip = trips.find(t => t.id === tripId);
        if (existingTrip) {
          const updatedTrip = { ...existingTrip, ...updates };
          await ledgerService.amendTrip(
            tripId,
            updatedTrip,
            'Batch update by user',
            TripLedgerSource.MANUAL
          );
        }
      }
      await refreshTrips();
      showToast(`${tripIds.length} trips updated successfully`, 'success');
    } catch (err) {
      console.error('Error updating multiple trips:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update trips';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [ledgerService, trips, refreshTrips, showToast]);

  const addMultipleTrips = useCallback(async (newTrips: Omit<Trip, 'id'>[]): Promise<void> => {
    if (!ledgerService) {
      throw new Error('Ledger service not available');
    }

    setLoading(true);
    try {
      const { entries } = await ledgerService.importTripsBatch(newTrips, TripLedgerSource.BULK_UPLOAD);
      await refreshTrips();
      showToast(`${entries.length} trips imported successfully`, 'success');
    } catch (err) {
      console.error('Error adding multiple trips:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to import trips';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [ledgerService, refreshTrips, showToast]);

  const addCsvTrips = useCallback(async (drafts: Omit<Trip, 'id'>[]): Promise<void> => {
    if (!ledgerService) {
      throw new Error('Ledger service not available');
    }

    setLoading(true);
    try {
      const { entries } = await ledgerService.importTripsBatch(drafts, TripLedgerSource.CSV_IMPORT);
      await refreshTrips();
      showToast(`${entries.length} trips imported from CSV`, 'success');
    } catch (err) {
      console.error('Error importing CSV trips:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to import CSV trips';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [ledgerService, refreshTrips, showToast]);

  // ===== PROJECT OPERATIONS (Proxy to ProjectsContext) =====

  const addProject = useCallback(async (project: any): Promise<void> => {
    await projectsContext.addProject(project);
  }, [projectsContext]);

  const updateProject = useCallback(async (updatedProject: any): Promise<void> => {
    await projectsContext.updateProject(updatedProject.id, updatedProject);
  }, [projectsContext]);

  const deleteProject = useCallback(async (projectId: string): Promise<void> => {
    await projectsContext.deleteProject(projectId);
  }, [projectsContext]);

  const deleteMultipleProjects = useCallback(async (projectIds: string[]): Promise<void> => {
    await projectsContext.deleteSelectedProjects(projectIds);
  }, [projectsContext]);

  // ===== FILE OPERATIONS =====

  const addCallsheetToProject = useCallback(async (projectId: string, file: File): Promise<void> => {
    try {
      // Now handled by ProjectsContext which uploads to Supabase Storage
      await projectsContext.addCallsheetsToProject(projectId, [file]);
      showToast('Callsheet added successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add callsheet';
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [projectsContext, showToast]);

  const deleteCallsheetFromProject = useCallback(async (projectId: string, callsheetId: string): Promise<void> => {
    try {
      // Now handled by ProjectsContext which deletes from Supabase Storage
      await projectsContext.deleteCallsheetFromProject(projectId, callsheetId);
      showToast('Callsheet deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete callsheet';
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [projectsContext, showToast]);

  // ===== CSV AND BULK OPERATIONS =====

  const downloadCsv = useCallback(() => {
    const csvContent = generateCsvContent(trips);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `fahrtenbuch_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [trips]);

  const uploadCsv = useCallback(async (file: File): Promise<void> => {
    // Implementation would parse CSV and call addCsvTrips
    // For now, this is a placeholder
    showToast('CSV upload not yet implemented', 'error');
    throw new Error('CSV upload not yet implemented');
  }, [showToast]);

  const replaceAllTrips = useCallback(async (newTrips: Trip[]): Promise<void> => {
    if (!ledgerService) {
      throw new Error('Ledger service not available');
    }

    setLoading(true);
    try {
      // Clear existing ledger and import new trips
      await ledgerService.clearCache();
      const tripsWithoutId = newTrips.map(trip => {
        const { id, hash, previousHash, ...tripData } = trip;
        return tripData;
      });
      
      const { entries } = await ledgerService.importTripsBatch(tripsWithoutId, TripLedgerSource.BULK_UPLOAD);
      await refreshTrips();
      showToast(`Replaced with ${entries.length} trips`, 'success');
    } catch (err) {
      console.error('Error replacing trips:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to replace trips';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [ledgerService, refreshTrips, showToast]);

  const replaceAllProjects = useCallback(async (newProjects: any[]): Promise<void> => {
    await projectsContext.replaceAllProjects(newProjects);
  }, [projectsContext]);

  const deleteAllData = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      // Delete all trips from ledger
      if (ledgerService) {
        for (const trip of trips) {
          await ledgerService.voidTrip(trip.id, 'Delete all data operation', TripLedgerSource.MANUAL);
        }
      }
      
      // Delete all projects
      await projectsContext.deleteAllProjects();
      
      await refreshTrips();
      showToast('All data deleted successfully', 'success');
    } catch (err) {
      console.error('Error deleting all data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete all data';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [ledgerService, trips, projectsContext, refreshTrips, showToast]);

  // ===== LEDGER-SPECIFIC OPERATIONS =====

  const verifyLedgerIntegrity = useCallback(async (): Promise<{ isValid: boolean; errors: string[] }> => {
    if (!ledgerService) {
      return { isValid: false, errors: ['Ledger service not available'] };
    }

    try {
      const verification = await ledgerService.verifyLedger();
      return {
        isValid: verification.isValid,
        errors: verification.isValid ? [] : ['Ledger integrity check failed']
      };
    } catch (err) {
      console.error('Error verifying ledger:', err);
      return {
        isValid: false,
        errors: [err instanceof Error ? err.message : 'Verification failed']
      };
    }
  }, [ledgerService]);

  const getRootHash = useCallback(async (): Promise<string | null> => {
    if (!ledgerService) {
      return null;
    }

    try {
      const verification = await ledgerService.verifyLedger();
      return verification.rootHash;
    } catch (err) {
      console.error('Error getting root hash:', err);
      return null;
    }
  }, [ledgerService]);

  const contextValue: LedgerTripsContextType = {
    trips,
    loading: loading || projectsContext.loading,
    error: error || projectsContext.error,
    
    // Trip operations
    addTrip,
    updateTrip,
    deleteTrip,
    deleteMultipleTrips,
    updateMultipleTrips,
    addMultipleTrips,
    addCsvTrips,
    
    // Project operations (proxied)
    projects: projectsContext.projects,
    addProject,
    updateProject,
    deleteProject,
    deleteMultipleProjects,
    
    // File operations
    addCallsheetToProject,
    deleteCallsheetFromProject,
    
    // CSV and bulk operations
    downloadCsv,
    uploadCsv,
    replaceAllTrips,
    replaceAllProjects,
    deleteAllData,
    
    // Ledger-specific
    verifyLedgerIntegrity,
    getRootHash,
    refreshTrips
  };

  return (
    <LedgerTripsContext.Provider value={contextValue}>
      {children}
    </LedgerTripsContext.Provider>
  );
};

// Helper function to generate CSV content
function generateCsvContent(trips: Trip[]): string {
  const headers = ['Date', 'Origin', 'Destination', 'Distance', 'Project', 'Reason', 'Passengers'];
  const rows = trips.map(trip => [
    trip.date,
    trip.locations[0] || '',
    trip.locations[trip.locations.length - 1] || '',
    trip.distance.toString(),
    trip.projectId,
    trip.reason,
    (trip.passengers || 0).toString()
  ]);
  
  return [headers, ...rows].map(row => 
    row.map(field => `"${field.replace(/"/g, '""')}"`).join(',')
  ).join('\n');
}

export const useLedgerTrips = () => {
  const context = useContext(LedgerTripsContext);
  if (!context) {
    throw new Error('useLedgerTrips must be used within a LedgerTripsProvider');
  }
  return context;
};
