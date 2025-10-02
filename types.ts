



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