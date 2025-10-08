export const responseSchema = {
  type: 'object',
  properties: {
    date: { type: 'string' },
    projectName: { type: 'string' },
    locations: { type: 'array', items: { type: 'string' } },
  },
  required: ['date', 'projectName', 'locations'],
  additionalProperties: false,
} as const;

export type CrewFirstCallsheet = {
  date: string;
  projectName: string;
  locations: string[];
};

