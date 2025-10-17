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
  'drone', 'drones', 'drohne', 'drohnen', 'dron', 'uav', 'aerial', 'aerials', 'luftaufnahmen', 'luftbild', 'luftbilder',
  'b-unit', 'b unit', 'second unit', 'segunda unidad', '2. einheit', 'zweite einheit', '2ª unidad', '2da unidad',
  'weather cover', 'schlechtwetter', 'wetteralternative', 'alternative', 'alternativa',
  'backup', 'respaldo', 'ersatz'
];

// Hints that strongly indicate principal filming locations
const PRINCIPAL_HINTS = [
  'drehort', 'set', 'set principal', 'principal set', 'location', 'scene location', 'motiv', 'szene', 'filming', 'shooting', 'rodaje'
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

// Context-aware check: if the source text mentions the location near non-principal markers (drones, b-unit, etc.)
function classifyContextAroundLocation(location: string, sourceText: string): 'principal' | 'non' | 'unknown' {
  if (!sourceText || !location) return 'unknown';
  const src = sourceText.toLowerCase();
  const needle = location.toLowerCase().trim();
  if (!needle) return 'unknown';

  // Search multiple occurrences and inspect a window around each
  let idx = 0;
  let foundPrincipal = false;
  let foundNon = false;
  const maxChecks = 10; // safety bound
  let checks = 0;
  while (checks < maxChecks) {
    const pos = src.indexOf(needle, idx);
    if (pos === -1) break;
    const start = Math.max(0, pos - 160);
    const end = Math.min(src.length, pos + needle.length + 160);
    const windowText = src.slice(start, end);

    // Check hints within window
    if (PRINCIPAL_HINTS.some(h => windowText.includes(h))) {
      foundPrincipal = true;
    }
    if (NON_PRINCIPAL_KEYWORDS.some(k => windowText.includes(k))) {
      foundNon = true;
    }

    // Advance
    idx = pos + needle.length;
    checks += 1;
  }

  if (foundPrincipal && !foundNon) return 'principal';
  if (foundNon && !foundPrincipal) return 'non';
  return 'unknown';
}

// Post-process extracted data - simple filtering only
export function postProcessCrewFirstData(data: CallsheetExtraction, sourceText?: string): CallsheetExtraction {
  const date = (data.date || '').trim();
  const projectName = (data.projectName || '').trim();
  
  // Handle productionCompanies as array, filter out empty strings and deduplicate
  const seenCompanies = new Set<string>();
  const productionCompanies = (Array.isArray(data.productionCompanies) ? data.productionCompanies : [])
    .map(c => (c || '').trim())
    .filter(Boolean)
    .filter(c => {
      const normalized = c.toLowerCase();
      if (seenCompanies.has(normalized)) {
        console.log(`[PostProcess] ❌ Filtered duplicate production company: "${c}"`);
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
    .filter(isPrincipalFilmingLocation) // Filters logistics and explicit non-principal markers in the string
    .filter((s) => {
      // Context-aware filtering using source text (if provided)
      if (!sourceText) return true;
      const context = classifyContextAroundLocation(s, sourceText);
      if (context === 'non') {
        console.log(`[PostProcess] ❌ Filtered by context (non-principal): "${s}"`);
        return false;
      }
      // If unknown or principal → keep
      return true;
    })
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
  
  return { date, projectName, productionCompanies, locations };
}



