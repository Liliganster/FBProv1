/**
 * Trip Ledger Service - Immutable append-only ledger for trip operations
 * Provides complete audit trail and verification capabilities
 */

import {
  TripLedgerEntry,
  TripLedgerOperation,
  TripLedgerSource,
  TripLedgerBatch,
  TripLedgerVerification,
  TripProjection,
  Trip
} from '../types';

import {
  generateLedgerEntryHash,
  generateRootHash,
  generateBatchId,
  generateEntryId,
  verifyLedgerEntryHash
} from './hashService';

export class TripLedgerService {
  private readonly LEDGER_STORAGE_KEY = 'fahrtenbuch_trip_ledger';
  private readonly BATCH_STORAGE_KEY = 'fahrtenbuch_trip_batches';
  
  /**
   * Get all ledger entries from storage
   */
  private getLedgerEntries(): TripLedgerEntry[] {
    const stored = localStorage.getItem(this.LEDGER_STORAGE_KEY);
    if (!stored) return [];
    
    try {
      return JSON.parse(stored) as TripLedgerEntry[];
    } catch (error) {
      console.error('Failed to parse ledger entries:', error);
      return [];
    }
  }
  
  /**
   * Save ledger entries to storage (append-only)
   */
  private saveLedgerEntries(entries: TripLedgerEntry[]): void {
    localStorage.setItem(this.LEDGER_STORAGE_KEY, JSON.stringify(entries));
  }
  
  /**
   * Get all batch records from storage
   */
  private getBatchRecords(): TripLedgerBatch[] {
    const stored = localStorage.getItem(this.BATCH_STORAGE_KEY);
    if (!stored) return [];
    
    try {
      return JSON.parse(stored) as TripLedgerBatch[];
    } catch (error) {
      console.error('Failed to parse batch records:', error);
      return [];
    }
  }
  
  /**
   * Save batch records to storage
   */
  private saveBatchRecords(batches: TripLedgerBatch[]): void {
    localStorage.setItem(this.BATCH_STORAGE_KEY, JSON.stringify(batches));
  }
  
  /**
   * Get the last hash in the ledger chain
   */
  private getLastHash(): string | null {
    const entries = this.getLedgerEntries();
    if (entries.length === 0) return null;
    
    // Sort by timestamp to get chronologically last entry
    const sortedEntries = entries.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    return sortedEntries[sortedEntries.length - 1].hash;
  }
  
  /**
   * Create a new trip entry
   */
  async createTrip(
    trip: Trip,
    source: TripLedgerSource,
    userId: string,
    sourceDocumentId?: string,
    sourceDocumentName?: string
  ): Promise<TripLedgerEntry> {
    const timestamp = new Date().toISOString();
    const previousHash = this.getLastHash();
    const entryId = generateEntryId();
    
    const hash = await generateLedgerEntryHash(
      TripLedgerOperation.CREATE,
      source,
      userId,
      timestamp,
      trip.id,
      trip,
      previousHash,
      undefined, // No batchId for single creates
      undefined, // No correction reason
      undefined, // No changed fields
      sourceDocumentId,
      sourceDocumentName
    );
    
    const entry: TripLedgerEntry = {
      id: entryId,
      hash,
      previousHash,
      timestamp,
      operation: TripLedgerOperation.CREATE,
      source,
      userId,
      tripId: trip.id,
      tripSnapshot: { ...trip },
      sourceDocumentId,
      sourceDocumentName
    };
    
    // Append to ledger
    const entries = this.getLedgerEntries();
    entries.push(entry);
    this.saveLedgerEntries(entries);
    
    return entry;
  }
  
  /**
   * Amend an existing trip
   */
  async amendTrip(
    tripId: string,
    newTripData: Trip,
    correctionReason: string,
    changedFields: string[],
    userId: string,
    sourceDocumentId?: string,
    sourceDocumentName?: string
  ): Promise<TripLedgerEntry> {
    const timestamp = new Date().toISOString();
    const previousHash = this.getLastHash();
    const entryId = generateEntryId();
    
    const hash = await generateLedgerEntryHash(
      TripLedgerOperation.AMEND,
      TripLedgerSource.MANUAL, // Amendments are typically manual
      userId,
      timestamp,
      tripId,
      newTripData,
      previousHash,
      undefined, // No batchId for single amendments
      correctionReason,
      changedFields,
      sourceDocumentId,
      sourceDocumentName
    );
    
    const entry: TripLedgerEntry = {
      id: entryId,
      hash,
      previousHash,
      timestamp,
      operation: TripLedgerOperation.AMEND,
      source: TripLedgerSource.MANUAL,
      userId,
      tripId,
      tripSnapshot: { ...newTripData },
      correctionReason,
      changedFields: [...changedFields],
      sourceDocumentId,
      sourceDocumentName
    };
    
    // Append to ledger
    const entries = this.getLedgerEntries();
    entries.push(entry);
    this.saveLedgerEntries(entries);
    
    return entry;
  }
  
  /**
   * Void a trip (mark as deleted but keep audit trail)
   */
  async voidTrip(
    tripId: string,
    voidReason: string,
    userId: string
  ): Promise<TripLedgerEntry> {
    const timestamp = new Date().toISOString();
    const previousHash = this.getLastHash();
    const entryId = generateEntryId();
    
    // Get the current state of the trip being voided
    const currentProjection = await this.getProjectedTrip(tripId);
    if (!currentProjection || currentProjection.isVoided) {
      throw new Error(`Trip ${tripId} not found or already voided`);
    }
    
    const hash = await generateLedgerEntryHash(
      TripLedgerOperation.VOID,
      TripLedgerSource.MANUAL,
      userId,
      timestamp,
      tripId,
      currentProjection.trip, // Current state as snapshot
      previousHash,
      undefined, // No batchId
      undefined, // No correction reason
      undefined, // No changed fields
      undefined, // No source document
      undefined, // No source document name
      voidReason,
      currentProjection.trip // Previous snapshot for audit
    );
    
    const entry: TripLedgerEntry = {
      id: entryId,
      hash,
      previousHash,
      timestamp,
      operation: TripLedgerOperation.VOID,
      source: TripLedgerSource.MANUAL,
      userId,
      tripId,
      tripSnapshot: { ...currentProjection.trip },
      voidReason,
      previousSnapshot: { ...currentProjection.trip }
    };
    
    // Append to ledger
    const entries = this.getLedgerEntries();
    entries.push(entry);
    this.saveLedgerEntries(entries);
    
    return entry;
  }
  
  /**
   * Import a batch of trips (maintains chronological order in batch)
   */
  async importTripBatch(
    trips: Trip[],
    source: TripLedgerSource,
    userId: string,
    sourceDocuments?: { id: string; name: string; type: string }[]
  ): Promise<{ entries: TripLedgerEntry[]; batch: TripLedgerBatch }> {
    if (trips.length === 0) {
      throw new Error('Cannot import empty batch');
    }
    
    const batchId = generateBatchId();
    const batchTimestamp = new Date().toISOString();
    const entries: TripLedgerEntry[] = [];
    
    let previousHash = this.getLastHash();
    
    // Sort trips by their declared date to maintain chronological order within batch
    const sortedTrips = trips.slice().sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Create entries for each trip in the batch
    for (let i = 0; i < sortedTrips.length; i++) {
      const trip = sortedTrips[i];
      const entryId = generateEntryId();
      const timestamp = new Date().toISOString();
      
      const hash = await generateLedgerEntryHash(
        TripLedgerOperation.IMPORT_BATCH,
        source,
        userId,
        timestamp,
        trip.id,
        trip,
        previousHash,
        batchId,
        undefined, // No correction reason for imports
        undefined, // No changed fields for imports
        sourceDocuments?.[0]?.id, // Use first document as primary reference
        sourceDocuments?.[0]?.name
      );
      
      const entry: TripLedgerEntry = {
        id: entryId,
        hash,
        previousHash,
        timestamp,
        operation: TripLedgerOperation.IMPORT_BATCH,
        source,
        userId,
        batchId,
        tripId: trip.id,
        tripSnapshot: { ...trip },
        sourceDocumentId: sourceDocuments?.[0]?.id,
        sourceDocumentName: sourceDocuments?.[0]?.name
      };
      
      entries.push(entry);
      previousHash = hash; // Chain within batch
    }
    
    // Create batch record
    const batch: TripLedgerBatch = {
      batchId,
      timestamp: batchTimestamp,
      source,
      userId,
      entryCount: entries.length,
      firstEntryHash: entries[0].hash,
      lastEntryHash: entries[entries.length - 1].hash,
      sourceDocuments
    };
    
    // Save to storage
    const allEntries = this.getLedgerEntries();
    allEntries.push(...entries);
    this.saveLedgerEntries(allEntries);
    
    const batches = this.getBatchRecords();
    batches.push(batch);
    this.saveBatchRecords(batches);
    
    return { entries, batch };
  }
  
  /**
   * Get projected (current) state of a specific trip
   */
  async getProjectedTrip(tripId: string): Promise<TripProjection | null> {
    const entries = this.getLedgerEntries();
    const tripEntries = entries
      .filter(entry => entry.tripId === tripId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    if (tripEntries.length === 0) return null;
    
    let currentTrip: Trip | null = null;
    let isVoided = false;
    let createdAt = '';
    let lastModifiedAt = '';
    let amendmentCount = 0;
    let lastOperation = TripLedgerOperation.CREATE;
    let sourceDocument: { id: string; name: string } | undefined;
    
    for (const entry of tripEntries) {
      switch (entry.operation) {
        case TripLedgerOperation.CREATE:
        case TripLedgerOperation.IMPORT_BATCH:
          currentTrip = { ...entry.tripSnapshot };
          createdAt = entry.timestamp;
          lastModifiedAt = entry.timestamp;
          lastOperation = entry.operation;
          if (entry.sourceDocumentId && entry.sourceDocumentName) {
            sourceDocument = {
              id: entry.sourceDocumentId,
              name: entry.sourceDocumentName
            };
          }
          break;
          
        case TripLedgerOperation.AMEND:
          if (currentTrip && !isVoided) {
            currentTrip = { ...entry.tripSnapshot };
            lastModifiedAt = entry.timestamp;
            amendmentCount++;
            lastOperation = entry.operation;
          }
          break;
          
        case TripLedgerOperation.VOID:
          isVoided = true;
          lastModifiedAt = entry.timestamp;
          lastOperation = entry.operation;
          break;
      }
    }
    
    if (!currentTrip) return null;
    
    return {
      trip: currentTrip,
      isVoided,
      createdAt,
      lastModifiedAt,
      amendmentCount,
      lastOperation,
      sourceDocument
    };
  }
  
  /**
   * Get all current (projected) trips for UI
   */
  async getAllProjectedTrips(): Promise<TripProjection[]> {
    const entries = this.getLedgerEntries();
    const tripIds = new Set(entries.map(entry => entry.tripId));
    
    const projections: TripProjection[] = [];
    
    for (const tripId of tripIds) {
      const projection = await this.getProjectedTrip(tripId);
      if (projection) {
        projections.push(projection);
      }
    }
    
    return projections;
  }
  
  /**
   * Verify the integrity of the entire ledger
   */
  async verifyLedgerIntegrity(): Promise<TripLedgerVerification> {
    const entries = this.getLedgerEntries();
    
    if (entries.length === 0) {
      return {
        isValid: true,
        totalEntries: 0,
        rootHash: await generateRootHash([]),
        verificationTimestamp: new Date().toISOString()
      };
    }
    
    // Sort entries by timestamp for verification
    const sortedEntries = entries.slice().sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Verify each entry's hash
    for (const entry of sortedEntries) {
      const isValidHash = await verifyLedgerEntryHash(entry);
      if (!isValidHash) {
        return {
          isValid: false,
          totalEntries: entries.length,
          rootHash: '',
          brokenChainAt: entry.hash,
          verificationTimestamp: new Date().toISOString()
        };
      }
    }
    
    // Verify chain integrity (previousHash links)
    for (let i = 1; i < sortedEntries.length; i++) {
      const currentEntry = sortedEntries[i];
      const expectedPreviousHash = sortedEntries[i - 1].hash;
      
      if (currentEntry.previousHash !== expectedPreviousHash) {
        return {
          isValid: false,
          totalEntries: entries.length,
          rootHash: '',
          brokenChainAt: currentEntry.hash,
          verificationTimestamp: new Date().toISOString()
        };
      }
    }
    
    const rootHash = await generateRootHash(entries);
    
    return {
      isValid: true,
      totalEntries: entries.length,
      rootHash,
      firstEntry: sortedEntries[0],
      lastEntry: sortedEntries[sortedEntries.length - 1],
      verificationTimestamp: new Date().toISOString()
    };
  }
  
  /**
   * Get ledger entries for a specific batch
   */
  getBatchEntries(batchId: string): TripLedgerEntry[] {
    const entries = this.getLedgerEntries();
    return entries
      .filter(entry => entry.batchId === batchId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
  
  /**
   * Get all batch records
   */
  getAllBatches(): TripLedgerBatch[] {
    return this.getBatchRecords();
  }
  
  /**
   * Export ledger for backup or analysis
   */
  exportLedger(): {
    entries: TripLedgerEntry[];
    batches: TripLedgerBatch[];
    exportTimestamp: string;
  } {
    return {
      entries: this.getLedgerEntries(),
      batches: this.getBatchRecords(),
      exportTimestamp: new Date().toISOString()
    };
  }
  
  /**
   * Clear all ledger data (use with extreme caution!)
   */
  clearLedger(): void {
    localStorage.removeItem(this.LEDGER_STORAGE_KEY);
    localStorage.removeItem(this.BATCH_STORAGE_KEY);
  }
}

// Singleton instance
export const tripLedgerService = new TripLedgerService();