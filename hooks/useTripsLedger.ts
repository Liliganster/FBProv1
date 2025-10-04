/**
 * useTripsLedger Hook - Integration between ledger system and UI
 * Provides projected trip state and ledger operations for components
 */

import { useState, useEffect, useCallback } from 'react';
import { Trip, TripProjection, TripLedgerSource, TripLedgerVerification } from '../types';
import { tripLedgerService } from '../services/tripLedgerService';
import { useAuth } from './useAuth';

export interface UseTripsLedgerReturn {
  // UI state (projected trips)
  projectedTrips: TripProjection[];
  trips: Trip[]; // For backward compatibility with existing UI
  isLoading: boolean;
  error: string | null;
  
  // Ledger operations
  createTrip: (trip: Trip, source?: TripLedgerSource) => Promise<void>;
  updateTrip: (tripId: string, updatedTrip: Trip, justification: string, changedFields: string[]) => Promise<void>;
  deleteTrip: (tripId: string, reason: string) => Promise<void>;
  importTripBatch: (trips: Trip[], source: TripLedgerSource, sourceDocuments?: { id: string; name: string; type: string }[]) => Promise<void>;
  
  // Verification
  verifyLedger: () => Promise<TripLedgerVerification>;
  lastVerification: TripLedgerVerification | null;
  
  // Utility
  refreshProjections: () => Promise<void>;
  getTripHistory: (tripId: string) => TripProjection | null;
}

export function useTripsLedger(): UseTripsLedgerReturn {
  const { user } = useAuth();
  const [projectedTrips, setProjectedTrips] = useState<TripProjection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastVerification, setLastVerification] = useState<TripLedgerVerification | null>(null);
  
  // For backward compatibility - extract just the Trip objects
  const trips = projectedTrips
    .filter(projection => !projection.isVoided)
    .map(projection => projection.trip);
  
  /**
   * Load projected trips from ledger
   */
  const refreshProjections = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const projections = await tripLedgerService.getAllProjectedTrips();
      setProjectedTrips(projections);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trips');
      console.error('Failed to load projected trips:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);
  
  /**
   * Create a new trip
   */
  const createTrip = useCallback(async (
    trip: Trip, 
    source: TripLedgerSource = TripLedgerSource.MANUAL
  ) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      await tripLedgerService.createTrip(trip, source, user.id);
      await refreshProjections();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create trip';
      setError(message);
      throw new Error(message);
    }
  }, [user, refreshProjections]);
  
  /**
   * Update an existing trip (creates AMEND entry)
   */
  const updateTrip = useCallback(async (
    tripId: string,
    updatedTrip: Trip,
    justification: string,
    changedFields: string[]
  ) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      await tripLedgerService.amendTrip(
        tripId,
        updatedTrip,
        justification,
        changedFields,
        user.id
      );
      await refreshProjections();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update trip';
      setError(message);
      throw new Error(message);
    }
  }, [user, refreshProjections]);
  
  /**
   * Delete a trip (creates VOID entry)
   */
  const deleteTrip = useCallback(async (tripId: string, reason: string) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      await tripLedgerService.voidTrip(tripId, reason, user.id);
      await refreshProjections();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete trip';
      setError(message);
      throw new Error(message);
    }
  }, [user, refreshProjections]);
  
  /**
   * Import a batch of trips
   */
  const importTripBatch = useCallback(async (
    trips: Trip[],
    source: TripLedgerSource,
    sourceDocuments?: { id: string; name: string; type: string }[]
  ) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      await tripLedgerService.importTripBatch(trips, source, user.id, sourceDocuments);
      await refreshProjections();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import trips';
      setError(message);
      throw new Error(message);
    }
  }, [user, refreshProjections]);
  
  /**
   * Verify ledger integrity
   */
  const verifyLedger = useCallback(async (): Promise<TripLedgerVerification> => {
    try {
      const verification = await tripLedgerService.verifyLedgerIntegrity();
      setLastVerification(verification);
      return verification;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to verify ledger';
      setError(message);
      throw new Error(message);
    }
  }, []);
  
  /**
   * Get history/projection for a specific trip
   */
  const getTripHistory = useCallback((tripId: string): TripProjection | null => {
    return projectedTrips.find(projection => projection.trip.id === tripId) || null;
  }, [projectedTrips]);
  
  // Load projections on mount and user change
  useEffect(() => {
    refreshProjections();
  }, [refreshProjections]);
  
  // Auto-verify ledger periodically (optional)
  useEffect(() => {
    const interval = setInterval(() => {
      verifyLedger().catch(console.error);
    }, 5 * 60 * 1000); // Every 5 minutes
    
    return () => clearInterval(interval);
  }, [verifyLedger]);
  
  return {
    projectedTrips,
    trips, // For backward compatibility
    isLoading,
    error,
    createTrip,
    updateTrip,
    deleteTrip,
    importTripBatch,
    verifyLedger,
    lastVerification,
    refreshProjections,
    getTripHistory
  };
}