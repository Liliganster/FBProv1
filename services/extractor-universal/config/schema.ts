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

