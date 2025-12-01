export interface PersonalizationSettings {
    backgroundImage: string;
    uiTransparency: number;
    uiBlur: number;
    backgroundBlur: number;
    theme: 'light' | 'dark';
}

export const DEFAULT_PERSONALIZATION_SETTINGS: PersonalizationSettings = {
    backgroundImage: '',
    uiTransparency: 0.2,
    uiBlur: 16,
    backgroundBlur: 0,
    theme: 'light'
};


// FIX: Add View type definition to be shared across components.
export type View = 'dashboard' | 'trips' | 'projects' | 'settings' | 'reports' | 'advanced' | 'calendar' | 'plans';

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

export type ExpenseCategory = 'fuel' | 'maintenance';

export interface ExpenseDocument {
  id: string;
  userId: string;
  projectId?: string | null;
  tripId?: string | null;
  category: ExpenseCategory;
  amount: number;
  currency?: string | null;
  description?: string | null;
  invoiceDate?: string | null;
  filename: string;
  url: string;
  storagePath?: string | null;
  createdAt: string;
  updatedAt: string;
}

// UserProfile merges UserSettings and the old Driver interface
// Full extended profile (restored fields used across components)
export interface UserProfile {
  id: string
  email?: string | null
  fullName?: string | null
  name?: string | null
  plan?: PlanTier | null
  licensePlate?: string | null
  uid?: string | null
  address?: string | null
  city?: string | null
  country?: string | null
  profilePicture?: string | null
  color?: string | null
  ratePerKm?: number | null
  /** @deprecated Google Maps API key is managed server-side */
  googleMapsApiKey?: string | null
  openRouterApiKey?: string | null
  openRouterModel?: string | null
  lockedUntilDate?: string | null
  vehicleType?: 'combustion' | 'electric' | null
  fuelConsumption?: number | null
  fuelPrice?: number | null
  energyConsumption?: number | null
  energyPrice?: number | null
  maintenanceCostPerKm?: number | null
  parkingCostPerKm?: number | null
  tollsCostPerKm?: number | null
  finesCostPerKm?: number | null
  miscCostPerKm?: number | null
  avatarUrl?: string | null
  createdAt?: string
  updatedAt?: string
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
  id: string
  userId: string
  name: string
  description?: string | null
  producer: string
  ratePerKm?: number | null
  ownerDriverId?: string | null
  callsheets?: CallsheetFile[]
  createdAt: string
  updatedAt: string
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

export type PlanTier = 'free' | 'pro' | 'enterprise';

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

// Projects State interface for React context
export interface ProjectsState {
  projects: Project[];
  editingProject: Project | null;
  selectedProject: string | null;
  loading: boolean;
  error: string | null;
}
