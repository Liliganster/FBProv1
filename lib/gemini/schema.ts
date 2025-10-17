export const responseSchema = {
  type: 'object',
  properties: {
    date: { type: 'string' },
    projectName: { type: 'string' },
    productionCompanies: { type: 'array', items: { type: 'string' } },
    locations: { type: 'array', items: { type: 'string' } },
  },
  required: ['date', 'projectName', 'productionCompanies', 'locations'],
  additionalProperties: false,
} as const;

export type CrewFirstCallsheet = {
  date: string;
  projectName: string;
  productionCompanies: string[];
  locations: string[];
};

