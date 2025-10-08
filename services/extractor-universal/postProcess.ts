import type { CallsheetExtraction } from './config/schema';

// Minimal post-process consistent with the app needs
// - Trim strings
// - Drop empty locations
// - Deduplicate preserving order
// - Placeholder for future enrichment (routes, coords, confidence)

export function postProcessCrewFirstData(data: CallsheetExtraction): CallsheetExtraction {
  const date = (data.date || '').trim();
  const projectName = (data.projectName || '').trim();
  const seen = new Set<string>();
  const locations = (data.locations || [])
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .filter((s) => {
      if (seen.has(s.toLowerCase())) return false;
      seen.add(s.toLowerCase());
      return true;
    });

  return { date, projectName, locations };
}

