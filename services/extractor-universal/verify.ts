import type { CallsheetExtraction, CrewFirstCallsheet, CrewFirstLocation } from './config/schema';

export function isCallsheetExtraction(x: any): x is CallsheetExtraction {
  return (
    x && typeof x === 'object' &&
    typeof x.date === 'string' &&
    typeof x.projectName === 'string' &&
    Array.isArray(x.productionCompanies) && x.productionCompanies.every((s: any) => typeof s === 'string') &&
    Array.isArray(x.locations) && x.locations.every((s: any) => typeof s === 'string')
  );
}

export function isCrewFirstLocation(x: any): x is CrewFirstLocation {
  if (!x || typeof x !== 'object') return false;

  const validLocationTypes = [
    'FILMING_PRINCIPAL',
    'UNIT_BASE',
    'CATERING',
    'MAKEUP_HAIR',
    'WARDROBE',
    'CREW_PARKING',
    'LOAD_UNLOAD'
  ];

  return (
    typeof x.location_type === 'string' &&
    validLocationTypes.includes(x.location_type) &&
    typeof x.address === 'string' &&
    (x.name === undefined || typeof x.name === 'string') &&
    (x.formatted_address === undefined || x.formatted_address === null || typeof x.formatted_address === 'string') &&
    (x.latitude === undefined || x.latitude === null || typeof x.latitude === 'number') &&
    (x.longitude === undefined || x.longitude === null || typeof x.longitude === 'number') &&
    (x.notes === undefined || (Array.isArray(x.notes) && x.notes.every((n: any) => typeof n === 'string'))) &&
    (x.confidence === undefined || typeof x.confidence === 'number')
  );
}

export function isCrewFirstCallsheet(x: any): x is CrewFirstCallsheet {
  return (
    x && typeof x === 'object' &&
    x.version === 'parser-crew-1' &&
    typeof x.date === 'string' &&
    typeof x.projectName === 'string' &&
    (x.productionCompany === undefined || x.productionCompany === null || typeof x.productionCompany === 'string') &&
    (x.motiv === undefined || x.motiv === null || typeof x.motiv === 'string') &&
    (x.episode === undefined || x.episode === null || typeof x.episode === 'string') &&
    (x.shootingDay === undefined || x.shootingDay === null || typeof x.shootingDay === 'string') &&
    (x.generalCallTime === undefined || x.generalCallTime === null || typeof x.generalCallTime === 'string') &&
    Array.isArray(x.locations) &&
    x.locations.every((loc: any) => isCrewFirstLocation(loc)) &&
    Array.isArray(x.rutas)
  );
}
