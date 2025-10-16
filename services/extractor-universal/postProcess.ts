import type { CallsheetExtraction } from './config/schema';

import type { CallsheetExtraction } from './config/schema';

/**
 * Post-processing for extracted callsheet data
 * Applies LIGHTWEIGHT filtering to remove only obvious logistics/crew locations
 * Trusts the AI to understand context and extract appropriate filming locations
 */

// Keywords that clearly indicate logistics/crew support areas (NOT filming)
const LOGISTICS_KEYWORDS = [
  'basis', 'base', 'basecamp', 'unit base',
  'parken', 'parking', 'parkplatz', 'crew parking',
  'catering', 'lunch', 'essen',
  'aufenthalt', 'holding',
  'kostüm', 'costume', 'wardrobe',
  'maske', 'makeup', 'hair',
  'team office', 'crew office', 'production office',
  'transport', 'shuttle', 'pickup',
  'mobile', 'trailer',
  'toiletten', 'wc', 'restroom'
];

/**
 * Lightweight validation: Filter out ONLY obvious logistics locations
 * Trust the AI to understand context for everything else
 */
function isValidFilmingLocation(location: string): boolean {
  if (!location || location.trim().length < 3) {
    return false;
  }

  const normalized = location.toLowerCase().trim();

  // Filter out ONLY obvious logistics keywords
  for (const keyword of LOGISTICS_KEYWORDS) {
    if (normalized.includes(keyword)) {
      console.log(`[PostProcess] ❌ Filtered (logistics): "${location}"`);
      return false;
    }
  }

  // Accept everything else - trust the AI
  console.log(`[PostProcess] ✅ Accepted: "${location}"`);
  return true;
}

// Post-process extracted data:
// - Trim strings
// - Filter out logistics locations only
// - Deduplicate preserving order
// - Trust AI for everything else (addresses may be complete or partial)
export function postProcessCrewFirstData(data: CallsheetExtraction): CallsheetExtraction {
  const date = (data.date || '').trim();
  const projectName = (data.projectName || '').trim();
  const seen = new Set<string>();
  
  const locations = (data.locations || [])
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .filter((loc) => {
      // Filter out ONLY logistics locations - trust AI for everything else
      if (!isValidFilmingLocation(loc)) {
        console.log(`[PostProcess] Filtered out: "${loc}"`);
        return false;
      }
      return true;
    })
    .filter((s) => {
      // Deduplicate
      if (seen.has(s.toLowerCase())) return false;
      seen.add(s.toLowerCase());
      return true;
    });

  console.log(`[PostProcess] Final locations count: ${locations.length}`, locations);
  return { date, projectName, locations };
}





