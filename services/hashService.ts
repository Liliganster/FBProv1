/**
 * Hash Service - SHA-256 hashing for trip ledger immutability
 * Provides cryptographic hashing functions for ledger entries
 */

import { TripLedgerEntry, TripLedgerOperation, TripLedgerSource, Trip } from '../types';

/**
 * Generate SHA-256 hash from string data
 */
export async function generateHash(data: string): Promise<string> {
  // Use Web Crypto API for SHA-256 hashing
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  
  // Convert ArrayBuffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * Create canonical string representation of a trip for hashing
 */
export function createTripCanonicalString(trip: Trip): string {
  // Sort keys to ensure consistent ordering
  const canonical = {
    id: trip.id,
    date: trip.date,
    locations: trip.locations.slice().sort(), // Sort locations for consistency
    distance: trip.distance,
    projectId: trip.projectId,
    reason: trip.reason,
    specialOrigin: trip.specialOrigin,
    passengers: trip.passengers || 0,
    ratePerKm: trip.ratePerKm || null,
    editJustification: trip.editJustification || null
  };
  
  return JSON.stringify(canonical);
}

/**
 * Create canonical string representation of ledger entry for hashing
 */
export function createLedgerEntryCanonicalString(
  operation: TripLedgerOperation,
  source: TripLedgerSource,
  userId: string,
  timestamp: string,
  tripId: string,
  tripSnapshot: Trip,
  previousHash: string | null,
  batchId?: string,
  correctionReason?: string,
  changedFields?: string[],
  sourceDocumentId?: string,
  sourceDocumentName?: string,
  voidReason?: string,
  previousSnapshot?: Trip
): string {
  const canonical = {
    operation,
    source,
    userId,
    timestamp,
    tripId,
    tripSnapshot: createTripCanonicalString(tripSnapshot),
    previousHash,
    batchId: batchId || null,
    correctionReason: correctionReason || null,
    changedFields: changedFields ? changedFields.slice().sort() : null,
    sourceDocumentId: sourceDocumentId || null,
    sourceDocumentName: sourceDocumentName || null,
    voidReason: voidReason || null,
    previousSnapshot: previousSnapshot ? createTripCanonicalString(previousSnapshot) : null
  };
  
  return JSON.stringify(canonical);
}

/**
 * Generate hash for a trip ledger entry
 */
export async function generateLedgerEntryHash(
  operation: TripLedgerOperation,
  source: TripLedgerSource,
  userId: string,
  timestamp: string,
  tripId: string,
  tripSnapshot: Trip,
  previousHash: string | null,
  batchId?: string,
  correctionReason?: string,
  changedFields?: string[],
  sourceDocumentId?: string,
  sourceDocumentName?: string,
  voidReason?: string,
  previousSnapshot?: Trip
): Promise<string> {
  const canonicalString = createLedgerEntryCanonicalString(
    operation,
    source,
    userId,
    timestamp,
    tripId,
    tripSnapshot,
    previousHash,
    batchId,
    correctionReason,
    changedFields,
    sourceDocumentId,
    sourceDocumentName,
    voidReason,
    previousSnapshot
  );
  
  return await generateHash(canonicalString);
}

/**
 * Verify that a ledger entry's hash is correct
 */
export async function verifyLedgerEntryHash(entry: TripLedgerEntry): Promise<boolean> {
  const expectedHash = await generateLedgerEntryHash(
    entry.operation,
    entry.source,
    entry.userId,
    entry.timestamp,
    entry.tripId,
    entry.tripSnapshot,
    entry.previousHash,
    entry.batchId,
    entry.correctionReason,
    entry.changedFields,
    entry.sourceDocumentId,
    entry.sourceDocumentName,
    entry.voidReason,
    entry.previousSnapshot
  );
  
  return expectedHash === entry.hash;
}

/**
 * Generate root hash for a collection of entries (for report verification)
 */
export async function generateRootHash(entries: TripLedgerEntry[]): Promise<string> {
  if (entries.length === 0) {
    return await generateHash('EMPTY_LEDGER');
  }
  
  // Sort entries by timestamp to ensure consistent ordering
  const sortedEntries = entries.slice().sort((a, b) => 
    a.timestamp.localeCompare(b.timestamp)
  );
  
  // Create merkle-like root by hashing all entry hashes together
  const allHashes = sortedEntries.map(entry => entry.hash).join('');
  const metadata = {
    entryCount: entries.length,
    firstTimestamp: sortedEntries[0].timestamp,
    lastTimestamp: sortedEntries[sortedEntries.length - 1].timestamp,
    allHashes
  };
  
  return await generateHash(JSON.stringify(metadata));
}

/**
 * Generate unique batch ID
 */
export function generateBatchId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `batch_${timestamp}_${random}`;
}

/**
 * Generate unique entry ID
 */
export function generateEntryId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `entry_${timestamp}_${random}`;
}