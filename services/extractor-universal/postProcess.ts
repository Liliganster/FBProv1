import type { CallsheetExtraction } from './config/schema';

/**
 * Post-processing for extracted callsheet data.
 * Filters out logistics/non-filming locations and bad project names.
 */

// Keywords that indicate logistics or non-principal filming (NOT main filming locations)
// Using word boundaries to avoid false positives (e.g., "Stadtpark" vs "parking")
const NON_PRINCIPAL_KEYWORDS = [
  // Logistics - word boundary patterns
  { pattern: /\b(basis|basecamp)\b/i, description: 'base/basecamp' },
  { pattern: /\b(parken|parking|parkplatz|parkhaus)\b/i, description: 'parking' },
  { pattern: /\baufenthalt\b/i, description: 'crew rest area' },
  { pattern: /\b(kostum|kostuem|wardrobe|vestuario)\b/i, description: 'wardrobe' },
  { pattern: /\b(maske|makeup|hair|peluqueria)\b/i, description: 'makeup/hair' },
  { pattern: /\b(lunch|catering|essen)\b/i, description: 'catering' },
  { pattern: /\b(team|technik|office|meeting)\b/i, description: 'office/meeting' },
  { pattern: /\b(transport|pickup|driver|shuttle)\b/i, description: 'transport' },
  { pattern: /\b(load|unload|holding)\b/i, description: 'loading area' },
  { pattern: /\b(green room|production office)\b/i, description: 'production office' },
  { pattern: /\b(mobile|trailer|wohnwagen)\b/i, description: 'trailer' },
  { pattern: /\b(treffpunkt|meeting point)\b/i, description: 'meeting point' },
  { pattern: /\b(hospital|krankenhaus|arzt)\b/i, description: 'hospital' },
  { pattern: /\b(toiletten|toilets|wc|restroom|sanitar)\b/i, description: 'restrooms' },
  { pattern: /\b(production company|productora|producer)\b/i, description: 'production company mentioned' },
  { pattern: /\b(oficina|office|buero|buro)\b/i, description: 'office (non filming)' },
  { pattern: /\b(inventar|inventario|material|equipment|rental)\b/i, description: 'equipment/logistics' },

  // Non-principal filming
  { pattern: /\b(drone|drones|drohne|drohnen|dron|uav)\b/i, description: 'drones' },
  { pattern: /\b(aerial|aerials|luftaufnahmen|luftbild|luftbilder)\b/i, description: 'aerial shots' },
  { pattern: /\b(b-unit|b unit|second unit|segunda unidad|2\. einheit|zweite einheit|2a unidad|2da unidad)\b/i, description: 'b-unit' },
  { pattern: /\b(weather cover|schlechtwetter|wetteralternative)\b/i, description: 'weather cover' },
  { pattern: /\b(backup|respaldo|ersatz)\b/i, description: 'backup' }
];

// Hints that strongly indicate principal filming locations
const PRINCIPAL_HINTS = [
  'drehort', 'set', 'set principal', 'principal set', 'location', 'scene location', 'motiv', 'szene', 'filming', 'shooting', 'rodaje', 'locacion', 'locaci\u00f3n'
];

// Known location names that should NEVER be filtered (famous places)
const PROTECTED_LOCATIONS = [
  'stadtpark', 'central park', 'hyde park', 'volkspark', 'englischer garten',
  'prater', 'tiergarten', 'jardines', 'parque', 'parc'
];

// Known broadcasters, streaming platforms, and service companies (NOT production companies)
const NON_PRODUCTION_COMPANIES = [
  // German broadcasters
  'ard', 'zdf', 'rtl', 'sat.1', 'pro7', 'prosieben', 'vox', 'kabel eins', 'rtl2',
  'ard degeto', 'zdf enterprises', 'mdr', 'ndr', 'wdr', 'br', 'swr', 'hr', 'rbb',

  // Austrian/Swiss
  'orf', 'orf1', 'orf2', 'orf3', 'srf', 'srf1', 'srf2',

  // Spanish/Latin American
  'rtve', 'tve', 'tve1', 'tve2', 'antena 3', 'telecinco', 'la sexta', 'cuatro',
  'television espanola', 'televisi\u00f3n espa\u00f1ola',

  // International broadcasters
  'bbc', 'itv', 'channel 4', 'sky', 'rai', 'france televisions', 'arte', 'arte france',

  // Streaming platforms (unless explicitly producing)
  'netflix', 'amazon prime', 'hbo', 'hbo max', 'disney+', 'apple tv+', 'paramount+',

  // Film funds and government agencies
  'bkm', 'ffa', 'dfff', 'icaa', 'eurimages', 'media programme', 'creative europe',
  'filmforderung', 'film fund', 'medienboard',

  // Service/rental companies
  'arri', 'panavision', 'arri rental', 'camera rental', 'grip', 'lighting',
];

// Document type keywords that should NEVER be a project name
const DOCUMENT_TYPE_KEYWORDS = [
  'callsheet', 'call sheet', 'call-sheet',
  'hoja de rodaje', 'hoja rodaje',
  'disposicion diaria', 'disposici\u00f3n diaria', 'disposicion', 'disposici\u00f3n',
  'drehplan', 'tagesdisposition',
  'production sheet', 'crew list', 'crew sheet',
  'shooting schedule', 'schedule'
];

function looksLikeCompanyName(s: string): boolean {
  if (!s) return false;
  const x = s.toLowerCase();
  return /\b(gmbh|llc|ltd\.?|inc\.?|kg|og|s\.?l\.?|s\.?a\.?|film(produktion)?|pictures|entertainment|studio|studios)\b/.test(x)
    || /\b(produktion|production|productora|producer|producers)\b/.test(x);
}

function isNonProductionCompany(company: string): boolean {
  const normalized = company.toLowerCase().trim();
  // We now ALLOW broadcasters/streamers because often they are the only "production" entity listed
  // or the user considers them the client.
  /*
  for (const nonProd of NON_PRODUCTION_COMPANIES) {
    if (normalized === nonProd || normalized.includes(nonProd)) return true;
  }
  */

  // Still filter out obvious service/rental companies
  if (normalized.includes('rental') || normalized.includes('hire') || normalized.includes('equipment') || normalized.includes('services') || normalized.includes('catering') || normalized.includes('security')) {
    return true;
  }
  return false;
}

// Check if string is a document type (not a project name)
function isDocumentType(s: string): boolean {
  if (!s) return false;
  const normalized = s.toLowerCase().trim();
  for (const docType of DOCUMENT_TYPE_KEYWORDS) {
    if (normalized === docType || normalized.startsWith(docType + ' ')) return true;
  }
  if (/^(call[\s-]?sheet|disposici[o\u00f3]n|drehplan)\s*(#?\d+|\d+\s*of\s*\d+)?$/i.test(normalized)) {
    return true;
  }
  return false;
}

/**
 * Simple filter - removes logistics and non-principal filming locations
 * Trusts AI for everything else
 */
function isPrincipalFilmingLocation(location: string): boolean {
  if (!location || location.trim().length < 3) {
    console.log(`[PostProcess] NO Filtered (too short): "${location}"`);
    return false;
  }

  const normalized = location.toLowerCase().trim();

  // Protected famous places
  for (const protectedLoc of PROTECTED_LOCATIONS) {
    if (normalized.includes(protectedLoc)) {
      console.log(`[PostProcess] OK Protected location (famous place): "${location}"`);
      return true;
    }
  }

  // Filter explicit logistics keywords
  for (const { pattern, description } of NON_PRINCIPAL_KEYWORDS) {
    if (pattern.test(normalized)) {
      console.log(`[PostProcess] NO Filtered (${description}): "${location}"`);
      return false;
    }
  }

  // Filter things that look like companies or phone/email blobs
  if (looksLikeCompanyName(location) || isNonProductionCompany(location)) {
    console.log(`[PostProcess] NO Filtered (looks like company): "${location}"`);
    return false;
  }
  if (/@/.test(location) || /\b(tel|phone|mobil|mobile|telefon)\b/i.test(location)) {
    console.log(`[PostProcess] NO Filtered (contact info): "${location}"`);
    return false;
  }
  if (/\d{2,}[-\s]?\d{3,}[-\s]?\d{3,}/.test(location)) {
    console.log(`[PostProcess] NO Filtered (likely phone): "${location}"`);
    return false;
  }

  console.log(`[PostProcess] OK Accepted: "${location}"`);
  return true;
}

// Context-aware check: if the source text mentions the location near non-principal markers (drones, b-unit, etc.)
function classifyContextAroundLocation(location: string, sourceText: string): 'principal' | 'non' | 'unknown' {
  if (!sourceText || !location) return 'unknown';
  const src = sourceText.toLowerCase();
  const needle = location.toLowerCase().trim();
  if (!needle) return 'unknown';

  let idx = 0;
  let foundPrincipal = false;
  let foundNon = false;
  const maxChecks = 10;
  let checks = 0;
  while (checks < maxChecks) {
    const pos = src.indexOf(needle, idx);
    if (pos === -1) break;
    const start = Math.max(0, pos - 160);
    const end = Math.min(src.length, pos + needle.length + 160);
    const windowText = src.slice(start, end);

    if (PRINCIPAL_HINTS.some((h) => windowText.includes(h))) {
      foundPrincipal = true;
    }
    if (NON_PRINCIPAL_KEYWORDS.some(({ pattern }) => pattern.test(windowText))) {
      foundNon = true;
    }

    idx = pos + needle.length;
    checks += 1;
  }

  if (foundPrincipal && !foundNon) return 'principal';
  if (foundNon && !foundPrincipal) return 'non';
  return 'unknown';
}

/**
 * Try to infer project name from filename
 * Example: "FUNDBOX_call_sheet_3.pdf" -> "FUNDBOX"
 */
function inferProjectNameFromFilename(fileName: string): string | null {
  if (!fileName) return null;
  const nameWithoutExt = fileName.replace(/\.(pdf|png|jpg|jpeg|txt|csv)$/i, '');
  const match1 = nameWithoutExt.match(/^([A-Z][A-Z0-9_-]{2,20})[\s_-]*(call[\s_-]?sheet|hoja|dispo)/i);
  if (match1 && match1[1]) return match1[1].replace(/[_-]/g, ' ').trim();
  const match2 = nameWithoutExt.match(/^([A-Z][A-Z0-9]{3,11})$/);
  if (match2 && match2[1]) return match2[1];
  const match3 = nameWithoutExt.match(/^([A-Za-z0-9][A-Za-z0-9\s]{2,30})[\s_-]+(call|sheet|hoja|dispo)/i);
  if (match3 && match3[1]) return match3[1].trim();
  return null;
}

function inferProjectNameFromContext(sourceText: string): string | null {
  if (!sourceText) return null;
  const filenameMatch = sourceText.match(/([A-Z][A-Z0-9_-]{3,20})[\s_-]*(call[\s_-]?sheet|hoja[\s_-]?de[\s_-]?rodaje|dispo)/i);
  if (filenameMatch && filenameMatch[1]) {
    const candidate = filenameMatch[1].replace(/[_-]/g, ' ').trim();
    if (!['CALL', 'SHEET', 'HOJA', 'RODAJE', 'DISPO'].includes(candidate.toUpperCase())) {
      return candidate;
    }
  }
  const topText = sourceText.slice(0, Math.min(sourceText.length, 1000));
  const projectCodeMatch = topText.match(/\b([A-Z][A-Z0-9]{3,11})\b/);
  if (projectCodeMatch && projectCodeMatch[1]) {
    const candidate = projectCodeMatch[1];
    const excludePatterns = ['CALL', 'SHEET', 'DATE', 'TIME', 'CREW', 'CAST', 'PAGE', 'PROD'];
    if (!excludePatterns.includes(candidate)) {
      return candidate;
    }
  }
  const projectKeywordMatch = sourceText.match(/(?:project|serie|film|titulo|t\u00edtulo|title|show):\s*([A-Za-z0-9][A-Za-z0-9\s-]{2,30})/i);
  if (projectKeywordMatch && projectKeywordMatch[1]) {
    const candidate = projectKeywordMatch[1].trim();
    if (!looksLikeCompanyName(candidate) && !isNonProductionCompany(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function postProcessCrewFirstData(
  data: CallsheetExtraction,
  sourceText?: string,
  fileName?: string
): CallsheetExtraction {
  const date = (data.date || '').trim();
  let projectName = (data.projectName || '').trim();

  const seenCompanies = new Set<string>();
  const productionCompanies = (Array.isArray(data.productionCompanies) ? data.productionCompanies : [])
    .map((c) => (c || '').trim())
    .filter(Boolean)
    .filter((c) => {
      if (isNonProductionCompany(c)) {
        console.log(`[PostProcess] NO Filtered non-production company: "${c}"`);
        return false;
      }
      return true;
    })
    .filter((c) => {
      const normalized = c.toLowerCase();
      if (seenCompanies.has(normalized)) {
        console.log(`[PostProcess] NO Filtered duplicate production company: "${c}"`);
        return false;
      }
      seenCompanies.add(normalized);
      return true;
    });

  console.log('[PostProcess] Extracted data:', { date, projectName, productionCompanies, locationsCount: data.locations?.length });

  const seen = new Set<string>();
  const locations = (data.locations || [])
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .filter(isPrincipalFilmingLocation)
    .filter((s) => {
      if (!sourceText) return true;
      const context = classifyContextAroundLocation(s, sourceText);
      if (context === 'non') {
        console.log(`[PostProcess] NO Filtered by context (non-principal): "${s}"`);
        return false;
      }
      return true;
    })
    .filter((s) => {
      const key = s.toLowerCase();
      if (seen.has(key)) {
        console.log(`[PostProcess] NO Filtered (duplicate): "${s}"`);
        return false;
      }
      seen.add(key);
      return true;
    });

  console.log(`[PostProcess] Final principal filming locations count: ${locations.length}`, locations);
  if (locations.length === 0) {
    console.warn('[PostProcess] WARNING: No principal filming locations found after filtering!');
  }

  if (projectName && isDocumentType(projectName)) {
    console.warn('[PostProcess] NO Rejected projectName - is document type (not project):', projectName);
    projectName = '';
  }
  if (projectName && (looksLikeCompanyName(projectName) || isNonProductionCompany(projectName))) {
    console.warn('[PostProcess] NO Rejected projectName - looks like a company:', projectName);
    projectName = '';
  }
  if (!projectName && sourceText) {
    console.warn('[PostProcess] projectName is empty, attempting to infer from context...');
    const inferred = inferProjectNameFromContext(sourceText);
    if (inferred) {
      projectName = inferred;
      console.log(`[PostProcess] OK Successfully inferred projectName from context: "${projectName}"`);
    }
  }
  if (!projectName && fileName) {
    console.warn('[PostProcess] projectName still empty, attempting to infer from filename...');
    const inferredFromFile = inferProjectNameFromFilename(fileName);
    if (inferredFromFile) {
      projectName = inferredFromFile;
      console.log(`[PostProcess] OK Successfully inferred projectName from filename: "${projectName}"`);
    }
  }
  if (!projectName) {
    console.warn('[PostProcess] All inference attempts failed. Using fallback: "Untitled Project"');
    projectName = 'Untitled Project';
  }

  return { date, projectName, productionCompanies, locations };
}

