



export interface PersonalizationSettings {
    backgroundImage: string;
    uiTransparency: number;
    uiBlur: number;
    backgroundBlur: number;
}


// FIX: Add View type definition to be shared across components.
export type View = 'dashboard' | 'trips' | 'projects' | 'settings' | 'reports' | 'advanced' | 'calendar';

export interface User {
  id: string;
  email: string;
}

export interface UserCredentials {
  id: string;
  password?: string; // Should be hashed in a real app
}


export enum SpecialOrigin {
  HOME = 'HOME',
  CONTINUATION = 'CONTINUATION',
  END_OF_CONTINUATION = 'END_OF_CONTINUATION',
}

export enum DocumentType {
  CALLSHEET = 'callsheet',
  EMAIL = 'email',
}

// UserProfile merges UserSettings and the old Driver interface
export interface UserProfile {
  id: string;
  name: string;
  licensePlate?: string;
  uid?: string;
  address?: string;
  city?: string;
  country?: string;
  profilePicture?: string;
  color?: string;
  ratePerKm?: number;
  googleMapsApiKey?: string;
  googleCalendarApiKey?: string;
  googleCalendarClientId?: string;
  googleCalendarPrimaryId?: string;
  openRouterApiKey?: string;
  openRouterModel?: string;
  lockedUntilDate?: string;
  
  // New fields for advanced trip costing
  vehicleType?: 'combustion' | 'electric';
  fuelConsumption?: number; // L/100km
  fuelPrice?: number; // €/L
  energyConsumption?: number; // kWh/100km
  energyPrice?: number; // €/kWh
  maintenanceCostPerKm?: number; // €/km
  parkingCostPerKm?: number; // €/km
  tollsCostPerKm?: number; // €/km
  finesCostPerKm?: number; // €/km
  miscCostPerKm?: number; // €/km for uncategorized costs
}

export interface Trip {
  id: string;
  date: string;
  locations: string[]; // Replaced origin and destination
  distance: number; // in kilometers
  projectId: string;
  reason: string;
  specialOrigin: SpecialOrigin;
  warnings?: string[];
  passengers?: number;
  hash?: string;
  previousHash?: string;
  ratePerKm?: number;
  editJustification?: string; // Required when editing existing trips
}

export interface CallsheetFile {
  id: string;
  name: string;
  type: string;
}

export interface Project {
  id: string;
  name: string;
  producer: string;
  callsheets?: CallsheetFile[];
  ratePerKm?: number;
  // FIX: Add ownerDriverId to associate projects with a driver/user profile.
  ownerDriverId?: string;
}

export interface AiModelInfo {
  id: string;
  name?: string;
}

export interface Report {
  id: string;
  generationDate: string;
  startDate: string;
  endDate: string;
  projectId: string;
  projectName: string;
  totalDistance: number;
  trips: Trip[];
  userProfileSnapshot: UserProfile;
  signature?: string;
  firstTripHash?: string;
  lastTripHash?: string;
  
  // Ledger integrity verification
  ledgerVerification?: TripLedgerVerification;
  generationTimestamp?: string;
}

// Trip Ledger System - Immutable append-only log for trip operations
export enum TripLedgerOperation {
  CREATE = 'CREATE',
  AMEND = 'AMEND',
  VOID = 'VOID',
  IMPORT_BATCH = 'IMPORT_BATCH'
}

export enum TripLedgerSource {
  MANUAL = 'MANUAL',
  AI_AGENT = 'AI_AGENT',
  CSV_IMPORT = 'CSV_IMPORT',
  BULK_UPLOAD = 'BULK_UPLOAD'
}

export interface TripLedgerEntry {
  id: string; // Unique entry ID
  hash: string; // SHA-256 hash of this entry
  previousHash: string | null; // Hash of previous entry in chain
  timestamp: string; // ISO timestamp of operation
  operation: TripLedgerOperation;
  source: TripLedgerSource;
  userId: string; // Who performed the operation
  batchId?: string; // Group ID for batch operations
  
  // Trip data
  tripId: string;
  tripSnapshot: Trip; // Complete trip state after operation
  
  // Amendment/Void specific data
  correctionReason?: string; // Required for AMEND operations
  changedFields?: string[]; // Fields that were modified
  sourceDocumentId?: string; // ID of callsheet, email, or document that motivated the change
  sourceDocumentName?: string; // Human-readable name of source document
  
  // Void specific data
  voidReason?: string; // Required for VOID operations
  previousSnapshot?: Trip; // Trip state before voiding (for audit)
}

export interface TripLedgerBatch {
  batchId: string;
  timestamp: string;
  source: TripLedgerSource;
  userId: string;
  entryCount: number;
  firstEntryHash: string;
  lastEntryHash: string;
  sourceDocuments?: {
    id: string;
    name: string;
    type: string;
  }[];
}

export interface TripLedgerVerification {
  isValid: boolean;
  totalEntries: number;
  rootHash: string;
  firstEntry?: TripLedgerEntry;
  lastEntry?: TripLedgerEntry;
  brokenChainAt?: string; // Hash where chain breaks if invalid
  verificationTimestamp: string;
}

// Projected state for UI (computed from ledger)
export interface TripProjection {
  trip: Trip;
  isVoided: boolean;
  createdAt: string;
  lastModifiedAt: string;
  amendmentCount: number;
  lastOperation: TripLedgerOperation;
  sourceDocument?: {
    id: string;
    name: string;
  };
}

// Route Template for frequent trips
export interface RouteTemplate {
  id: string;
  name: string;
  category: 'business' | 'commute' | 'client' | 'other';
  startLocation: string;
  endLocation: string;
  distance: number; // km
  estimatedTimeMinutes?: number;
  description?: string;
  uses: number; // usage counter
  lastUsedAt?: string; // ISO date
  createdAt: string; // ISO date
}