// JSON Schema for the extractor output
// This schema is used with Gemini responseSchema to enforce strict JSON.

export const callsheetSchema = {
  type: "object",
  properties: {
    date: { type: "string", description: "Normalized shooting day date YYYY-MM-DD" },
    projectName: { type: "string", description: "Main project/production name" },
    productionCompany: { type: "string", description: "Production company name" },
    locations: {
      type: "array",
      description: "Ordered list of MAIN filming locations only (max 3-5 principal addresses)",
      items: { type: "string" },
    },
  },
  required: ["date", "projectName", "productionCompany", "locations"],
  additionalProperties: false,
} as const;

export type CallsheetExtraction = {
  date: string;
  projectName: string;
  productionCompany: string;
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
  projectName: string; // Título del proyecto/película/serie (ej: "El Reino", "Dark", "Succession")
  productionCompany?: string | null; // Productora/empresa (ej: "Warner Bros", "Netflix", "UFA Fiction")
  motiv?: string | null; // Motivo/locación narrativa (ej: "Casa de María", "Oficina del FBI", "Exterior Bosque")
  episode?: string | null; // Número o título del episodio (para series)
  shootingDay?: string | null; // Día de rodaje (ej: "DT3", "Día 15", "Tag 8")
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
      description: "Title of the project/film/series (e.g., 'El Reino', 'Dark', 'Succession')"
    },
    productionCompany: {
      type: ["string", "null"],
      description: "Production company/studio name (e.g., 'Warner Bros', 'Netflix', 'UFA Fiction')"
    },
    motiv: {
      type: ["string", "null"],
      description: "Narrative location/motif (e.g., 'Casa de María', 'FBI Office', 'Forest Exterior')"
    },
    episode: {
      type: ["string", "null"],
      description: "Episode number or title for series (e.g., 'EP101', 'Pilot', 'Folge 3')"
    },
    shootingDay: {
      type: ["string", "null"],
      description: "Shooting day number or designation (e.g., 'DT3', 'Day 15', 'Tag 8')"
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

