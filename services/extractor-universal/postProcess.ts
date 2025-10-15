import type { CallsheetExtraction } from './config/schema';

// Keywords that indicate logistical (non-filming) locations to filter out
const LOGISTICS_KEYWORDS = [
  'basis', 'base', 'parken', 'parking', 'aufenthalt', 'kostüm', 'costume',
  'maske', 'makeup', 'hair', 'lunch', 'catering', 'team', 'technik',
  'office', 'meeting', 'transport', 'pick up', 'pickup', 'driver', 'car',
  'wardrobe', 'load', 'unload', 'crew parking', 'unit base', 'crew base',
  'holding', 'green room', 'production office', 'prod office',
  'mobile', 'trailer', 'wohnwagen', 'anhänger', 'kombi',
  'treffpunkt', 'meeting point', 'sammelplatz', 'sammelpunkt',
  'hospital', 'krankenhaus', 'arzt', 'doctor', 'medic',
  'toiletten', 'toilets', 'wc', 'restroom', 'sanitär'
];

// Patterns that indicate incomplete/invalid locations (room names, etc.)
const INVALID_LOCATION_PATTERNS = [
  /^(suite|salon|keller|empfang|studio|villa|raum|room|floor|etage|stock)\s/i,
  /^(bereich|area|zona|zone)\s/i,
  /^\d+\.\s*(etage|floor|stock|og|ug)/i, // Floor numbers without addresses
  /^(innen|außen|interior|exterior|int|ext|aussen)[\s\.]/i, // Interior/Exterior markers
  /^(set|motiv|scene|szene)\s*\d*\s*$/i, // Just "Set 1", "Motiv 2", etc. without address
];

// Check if a location string is a complete physical address
function isCompleteAddress(location: string): boolean {
  const lower = location.toLowerCase();
  const trimmed = location.trim();
  
  // Must have some length
  if (trimmed.length < 8) {
    console.log(`[PostProcess] ❌ Too short: "${location}"`);
    return false;
  }
  
  // Check for invalid patterns (room names, etc.)
  for (const pattern of INVALID_LOCATION_PATTERNS) {
    if (pattern.test(location)) {
      console.log(`[PostProcess] ❌ Invalid pattern: "${location}"`);
      return false;
    }
  }
  
  // Check for logistics keywords - be more aggressive
  for (const keyword of LOGISTICS_KEYWORDS) {
    if (lower.includes(keyword)) {
      console.log(`[PostProcess] ❌ Logistics keyword "${keyword}": "${location}"`);
      return false;
    }
  }
  
  // Must contain at least one number (street number or postal code)
  if (!/\d/.test(location)) {
    console.log(`[PostProcess] ❌ No numbers: "${location}"`);
    return false;
  }
  
  // Count words - must have at least 3 words for a complete address
  // Exception: if it has a comma, 2 words might be OK
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 2) {
    console.log(`[PostProcess] ❌ Too few words (${words.length}): "${location}"`);
    return false;
  }
  
  // STRICT CHECK: Must have comma OR postal code OR known city
  const hasComma = location.includes(',');
  const hasPostalCode = /\b\d{4,5}\b/.test(location); // 4-5 digit postal codes
  const hasCityName = /\b(wien|vienna|berlin|münchen|munich|hamburg|köln|madrid|barcelona|paris|london)\b/i.test(location);
  
  if (!hasComma && !hasPostalCode && !hasCityName) {
    console.log(`[PostProcess] ❌ No comma, postal code, or city: "${location}"`);
    return false;
  }
  
  // CRITICAL: Must contain street-like words
  // A valid address should have "straße", "gasse", "weg", "platz", "allee", "str.", "avenue", "road", etc.
  const hasStreetWord = /\b(straße|strasse|str\.|gasse|weg|platz|allee|avenue|ave|road|rd|street|st\.|boulevard|blvd|calle|carrer)\b/i.test(location);
  
  if (!hasStreetWord && !hasComma) {
    // If no street word and no comma, it's likely not a complete address
    console.log(`[PostProcess] ❌ No street word or comma: "${location}"`);
    return false;
  }
  
  console.log(`[PostProcess] ✅ Valid address: "${location}"`);
  return true;
}

// Post-process extracted data:
// - Trim strings
// - Filter out logistical locations
// - Filter out incomplete addresses (room names, etc.)
// - Deduplicate preserving order
export function postProcessCrewFirstData(data: CallsheetExtraction): CallsheetExtraction {
  const date = (data.date || '').trim();
  const projectName = (data.projectName || '').trim();
  const seen = new Set<string>();
  
  const locations = (data.locations || [])
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .filter((loc) => {
      // Filter out incomplete/invalid addresses
      if (!isCompleteAddress(loc)) {
        console.log(`[PostProcess] Filtered out invalid location: "${loc}"`);
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


