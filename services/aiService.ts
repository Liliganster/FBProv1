

import { SpecialOrigin, UserProfile, Trip, AiModelInfo, DocumentType } from '../types';
import { formatDateForStorage } from '../i18n/translations';
import { calculateDistanceViaBackend, getCountryCode } from './googleMapsService';
import { extractUniversalStructured, type ExtractMode } from './extractor-universal/index';
import { fetchWithRateLimit, withRateLimitHandling } from '../lib/rate-limit-client';




export interface ExtractedTripData {
  date: string;
  locations: string[];
  projectName: string;
  productionCompany: string;
  reason: string;
  specialOrigin: SpecialOrigin;
}

export interface AiModel {
  id: string;
  name: string;
}

async function cleanAndVerifyAddresses(locations: string[]): Promise<string[]> {
  if (locations.length === 0) {
    return locations;
  }
  if (!window.google || !window.google.maps || !window.google.maps.places) {
    console.warn("Google Maps Places library is not loaded. Returning original addresses.");
    return locations;
  }

  const placesService = new window.google.maps.places.PlacesService(document.createElement('div'));

  const cleanedLocationsPromises = locations.map((location) => {
    return new Promise<string | null>((resolve) => {
      if (!location || !location.trim()) {
        resolve(null);
        return;
      }
      placesService.findPlaceFromQuery({ query: location, fields: ['formatted_address', 'name'] }, (results: any, status: any) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0 && results[0].formatted_address) {
          resolve(results[0].formatted_address);
        } else {
          if (status !== window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            console.warn(`Could not verify address "${location}". Reason: ${status}`);
          }
          resolve(location);
        }
      });
    });
  });

  const resolvedLocations = await Promise.all(cleanedLocationsPromises);
  return resolvedLocations.filter((loc): loc is string => loc !== null);
}

const today = new Date();
const referenceDate = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });


export async function fetchOpenRouterModels(apiKey?: string | null): Promise<AiModelInfo[]> {
  return withRateLimitHandling(async () => {
    try {
      // Unified proxy route: use GET with optional apiKey
      const qs = apiKey ? `?apiKey=${encodeURIComponent(apiKey)}` : '';
      const res = await fetchWithRateLimit(`/api/ai/openrouter/models${qs}`, { method: 'GET' });

      if (!res.ok) {
        throw new Error(`Failed to fetch models: ${res.status} ${await res.text()}`);
      }

      const data = await res.json();
      const models = Array.isArray(data?.models)
        ? data.models
        : Array.isArray(data?.data)
          ? data.data
          : [];
      return models
        .map((m: any) => ({ id: m.id, name: m.name || m.id }))
        .sort((a: AiModelInfo, b: AiModelInfo) => (a.name || '').localeCompare(b.name || ''));
    } catch (e) {
      console.error("Error fetching OpenRouter models:", e);
      throw new Error("Failed to connect to OpenRouter. Please check your network connection and API key.");
    }
  }, 'fetchOpenRouterModels');
}



export async function processFileForTrip(file: File, userProfile: UserProfile, documentType: DocumentType): Promise<{ tripData: Omit<Trip, 'id' | 'projectId'>; projectName: string, productionCompany: string }> {
  // Use the new universal extraction system with auto provider selection
  return processFileForTripUniversal(
    { file },
    userProfile,
    documentType,
    'direct' // Use direct mode for file uploads from projects
  );
}

export async function processFileForTripUniversal(
  input: { file?: File; text?: string },
  userProfile: UserProfile,
  documentType: DocumentType,
  mode: ExtractMode
): Promise<{ tripData: Omit<Trip, 'id' | 'projectId'>; projectName: string, productionCompany: string }> {
  const userHomeAddress = (userProfile.address && userProfile.city && userProfile.country)
    ? `${userProfile.address}, ${userProfile.city}, ${userProfile.country}`
    : null;
  if (!userHomeAddress) throw new Error("Your home address is not set in your profile.");

  // Extract using the new universal pipeline (Gemini + optional OCR)
  const extraction = await extractUniversalStructured({
    mode,
    input: { file: input.file, text: input.text },
    provider: 'auto',
    credentials: {
      openRouterApiKey: userProfile.openRouterApiKey || null,
      openRouterModel: userProfile.openRouterModel || null,
    },
    geocodeBias: {
      city: userProfile.city,
      country: userProfile.country,
    },
  });
  const locations = [userHomeAddress, ...extraction.locations, userHomeAddress];

  let distance = 0;
  try {
    const regionCode = getCountryCode(userProfile?.country);
    const calculatedDist = await calculateDistanceViaBackend(locations, regionCode);
    distance = calculatedDist ?? 0;
  } catch (e) {
    console.warn(`Could not calculate distance for trip. Reason:`, e instanceof Error ? e.message : e);
  }

  const date = extraction.date || new Date().toISOString().split('T')[0];
  const reason = 'Trabajo';

  const tripData: Omit<Trip, 'id' | 'projectId'> = {
    date,
    locations: locations.length >= 2 ? locations : [userHomeAddress, userHomeAddress],
    distance,
    reason,
    specialOrigin: SpecialOrigin.HOME,
  };

  // Join multiple production companies with comma separator
  // Examples: "Netflix" or "Netflix, Studio Babelsberg, ARD Degeto"
  const productionCompany = Array.isArray(extraction.productionCompanies)
    ? extraction.productionCompanies.filter(Boolean).join(', ')
    : 'Unknown';

  // Derive a project name without using a generic "Untitled" fallback.
  const cleanGenericTokens = (s: string) => s
    .replace(/[_-]+/g, ' ')
    .replace(/\b(call\s*sheet|callsheet|tagesdisposition|disposici[oó]n\s*diaria|drehtag|shooting\s*day|version|versi[oó]n|final|rev(ision)?|v\d+)\b/gi, ' ')
    .replace(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const looksLikeCompany = (s: string) => /\b(gmbh|llc|ltd\.?|inc\.?|kg|og|s\.l\.|s\.a\.|film(produktion)?|pictures|entertainment|studios?)\b/i.test(s);

  const getNameFromFile = (file?: File): string => {
    if (!file?.name) return '';
    const base = file.name.replace(/\.[^.]+$/, '');
    const cleaned = cleanGenericTokens(base);
    // Prefer the first tokenized chunk that doesn't look like a company name
    const candidates = cleaned.split(/\s{2,}|\s-\s|\s\|\s|\s{1}/).filter(Boolean);
    const picked = candidates.find(c => !looksLikeCompany(c) && /[A-Za-zÁÉÍÓÚÜÑäöüÄÖÜß]/.test(c)) || cleaned;
    return picked.trim();
  };

  const getNameFromText = (text?: string): string => {
    if (!text) return '';
    const head = text.split(/\r?\n/).slice(0, 40);
    const blacklist = /(call\s*sheet|callsheet|tagesdisposition|disposici[oó]n\s*diaria|drehtag|shooting\s*day|production\s*company|produktion|productora|producci[oó]n)/i;
    let best = '';
    for (const line of head) {
      const cleaned = cleanGenericTokens(line);
      if (!cleaned) continue;
      if (blacklist.test(cleaned)) continue;
      if (looksLikeCompany(cleaned)) continue;
      if (cleaned.length >= 2 && cleaned.length <= 60) {
        // Prefer lines with multiple words or Title/ALLCAPS patterns
        const score = (cleaned.split(/\s+/).length >= 2 ? 2 : 1) + (/[A-Z]{3,}/.test(cleaned) ? 1 : 0);
        if (score >= 2) {
          best = cleaned;
          break;
        }
        if (!best) best = cleaned;
      }
    }
    return best;
  };

  let projectName = (extraction.projectName || '').trim();
  const containsProducerKeyword = /\b(produktion|production|productora|producer|producers)\b/i.test(projectName);
  if (!projectName || looksLikeCompany(projectName) || containsProducerKeyword) {
    // Try stronger derivations, especially for OCR/agent mode
    const derived = getNameFromFile(input.file) || getNameFromText(input.text) || '';
    if (derived && !looksLikeCompany(derived)) {
      projectName = derived;
    }
  }
  // Final guard: if still empty, keep it empty; UI will handle fallback, but we never use "Untitled" here.

  console.log('DEBUG: processFileForTripUniversal result:', { tripData, projectName, productionCompany });
  return { tripData, projectName, productionCompany };
}
