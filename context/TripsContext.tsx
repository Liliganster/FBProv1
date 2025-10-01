import React, { createContext, ReactNode } from 'react';
import { Trip, Project, CallsheetFile } from '../types';
import { saveFile, deleteFile, deleteMultipleFiles } from '../services/dbService';
import { generateHash, createTripHashPayload } from '../services/complianceService';
import { useAuth } from '../hooks/useAuth';
import useLocalStorage from '../hooks/useLocalStorage';

interface TripsContextType {
  trips: Trip[];
  projects: Project[];
  addTrip: (trip: Omit<Trip, 'id'>) => void;
  updateTrip: (updatedTrip: Trip) => void;
  deleteTrip: (tripId: string) => void;
  deleteMultipleTrips: (tripIds: string[]) => void;
  updateMultipleTrips: (tripIds: string[], updates: Partial<Omit<Trip, 'id'>>) => void;
  addMultipleTrips: (newTrips: Omit<Trip, 'id'>[]) => void;
  addCsvTrips: (drafts: Omit<Trip, 'id'>[]) => void;
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
}

export const TripsContext = createContext<TripsContextType | undefined>(undefined);

const recalculateTripHashes = async (allTrips: Trip[]): Promise<Trip[]> => {
    const sortedTrips = [...allTrips].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return a.id.localeCompare(b.id);
    });
    
    let previousHash = "0".repeat(64);
    const newHashedTrips: Trip[] = [];

    for (const trip of sortedTrips) {
        const payload = createTripHashPayload(trip, previousHash);
        const currentHash = await generateHash(payload);
        
        newHashedTrips.push({
            ...trip,
            hash: currentHash,
            previousHash: previousHash,
        });
        previousHash = currentHash;
    }
    return newHashedTrips;
};


export const TripsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const tripsStorageKey = user ? `fahrtenbuch_trips_${user.id}` : null;
    const projectsStorageKey = user ? `fahrtenbuch_projects_${user.id}` : null;
    
    const [trips, setTrips] = useLocalStorage<Trip[]>(tripsStorageKey, []);
    const [projects, setProjects] = useLocalStorage<Project[]>(projectsStorageKey, []);
    
    const updateTripsAndRecalculateHashes = async (updater: (prevTrips: Trip[]) => Trip[]) => {
        const updatedTrips = updater(trips);
        const finalHashedTrips = await recalculateTripHashes(updatedTrips);
        setTrips(finalHashedTrips);
    };

    const addTrip = (trip: Omit<Trip, 'id'>) => {
        updateTripsAndRecalculateHashes(prev => [...prev, { ...trip, id: `trip-${Date.now()}-${Math.random()}` }]);
    };

    const addMultipleTrips = (newTrips: Omit<Trip, 'id'>[]) => {
        updateTripsAndRecalculateHashes(prev => {
             const tripsWithIds = newTrips.map(trip => ({...trip, id: `trip-${Date.now()}-${Math.random()}`}));
             return [...prev, ...tripsWithIds];
        });
    };

    const addCsvTrips = (drafts: Omit<Trip, 'id'>[]) => {
        const existingProjectIds = new Set(projects.map(p => p.id));
        const newProjectsToCreate = new Map<string, Project>();

        const tripsToCreate = drafts.map(draft => {
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
                    callsheets: [],
                };
                newProjectsToCreate.set(newProjectName, newProject);
                newProjectId = newProject.id;
            }
            return { ...draft, projectId: newProjectId };
        });

        const newProjects = Array.from(newProjectsToCreate.values());
        if (newProjects.length > 0) {
            setProjects(prev => [...prev, ...newProjects]);
        }
        addMultipleTrips(tripsToCreate);
    };

    const updateTrip = (updatedTrip: Trip) => {
        updateTripsAndRecalculateHashes(prev => prev.map(trip => trip.id === updatedTrip.id ? updatedTrip : trip));
    };

    const updateMultipleTrips = (tripIds: string[], updates: Partial<Omit<Trip, 'id'>>) => {
        updateTripsAndRecalculateHashes(prev => 
          prev.map(trip => 
            tripIds.includes(trip.id) ? { ...trip, ...updates } : trip
          )
        );
    };

    const deleteTrip = (tripId: string) => {
        updateTripsAndRecalculateHashes(prev => prev.filter(trip => trip.id !== tripId));
    };
    
    const deleteMultipleTrips = (tripIds: string[]) => {
        updateTripsAndRecalculateHashes(prev => prev.filter(trip => !tripIds.includes(trip.id)));
    };

    const addProject = (project: Omit<Project, 'id'>) => {
        setProjects(prev => [...prev, { ...project, id: `proj-${Date.now()}`, callsheets: [] }]);
    };

    const updateProject = (updatedProject: Project) => {
        setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    };

    const deleteProject = async (projectId: string) => {
        const projectToDelete = projects.find(p => p.id === projectId);
        if (projectToDelete?.callsheets?.length) {
            const callsheetIds = projectToDelete.callsheets.map(cs => cs.id);
            await deleteMultipleFiles(callsheetIds);
        }
        setProjects(prev => prev.filter(p => p.id !== projectId));
        updateTripsAndRecalculateHashes(prev => prev.map(trip => 
            trip.projectId === projectId ? { ...trip, projectId: '' } : trip
        ));
    };

    const deleteMultipleProjects = async (projectIds: string[]) => {
        const callsheetIdsToDelete: string[] = [];
        projects.forEach(p => {
            if (projectIds.includes(p.id) && p.callsheets?.length) {
                p.callsheets.forEach(cs => callsheetIdsToDelete.push(cs.id));
            }
        });

        if (callsheetIdsToDelete.length > 0) {
            await deleteMultipleFiles(callsheetIdsToDelete);
        }
        setProjects(prev => prev.filter(p => !projectIds.includes(p.id)));
        updateTripsAndRecalculateHashes(prev => prev.map(trip => 
            projectIds.includes(trip.projectId) ? { ...trip, projectId: '' } : trip
        ));
    };
    
    const addCallsheetsToProject = async (projectId: string, files: File[]) => {
      const newCallsheets: CallsheetFile[] = files.map(file => ({
        id: `cs-${Date.now()}-${Math.random()}`,
        name: file.name,
        type: file.type,
      }));

      try {
        await Promise.all(
          newCallsheets.map((cs, index) => saveFile(cs.id, files[index]))
        );
        
        setProjects(prevProjects => prevProjects.map(p => {
          if (p.id === projectId) {
            return {
              ...p,
              callsheets: [...(p.callsheets || []), ...newCallsheets]
            };
          }
          return p;
        }));
      } catch (error) {
        console.error("Error saving files to IndexedDB:", error);
        throw error;
      }
    };

    const deleteCallsheetFromProject = async (projectId: string, callsheetId: string) => {
        try {
            await deleteFile(callsheetId);
            setProjects(prev => prev.map(p => {
                if (p.id === projectId) {
                    return {
                        ...p,
                        callsheets: (p.callsheets || []).filter(cs => cs.id !== callsheetId)
                    };
                }
                return p;
            }));
        } catch (error) {
            console.error(`Failed to delete file ${callsheetId} from DB`, error);
        }
    };

    const deleteAllTrips = async () => {
        await updateTripsAndRecalculateHashes(() => []);
    };

    const deleteAllProjects = async () => {
        await deleteMultipleProjects(projects.map(p => p.id));
    };

    const replaceAllTripsAndProjects = async (data: { trips: Trip[], projects: Project[] }) => {
        setProjects(data.projects || []);
        await updateTripsAndRecalculateHashes(() => data.trips || []);
    };

    const verifyTripHashes = async (): Promise<{ ok: boolean, errors: { trip: Trip, reason: string }[] }> => {
        const sortedTrips = [...trips].sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return a.id.localeCompare(b.id);
        });

        const errors: { trip: Trip, reason: string }[] = [];
        let previousHash = "0".repeat(64);

        for (const trip of sortedTrips) {
            if (trip.previousHash !== previousHash) {
                errors.push({ trip, reason: `Chain broken: Previous hash mismatch. Expected ${previousHash}, got ${trip.previousHash}` });
            }
            const expectedPayload = createTripHashPayload(trip, trip.previousHash);
            const expectedHash = await generateHash(expectedPayload);
            if (trip.hash !== expectedHash) {
                errors.push({ trip, reason: `Content mismatch: Recalculated hash does not match stored hash.` });
            }
            previousHash = trip.hash!;
        }

        return { ok: errors.length === 0, errors };
    };

    const value = {
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
        verifyTripHashes
    };

    return (
        <TripsContext.Provider value={value}>
        {children}
        </TripsContext.Provider>
    );
};