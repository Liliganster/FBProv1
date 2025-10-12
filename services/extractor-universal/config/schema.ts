// JSON Schema for the extractor output
// This schema is used with Gemini responseSchema to enforce strict JSON.

export const callsheetSchema = {
  type: "object",
  properties: {
    date: { type: "string", description: "Normalized shooting day date YYYY-MM-DD" },
    projectName: { type: "string", description: "Main project/production name" },
    locations: {
      type: "array",
      description: "Ordered list of relevant locations (addresses or place names)",
      items: { type: "string" },
    },
  },
  required: ["date", "projectName", "locations"],
  additionalProperties: false,
} as const;

export type CallsheetExtraction = {
  date: string;
  projectName: string;
  locations: string[];
};

// CrewFirst Schema - Full structured schema for crew-first logistics
export type LocationType =
  | 'FILMING_PRINCIPAL'
  | 'UNIT_BASE'
  | 'CATERING'
  | 'MAKEUP_HAIR'
  | 'WARDROBE'
  | 'CREW_PARKING'
  | 'LOAD_UNLOAD';

export type CrewFirstLocation = {
  location_type: LocationType;
  name?: string;
  address: string;
  formatted_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string[];
  confidence?: number;
};

export type CrewFirstCallsheet = {
  version: 'parser-crew-1';
  date: string; // YYYY-MM-DD
  projectName: string;
  shootingDay?: string | null;
  generalCallTime?: string | null; // HH:MM
  locations: CrewFirstLocation[];
  rutas: any[]; // Empty array, generated programmatically later
};

export const crewFirstCallsheetSchema = {
  type: "object",
  properties: {
    version: {
      type: "string",
      enum: ["parser-crew-1"],
      description: "Schema version identifier"
    },
    date: {
      type: "string",
      description: "Normalized shooting day date YYYY-MM-DD"
    },
    projectName: {
      type: "string",
      description: "Main project/production name"
    },
    shootingDay: {
      type: ["string", "null"],
      description: "Shooting day number or designation (optional)"
    },
    generalCallTime: {
      type: ["string", "null"],
      description: "General call time HH:MM format (optional)"
    },
    locations: {
      type: "array",
      description: "Structured list of crew-first logistics locations",
      items: {
        type: "object",
        properties: {
          location_type: {
            type: "string",
            enum: [
              "FILMING_PRINCIPAL",
              "UNIT_BASE",
              "CATERING",
              "MAKEUP_HAIR",
              "WARDROBE",
              "CREW_PARKING",
              "LOAD_UNLOAD"
            ],
            description: "Category of the location"
          },
          name: {
            type: "string",
            description: "Optional name/label for the location"
          },
          address: {
            type: "string",
            description: "Original address from the text (required)"
          },
          formatted_address: {
            type: ["string", "null"],
            description: "Normalized address for geocoding"
          },
          latitude: {
            type: ["number", "null"],
            description: "GPS latitude coordinate"
          },
          longitude: {
            type: ["number", "null"],
            description: "GPS longitude coordinate"
          },
          notes: {
            type: "array",
            items: { type: "string" },
            description: "Max 2 logistic notes (meal times, trailer numbers, etc.)"
          },
          confidence: {
            type: "number",
            description: "Confidence score 0-1 for location classification",
            minimum: 0,
            maximum: 1
          }
        },
        required: ["location_type", "address"],
        additionalProperties: false
      }
    },
    rutas: {
      type: "array",
      description: "Routes array (empty, generated programmatically)",
      items: {}
    }
  },
  required: ["version", "date", "projectName", "locations", "rutas"],
  additionalProperties: false
} as const;

