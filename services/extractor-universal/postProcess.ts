import type { CallsheetExtraction } from './config/schema';

import type { CallsheetExtraction } from './config/schema';

/**
 * Post-processing for extracted callsheet data.
 * Applies a HYBRID filter: blocks obvious junk but allows flexible address formats.
 */

// Expanded list of keywords that indicate logistics, not filming locations.
const LOGISTICS_KEYWORDS = [
  'basis', 'base', 'parken', 'parking', 'aufenthalt', 'kostüm', 'maske',
  'lunch', 'catering', 'team', 'technik', 'office', 'meeting', 'transport',
  'pickup', 'driver', 'car', 'wardrobe', 'load', 'unload', 'holding',
  'green room', 'production office', 'mobile', 'trailer', 'wohnwagen',
  'treffpunkt', 'meeting point', 'hospital', 'krankenhaus', 'arzt',
  'toiletten', 'toilets', 'wc', 'restroom', 'sanitär'
];

// Patterns for invalid locations like room names or general areas.
const INVALID_PATTERNS = [
  /^suite/i, /^salon/i, /^keller/i, /^empfang/i, /^studio/i, /^raum/i, /^room/i,
  /^bereich/i, /^area/i, /^zona/i, /^zone/i,
  /^innen/i, /^außen/i, /^interior/i, /^exterior/i, /^int/i, /^ext/i,
  /^(set|motiv|scene|szene)\s*\d*$/i, // Matches "Set", "Motiv 3", etc.
  /^\d+\.\s*(etage|floor|og)/i
];

/**
 * Hybrid validation: blocks obvious junk but is flexible with address formats.
 */
function isHybridValidLocation(location: string): boolean {
  if (!location || location.trim().length < 3) {
    return false;
  }

  const normalized = location.toLowerCase().trim();

  // 1. Filter out obvious logistics keywords
  for (const keyword of LOGISTICS_KEYWORDS) {
    if (normalized.includes(keyword)) {
      console.log(`[PostProcess] ❌ Filtered (logistics): "${location}"`);
      return false;
    }
  }

  // 2. Filter out invalid patterns like room names or "Set 3"
  for (const pattern of INVALID_PATTERNS) {
    if (pattern.test(location)) {
      console.log(`[PostProcess] ❌ Filtered (pattern): "${location}"`);
      return false;
    }
  }

  // ✅ Accept everything else - trusts AI but with a stronger safety net.
  console.log(`[PostProcess] ✅ Accepted: "${location}"`);
  return true;
}

// Post-process extracted data using the hybrid filter.
export function postProcessCrewFirstData(data: CallsheetExtraction): CallsheetExtraction {
  const date = (data.date || '').trim();
  const projectName = (data.projectName || '').trim();
  const seen = new Set<string>();
  
  const locations = (data.locations || [])
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .filter(isHybridValidLocation) // Using the new hybrid validation
    .filter((s) => {
      // Deduplicate
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  console.log(`[PostProcess] Final locations count: ${locations.length}`, locations);
  return { date, projectName, locations };
}



