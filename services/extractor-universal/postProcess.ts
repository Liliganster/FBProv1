import type { CallsheetExtraction } from './config/schema';

/**
 * Post-processing for extracted callsheet data.
 * ONLY filters logistics keywords - trusts AI for everything else.
 * NO maximum limits, NO strict format validation.
 */

// Keywords that indicate logistics or non-principal filming (NOT main filming locations)
const NON_PRINCIPAL_KEYWORDS = [
  // Logistics
  'basis', 'base', 'basecamp', 
  'parken', 'parking', 'parkplatz',
  'aufenthalt', 
  'kostüm', 'wardrobe', 'vestuario',
  'maske', 'makeup', 'hair', 'peluquería',
  'lunch', 'catering', 'essen',
  'team', 'technik', 'office', 'meeting',
  'transport', 'pickup', 'driver', 'shuttle',
  'load', 'unload', 'holding',
  'green room', 'production office', 
  'mobile', 'trailer', 'wohnwagen',
  'treffpunkt', 'meeting point',
  'hospital', 'krankenhaus', 'arzt',
  'toiletten', 'toilets', 'wc', 'restroom', 'sanitär',
  
  // Non-principal filming
  'drone', 'drones', 'drohne', 'drohnen',
  'b-unit', 'b unit', 'second unit', 'segunda unidad',
  'weather cover', 'alternativ', 'alternative', 'alternativa',
  'backup', 'respaldo', 'ersatz'
];

/**
 * Simple filter - removes logistics and non-principal filming locations
 * Trusts AI for everything else
 */
function isPrincipalFilmingLocation(location: string): boolean {
  if (!location || location.trim().length < 3) {
    console.log(`[PostProcess] ❌ Filtered (too short): "${location}"`);
    return false;
  }

  const normalized = location.toLowerCase().trim();

  // Filter out logistics and non-principal filming (drones, b-unit, weather cover, etc.)
  for (const keyword of NON_PRINCIPAL_KEYWORDS) {
    if (normalized.includes(keyword)) {
      console.log(`[PostProcess] ❌ Filtered (non-principal/logistics): "${location}"`);
      return false;
    }
  }

  // ✅ Accept - trust the AI
  console.log(`[PostProcess] ✅ Accepted: "${location}"`);
  return true;
}

// Post-process extracted data - simple filtering only
export function postProcessCrewFirstData(data: CallsheetExtraction): CallsheetExtraction {
  const date = (data.date || '').trim();
  const projectName = (data.projectName || '').trim();
  const productionCompany = (data.productionCompany || '').trim() || 'Unknown';
  const seen = new Set<string>();
  
  const locations = (data.locations || [])
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .filter(isPrincipalFilmingLocation) // Filters logistics and non-principal (drones, b-unit, etc.)
    .filter((s) => {
      // Deduplicate
      const key = s.toLowerCase();
      if (seen.has(key)) {
        console.log(`[PostProcess] ❌ Filtered (duplicate): "${s}"`);
        return false;
      }
      seen.add(key);
      return true;
    });
    // NO .slice() - NO maximum limit!

  console.log(`[PostProcess] Final principal filming locations count: ${locations.length}`, locations);
  
  if (locations.length === 0) {
    console.warn('[PostProcess] ⚠️ WARNING: No principal filming locations found after filtering!');
  }
  
  return { date, projectName, productionCompany, locations };
}



