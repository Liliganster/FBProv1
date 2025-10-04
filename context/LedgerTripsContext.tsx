import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Trip, Project, CallsheetFile, TripLedgerSource } from '../types';
import { saveFile, deleteFile, deleteMultipleFiles } from '../services/dbService';
import { useAuth } from '../hooks/useAuth';
import useLocalStorage from '../hooks/useLocalStorage';
import { useTripsLedger } from '../hooks/useTripsLedger';

interface LedgerTripsContextType {
  trips: Trip[];
  projects: Project[];
  addTrip: (trip: Omit<Trip, 'id'>) => Promise<void>;
  updateTrip: (updatedTrip: Trip) => Promise<void>;
  deleteTrip: (tripId: string) => Promise<void>;
  deleteMultipleTrips: (tripIds: string[]) => Promise<void>;
  updateMultipleTrips: (tripIds: string[], updates: Partial<Omit<Trip, 'id'>>) => Promise<void>;
  addMultipleTrips: (newTrips: Omit<Trip, 'id'>[]) => Promise<void>;
  addCsvTrips: (drafts: Omit<Trip, 'id'>[]) => Promise<void>;
  addProject: (project: Omit<Project, 'id'>) => void;
  updateProject: (updatedProject: Project) => void;
  deleteProject: (projectId: string) => Promise<void>;
  deleteMultipleProjects: (projectIds: string[]) => Promise<void>;
  addCallsheetsToProject: (projectId: string, files: File[]) => Promise<void>;
  deleteCallsheetFromProject: (projectId: string, callsheetId: string) => Promise<void>;
  replaceAllTripsAndProjects: (data: { trips: Trip[], projects: Project[] }) => Promise<void>;
  deleteAllTrips: () => Promise<void>;
  deleteAllProjects: () => Promise<void>;
  verifyTripHashes: () => Promise<{ ok: boolean, errors: { trip: Trip, reason: string }[] }>;
  // New ledger-specific functions
  verifyLedgerIntegrity: () => Promise<{ isValid: boolean; errors: string[] }>;
  getRootHash: () => Promise<string | null>;
}

export const LedgerTripsContext = createContext<LedgerTripsContextType | undefined>(undefined);

export const LedgerTripsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const projectsStorageKey = user ? `fahrtenbuch_projects_${user.id}` : null;
  
  // Still use localStorage for projects (they don't need immutability for now)
  const [projects, setProjects] = useLocalStorage<Project[]>(projectsStorageKey, []);
  
  // Use the ledger system for trips
  const {
    trips,
    createTrip,
    updateTrip: ledgerUpdateTrip,
    deleteTrip: ledgerDeleteTrip,
    verifyLedger
  } = useTripsLedger();

  // Compatibility layer - convert ledger functions to match old API
  const addTrip = async (trip: Omit<Trip, 'id'>): Promise<void> => {
    const newTrip = { ...trip, id: `trip-${Date.now()}-${Math.random()}` };
    await createTrip(newTrip);
  };

  const updateTrip = async (updatedTrip: Trip): Promise<void> => {
    const justification = (updatedTrip as any).editJustification || 'Updated via legacy API';
    const changedFields = ['*']; // Legacy API doesn't track specific fields
    await ledgerUpdateTrip(updatedTrip.id, updatedTrip, justification, changedFields);
  };

  const deleteTrip = async (tripId: string): Promise<void> => {
    await ledgerDeleteTrip(tripId, 'Deleted via legacy API');
  };

  const deleteMultipleTrips = async (tripIds: string[]): Promise<void> => {
    for (const tripId of tripIds) {
      await ledgerDeleteTrip(tripId, 'Batch delete via legacy API');
    }
  };

  const updateMultipleTrips = async (tripIds: string[], updates: Partial<Omit<Trip, 'id'>>): Promise<void> => {
    for (const tripId of tripIds) {
      const existingTrip = trips.find(t => t.id === tripId);
      if (existingTrip) {
        const updatedTrip = { ...existingTrip, ...updates };
        await ledgerUpdateTrip(tripId, updatedTrip, 'Batch update via legacy API', ['*']);
      }
    }
  };

  const addMultipleTrips = async (newTrips: Omit<Trip, 'id'>[]): Promise<void> => {
    for (const trip of newTrips) {
      const newTrip = { ...trip, id: `trip-${Date.now()}-${Math.random()}` };
      await createTrip(newTrip);
    }
  };

  const addCsvTrips = async (drafts: Omit<Trip, 'id'>[]): Promise<void> => {
    const existingProjectIds = new Set(projects.map(p => p.id));
    const newProjectsToCreate = new Map<string, Project>();

    // Create projects first if they don't exist
    const processedDrafts = drafts.map(draft => {
      if (existingProjectIds.has(draft.projectId)) {
        return draft;
      }
      const newProjectName = draft.projectId;
      let newProjectId: string;

      if (newProjectsToCreate.has(newProjectName)) {
        newProjectId = newProjectsToCreate.get(newProjectName)!.id;
      } else {
        const newProject: Project = {
          id: `proj-${Date.now()}-${Math.random()}`,
          name: newProjectName,
          producer: 'Imported via CSV',
          ratePerKm: undefined,
          callsheets: []
        };
        newProjectsToCreate.set(newProjectName, newProject);
        newProjectId = newProject.id;
      }

      return { ...draft, projectId: newProjectId };
    });

    // Add new projects to localStorage
    if (newProjectsToCreate.size > 0) {
      setProjects(prev => [...prev, ...Array.from(newProjectsToCreate.values())]);
    }

    // Add trips to ledger as a batch
    for (const draft of processedDrafts) {
      const newTrip = { ...draft, id: `trip-${Date.now()}-${Math.random()}` };
      await createTrip(newTrip);
    }
  };

  // Project management functions (unchanged - still using localStorage)
  const addProject = (project: Omit<Project, 'id'>) => {
    setProjects(prev => [...prev, { ...project, id: `proj-${Date.now()}-${Math.random()}`, callsheets: [] }]);
  };

  const updateProject = (updatedProject: Project) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
  };

  const deleteProject = async (projectId: string): Promise<void> => {
    const project = projects.find(p => p.id === projectId);
    if (project && project.callsheets && project.callsheets.length > 0) {
      await deleteMultipleFiles(project.callsheets.map(c => c.id));
    }
    setProjects(prev => prev.filter(p => p.id !== projectId));
    
    // Also delete all trips associated with this project
    const associatedTripIds = trips.filter(t => t.projectId === projectId).map(t => t.id);
    await deleteMultipleTrips(associatedTripIds);
  };

  const deleteMultipleProjects = async (projectIds: string[]): Promise<void> => {
    for (const projectId of projectIds) {
      await deleteProject(projectId);
    }
  };

  const addCallsheetsToProject = async (projectId: string, files: File[]): Promise<void> => {
    const callsheets: CallsheetFile[] = [];
    for (const file of files) {
      const callsheetId = `callsheet-${Date.now()}-${Math.random()}`;
      await saveFile(callsheetId, file);
      callsheets.push({
        id: callsheetId,
        name: file.name,
        type: file.type
      });
    }
    setProjects(prev => prev.map(project => 
      project.id === projectId 
        ? { ...project, callsheets: [...(project.callsheets || []), ...callsheets] }
        : project
    ));
  };

  const deleteCallsheetFromProject = async (projectId: string, callsheetId: string): Promise<void> => {
    await deleteFile(callsheetId);
    setProjects(prev => prev.map(project => 
      project.id === projectId 
        ? { ...project, callsheets: project.callsheets.filter(c => c.id !== callsheetId) }
        : project
    ));
  };

  const replaceAllTripsAndProjects = async (data: { trips: Trip[], projects: Project[] }): Promise<void> => {
    // Clear all existing data and replace
    await deleteAllTrips();
    setProjects(data.projects);
    
    // Add trips through ledger system
    for (const trip of data.trips) {
      await createTrip(trip);
    }
  };

  const deleteAllTrips = async (): Promise<void> => {
    const allTripIds = trips.map(t => t.id);
    await deleteMultipleTrips(allTripIds);
  };

  const deleteAllProjects = async (): Promise<void> => {
    const allFiles = projects.flatMap(p => (p.callsheets || []).map(c => c.id));
    if (allFiles.length > 0) {
      await deleteMultipleFiles(allFiles);
    }
    setProjects([]);
  };

  // Legacy hash verification - now delegates to ledger system
  const verifyTripHashes = async (): Promise<{ ok: boolean, errors: { trip: Trip, reason: string }[] }> => {
    const ledgerVerification = await verifyLedger();
    return {
      ok: ledgerVerification.isValid,
      errors: ledgerVerification.isValid ? [] : [
        {
          trip: trips[0] || {} as Trip, // Compatibility hack - old API expected trip objects
          reason: ledgerVerification.brokenChainAt ? `Chain broken at: ${ledgerVerification.brokenChainAt}` : 'Ledger verification failed'
        }
      ]
    };
  };

  const verifyLedgerIntegrity = async (): Promise<{ isValid: boolean; errors: string[] }> => {
    const result = await verifyLedger();
    return {
      isValid: result.isValid,
      errors: result.isValid ? [] : [
        result.brokenChainAt ? `Chain broken at: ${result.brokenChainAt}` : 'Ledger verification failed'
      ]
    };
  };

  const value: LedgerTripsContextType = {
    trips,
    projects,
    addTrip,
    updateTrip,
    deleteTrip,
    deleteMultipleTrips,
    updateMultipleTrips,
    addMultipleTrips,
    addCsvTrips,
    addProject,
    updateProject,
    deleteProject,
    deleteMultipleProjects,
    addCallsheetsToProject,
    deleteCallsheetFromProject,
    replaceAllTripsAndProjects,
    deleteAllTrips,
    deleteAllProjects,
    verifyTripHashes,
    verifyLedgerIntegrity,
    getRootHash: async () => {
      const verification = await verifyLedger();
      return verification.rootHash;
    }
  };

  return (
    <LedgerTripsContext.Provider value={value}>
      {children}
    </LedgerTripsContext.Provider>
  );
};

export const useLedgerTrips = (): LedgerTripsContextType => {
  const context = useContext(LedgerTripsContext);
  if (!context) {
    throw new Error('useLedgerTrips must be used within a LedgerTripsProvider');
  }
  return context;
};