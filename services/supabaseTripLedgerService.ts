import { 
  TripLedgerEntry, 
  TripLedgerOperation, 
  TripLedgerSource, 
  Trip, 
  TripLedgerBatch,
  TripLedgerVerification
} from '../types';
import { generateHash, createTripCanonicalString, generateRootHash } from './hashService';
import { databaseService } from './databaseService';
import { supabase } from '../lib/supabase';

/**
 * Generate hash for a trip using canonical string representation
 */
async function generateTripHash(trip: Trip): Promise<string> {
  const canonical = createTripCanonicalString(trip);
  return await generateHash(canonical);
}

/**
 * Enhanced Trip Ledger Service with Supabase backend
 * 
 * This service maintains the immutable ledger system while using Supabase
 * as the persistent storage backend instead of localStorage.
 * 
 * Key Features:
 * - Immutable append-only operations
 * - SHA-256 hash verification
 * - Blockchain-style integrity verification
 * - Supabase cloud storage
 * - Automatic sync across devices
 */
export class TripLedgerService {
  private userId: string;
  private entriesCache: TripLedgerEntry[] | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Get all ledger entries with caching
   */
  private async getLedgerEntries(): Promise<TripLedgerEntry[]> {
    const now = Date.now();
    
    // Return cached entries if still valid
    if (this.entriesCache && now < this.cacheExpiry) {
      return this.entriesCache;
    }

    try {
      // Fetch from Supabase
      const entries = await databaseService.getUserLedgerEntries(this.userId);
      
      // Update cache
      this.entriesCache = entries;
      this.cacheExpiry = now + this.CACHE_DURATION;
      
      return entries;
    } catch (error) {
      console.error('Error fetching ledger entries:', error);
      
      // Fallback to localStorage for backward compatibility
      const stored = localStorage.getItem(`tripLedger_${this.userId}`);
      if (stored) {
        const localEntries = JSON.parse(stored) as TripLedgerEntry[];
        console.warn('Using localStorage fallback for ledger entries');
        return localEntries;
      }
      
      return [];
    }
  }

  /**
   * Save ledger entries to Supabase with localStorage backup
   */
  private async saveLedgerEntries(entries: TripLedgerEntry[]): Promise<void> {
    try {
      // Save to Supabase
      await databaseService.replaceAllLedgerEntries(this.userId, entries);
      
      // Update cache
      this.entriesCache = entries;
      this.cacheExpiry = Date.now() + this.CACHE_DURATION;
      
      // Keep localStorage as backup
      localStorage.setItem(`tripLedger_${this.userId}`, JSON.stringify(entries));
    } catch (error) {
      console.error('Error saving ledger entries to Supabase:', error);
      
      // Fallback to localStorage only
      localStorage.setItem(`tripLedger_${this.userId}`, JSON.stringify(entries));
      throw error;
    }
  }

  /**
   * Add a single ledger entry to Supabase
   */
  private async addLedgerEntry(entry: TripLedgerEntry): Promise<void> {
    try {
      // Add to Supabase
      await databaseService.addLedgerEntry(this.userId, entry);
      
      // Invalidate cache to force refresh
      this.entriesCache = null;
      this.cacheExpiry = 0;
    } catch (error) {
      console.error('Error adding ledger entry to Supabase:', error);
      
      // Fallback: append to localStorage
      const entries = await this.getLedgerEntries();
      entries.push(entry);
      localStorage.setItem(`tripLedger_${this.userId}`, JSON.stringify(entries));
      throw error;
    }
  }

  /**
   * Get current trip data from ledger
   */
  async getTrips(): Promise<Trip[]> {
    const entries = await this.getLedgerEntries();
    const tripMap = new Map<string, Trip>();

    // Process entries in chronological order
    for (const entry of entries) {
      switch (entry.operation) {
        case TripLedgerOperation.CREATE:
        case TripLedgerOperation.IMPORT_BATCH:
          // El tripSnapshot ya debe tener los campos sourceDocument*, pero por si acaso los agregamos del entry
          tripMap.set(entry.tripId, { 
            ...entry.tripSnapshot,
            sourceDocumentId: entry.tripSnapshot.sourceDocumentId || entry.sourceDocumentId,
            sourceDocumentName: entry.tripSnapshot.sourceDocumentName || entry.sourceDocumentName,
          });
          break;
        
        case TripLedgerOperation.AMEND:
          if (tripMap.has(entry.tripId)) {
            tripMap.set(entry.tripId, { 
              ...entry.tripSnapshot,
              sourceDocumentId: entry.tripSnapshot.sourceDocumentId || entry.sourceDocumentId,
              sourceDocumentName: entry.tripSnapshot.sourceDocumentName || entry.sourceDocumentName,
            });
          }
          break;
        
        case TripLedgerOperation.VOID:
          tripMap.delete(entry.tripId);
          break;
      }
    }

    return Array.from(tripMap.values());
  }

  /**
   * Create a new trip entry
   */
  async createTrip(
    trip: Omit<Trip, 'id' | 'hash' | 'previousHash'>, 
    source: TripLedgerSource = TripLedgerSource.MANUAL
  ): Promise<TripLedgerEntry> {
    const entries = await this.getLedgerEntries();
    
    // Generate trip ID and hash
    const tripId = `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tripHash = await generateTripHash({
      ...trip,
      id: tripId,
      hash: '',
      previousHash: null
    });

    const completedTrip: Trip = {
      ...trip,
      id: tripId,
      hash: tripHash,
      previousHash: null
    };

    // Get previous hash for ledger chain
    const previousHash = entries.length > 0 ? entries[entries.length - 1].hash : null;
    
    const entry: TripLedgerEntry = {
      id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      hash: await generateTripHash(completedTrip),
      previousHash,
      timestamp: new Date().toISOString(),
      operation: TripLedgerOperation.CREATE,
      source,
      userId: this.userId,
      tripId,
      tripSnapshot: completedTrip
    };

    // Update trip with final hash
    entry.tripSnapshot.hash = entry.hash;
    
    await this.addLedgerEntry(entry);
    return entry;
  }

  /**
   * Amend an existing trip
   */
  async amendTrip(
    tripId: string,
    updates: Partial<Trip>,
    correctionReason: string,
    source: TripLedgerSource = TripLedgerSource.MANUAL,
    sourceDocumentId?: string,
    sourceDocumentName?: string
  ): Promise<TripLedgerEntry> {
    const entries = await this.getLedgerEntries();
    const trips = await this.getTrips();
    
    const existingTrip = trips.find(t => t.id === tripId);
    if (!existingTrip) {
      throw new Error(`Trip with ID ${tripId} not found`);
    }

    const amendedTrip: Trip = {
      ...existingTrip,
      ...updates,
      id: tripId // Ensure ID doesn't change
    };

    // Generate new hash
    amendedTrip.hash = await generateTripHash(amendedTrip);

    const changedFields = Object.keys(updates).filter(
      key => key !== 'hash' && key !== 'previousHash'
    );

    const previousHash = entries.length > 0 ? entries[entries.length - 1].hash : null;
    
    const entry: TripLedgerEntry = {
      id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      hash: await generateTripHash(amendedTrip),
      previousHash,
      timestamp: new Date().toISOString(),
      operation: TripLedgerOperation.AMEND,
      source,
      userId: this.userId,
      tripId,
      tripSnapshot: amendedTrip,
      correctionReason,
      changedFields,
      sourceDocumentId,
      sourceDocumentName
    };

    await this.addLedgerEntry(entry);
    return entry;
  }

  /**
   * Void a trip (mark as deleted)
   */
  async voidTrip(
    tripId: string,
    voidReason: string,
    source: TripLedgerSource = TripLedgerSource.MANUAL
  ): Promise<TripLedgerEntry> {
    const entries = await this.getLedgerEntries();
    const trips = await this.getTrips();
    
    const existingTrip = trips.find(t => t.id === tripId);
    if (!existingTrip) {
      throw new Error(`Trip with ID ${tripId} not found`);
    }

    const previousHash = entries.length > 0 ? entries[entries.length - 1].hash : null;
    
    const entry: TripLedgerEntry = {
      id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      hash: '', // Will be set after generation
      previousHash,
      timestamp: new Date().toISOString(),
      operation: TripLedgerOperation.VOID,
      source,
      userId: this.userId,
      tripId,
      tripSnapshot: existingTrip, // Keep snapshot for audit
      voidReason,
      previousSnapshot: existingTrip
    };

    // Generate hash for void entry
    entry.hash = await generateTripHash({
      id: entry.id,
      hash: '',
      previousHash: entry.previousHash || undefined,
      // Use minimal data for void hash
      date: entry.timestamp,
      locations: [`VOID:${tripId}`],
      distance: 0,
      projectId: 'VOID',
      reason: `VOIDED: ${voidReason}`,
      specialOrigin: existingTrip.specialOrigin
    });

    await this.addLedgerEntry(entry);
    return entry;
  }

  /**
   * Import multiple trips as a batch
   */
  async importTripsBatch(
    trips: Omit<Trip, 'id' | 'hash' | 'previousHash'>[],
    source: TripLedgerSource,
    sourceDocuments?: { id: string; name: string; type: string }[]
  ): Promise<{ entries: TripLedgerEntry[]; batch: TripLedgerBatch }> {
    const entries = await this.getLedgerEntries();
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    const batchEntries: TripLedgerEntry[] = [];
    let previousHash = entries.length > 0 ? entries[entries.length - 1].hash : null;

    for (let i = 0; i < trips.length; i++) {
      const trip = trips[i];
      const tripId = `trip_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;
      
      const completedTrip: Trip = {
        ...trip,
        id: tripId,
        hash: '',
        previousHash: null,
        sourceDocumentId: trip.sourceDocumentId || sourceDocuments?.[0]?.id,
        sourceDocumentName: trip.sourceDocumentName || sourceDocuments?.[0]?.name,
        sourceDocumentUrl: trip.sourceDocumentUrl,
      };

      completedTrip.hash = await generateTripHash(completedTrip);

      const entry: TripLedgerEntry = {
        id: `entry_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
        hash: completedTrip.hash,
        previousHash,
        timestamp,
        operation: TripLedgerOperation.IMPORT_BATCH,
        source,
        userId: this.userId,
        batchId,
        tripId,
        tripSnapshot: completedTrip,
        sourceDocumentId: completedTrip.sourceDocumentId,
        sourceDocumentName: completedTrip.sourceDocumentName
      };

      console.log('[importTripsBatch] Creating entry with source:', source, 'for trip:', completedTrip.date);
      batchEntries.push(entry);
      previousHash = entry.hash;
    }

    console.log('[importTripsBatch] Saving', batchEntries.length, 'entries with source:', source);
    // Add all entries to Supabase
    await databaseService.addLedgerEntries(this.userId, batchEntries);

    // Create batch record
    const batch: TripLedgerBatch = {
      batchId,
      timestamp,
      source,
      userId: this.userId,
      entryCount: batchEntries.length,
      firstEntryHash: batchEntries[0]?.hash || '',
      lastEntryHash: batchEntries[batchEntries.length - 1]?.hash || '',
      sourceDocuments
    };

    await databaseService.createLedgerBatch(this.userId, batch);

    // Invalidate cache
    this.entriesCache = null;
    this.cacheExpiry = 0;

    return { entries: batchEntries, batch };
  }

  /**
   * Verify ledger integrity
   */
  async verifyLedger(): Promise<TripLedgerVerification> {
    const entries = await this.getLedgerEntries();
    
    if (entries.length === 0) {
      return {
        isValid: true,
        totalEntries: 0,
        rootHash: '',
        verificationTimestamp: new Date().toISOString()
      };
    }

    let isValid = true;
    let brokenChainAt: string | undefined;

    // Verify chain integrity
    for (let i = 1; i < entries.length; i++) {
      const currentEntry = entries[i];
      const previousEntry = entries[i - 1];

      if (currentEntry.previousHash !== previousEntry.hash) {
        isValid = false;
        brokenChainAt = currentEntry.hash;
        break;
      }
    }

    // Generate root hash
    const rootHash = await generateRootHash(entries);

    return {
      isValid,
      totalEntries: entries.length,
      rootHash,
      firstEntry: entries[0],
      lastEntry: entries[entries.length - 1],
      brokenChainAt,
      verificationTimestamp: new Date().toISOString()
    };
  }

  /**
   * Get entries by batch ID
   */
  async getBatchEntries(batchId: string): Promise<TripLedgerEntry[]> {
    try {
      // Get current authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      return await databaseService.getLedgerEntriesByBatch(batchId, user.id);
    } catch (error) {
      console.error('Error fetching batch entries from Supabase:', error);
      
      // Fallback to filtering all entries
      const entries = await this.getLedgerEntries();
      return entries.filter(entry => entry.batchId === batchId);
    }
  }

  /**
   * Get all batches for the user
   */
  async getBatches(): Promise<TripLedgerBatch[]> {
    try {
      return await databaseService.getUserLedgerBatches(this.userId);
    } catch (error) {
      console.error('Error fetching batches from Supabase:', error);
      
      // Fallback: extract batches from entries
      const entries = await this.getLedgerEntries();
      const batchMap = new Map<string, {
        entries: TripLedgerEntry[];
        batch: TripLedgerBatch;
      }>();

      // Group entries by batch
      for (const entry of entries) {
        if (entry.batchId) {
          if (!batchMap.has(entry.batchId)) {
            batchMap.set(entry.batchId, {
              entries: [],
              batch: {
                batchId: entry.batchId,
                timestamp: entry.timestamp,
                source: entry.source,
                userId: entry.userId,
                entryCount: 0,
                firstEntryHash: '',
                lastEntryHash: ''
              }
            });
          }
          batchMap.get(entry.batchId)!.entries.push(entry);
        }
      }

      // Complete batch data
      const batches: TripLedgerBatch[] = [];
      for (const [batchId, data] of batchMap) {
        data.batch.entryCount = data.entries.length;
        data.batch.firstEntryHash = data.entries[0]?.hash || '';
        data.batch.lastEntryHash = data.entries[data.entries.length - 1]?.hash || '';
        batches.push(data.batch);
      }

      return batches;
    }
  }

  /**
   * Clear all cached data and reset
   */
  clearCache(): void {
    this.entriesCache = null;
    this.cacheExpiry = 0;
  }

  /**
   * Migrate from localStorage to Supabase
   */
  async migrateFromLocalStorage(): Promise<{ migrated: boolean; entriesCount: number }> {
    try {
      const localStorageKey = `tripLedger_${this.userId}`;
      const stored = localStorage.getItem(localStorageKey);
      
      if (!stored) {
        return { migrated: false, entriesCount: 0 };
      }

      const localEntries = JSON.parse(stored) as TripLedgerEntry[];
      
      if (localEntries.length === 0) {
        return { migrated: false, entriesCount: 0 };
      }

      // Check if Supabase already has entries
      const existingEntries = await databaseService.getUserLedgerEntries(this.userId);
      
      if (existingEntries.length > 0) {
        console.warn('Supabase already has entries, skipping migration');
        return { migrated: false, entriesCount: existingEntries.length };
      }

      // Migrate to Supabase
      await databaseService.replaceAllLedgerEntries(this.userId, localEntries);
      
      // Clear localStorage after successful migration
      localStorage.removeItem(localStorageKey);
      
      // Clear cache to force refresh from Supabase
      this.clearCache();
      
      return { migrated: true, entriesCount: localEntries.length };
    } catch (error) {
      console.error('Error migrating from localStorage:', error);
      return { migrated: false, entriesCount: 0 };
    }
  }
}

// Export factory function for creating service instances
export function createTripLedgerService(userId: string): TripLedgerService {
  return new TripLedgerService(userId);
}