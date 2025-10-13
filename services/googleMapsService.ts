// FIX: Add global declaration for window.google to fix TypeScript errors when accessing the Google Maps API.
declare global {
  interface Window {
    google: any;
  }
}

const FALLBACK_STATIC_MAP = (seed: string) => `https://picsum.photos/seed/${encodeURIComponent(seed || 'trip')}/800/200`;

/**
 * Maps common country names to their two-letter ISO 3166-1 alpha-2 codes.
 * @param countryName - The full name of the country (case-insensitive).
 * @returns The two-letter country code, or undefined.
 */
export const getCountryCode = (countryName?: string): string | undefined => {
    if (!countryName) return undefined;
    const lowerCountry = countryName.toLowerCase().trim();
    const map: { [key: string]: string } = {
        'austria': 'AT',
        'osterreich': 'AT',
        'germany': 'DE',
        'deutschland': 'DE',
        'spain': 'ES',
        'espana': 'ES',
    };
    return map[lowerCountry];
};

type StaticMapOptions = {
  size?: string;
  mapType?: string;
  pathColor?: string;
  pathWeight?: number;
  scale?: number;
  markers?: Array<{ color?: string; label?: string; location: string }>;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    // Handle specific error types more gracefully
    if (response.status === 500) {
      throw new Error('Google Maps API not configured on server');
    }
    throw new Error(`Request failed (${response.status}): ${detail}`);
  }
  return (await response.json()) as T;
}

/**
 * Calculates driving distance using the backend proxy for the Google Directions API.
 * @param locations - Ordered list of addresses.
 * @param region - Optional region bias (ISO 3166-1 alpha-2).
 */
export async function calculateDistanceViaBackend(
  locations: string[],
  region?: string
): Promise<number | null> {
  if (!Array.isArray(locations) || locations.length < 2) return 0;
  try {
    const data = await postJson<{ distanceKm: number | null }>('/api/google/maps/directions', {
      locations,
      region,
    });
    return typeof data.distanceKm === 'number' ? data.distanceKm : null;
  } catch (error) {
    // Silently handle API not configured - only log detailed errors in dev mode
    if (import.meta.env.DEV) {
      console.warn('[GoogleMaps] Distance calculation failed - API not configured:', error);
    }
    return null;
  }
}

/**
 * Generates a data URL for a static map via the backend proxy.
 */
export async function getStaticMapUrlViaBackend(
  locations: string[],
  options?: StaticMapOptions
): Promise<string> {
  const validLocations = Array.isArray(locations) ? locations.filter(loc => loc.trim() !== '') : [];
  if (validLocations.length < 2) {
    return FALLBACK_STATIC_MAP(validLocations[0] || 'trip');
  }
  try {
    const data = await postJson<{ dataUrl?: string }>('/api/google/maps/staticmap', {
      locations: validLocations,
      ...options,
    });
    return typeof data.dataUrl === 'string' ? data.dataUrl : FALLBACK_STATIC_MAP(validLocations[0]);
  } catch (error) {
    // Silently handle API not configured - only log in dev mode
    if (import.meta.env.DEV) {
      console.warn('[GoogleMaps] Static map generation failed - API not configured:', error);
    }
    return FALLBACK_STATIC_MAP(validLocations[0]);
  }
}

/**
 * @deprecated Client-side calculation exposes the API key. Use calculateDistanceViaBackend instead.
 */
export function calculateDistance(
  locations: string[],
  _apiKey: string,
  region?: string
): Promise<number | null> {
  return calculateDistanceViaBackend(locations, region);
}

/**
 * @deprecated Client-side static map URLs expose the API key. Use getStaticMapUrlViaBackend instead.
 */
export function getStaticMapUrl(
  locations: string[],
  _apiKey: string
): string {
  return FALLBACK_STATIC_MAP(locations[0] || 'trip');
}
