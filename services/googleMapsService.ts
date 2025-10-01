/**
 * In a real application, these API calls should be made from a backend server
 * to avoid exposing the API key. However, for client-side execution,
 * ensure your API key is restricted to your domain.
 */

// Add the Directions library to the script loader for this to work.
// e.g., https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=routes

// FIX: Add global declaration for window.google to fix TypeScript errors when accessing the Google Maps API.
declare global {
  interface Window {
    google: any;
  }
}

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
        'österreich': 'AT',
        'germany': 'DE',
        'deutschland': 'DE',
        'spain': 'ES',
        'españa': 'ES',
    };
    return map[lowerCountry];
};


/**
 * Calculates the driving distance for a multi-stop route using Google Maps Directions API.
 * @param locations - An array of location addresses.
 * @param apiKey - The Google Maps API key.
 * @param region - An optional two-letter country code (e.g., 'AT') to bias results.
 * @returns A promise that resolves to the distance in kilometers, or null if an error occurs.
 */
export function calculateDistance(
  locations: string[],
  apiKey: string,
  region?: string
): Promise<number | null> {
  if (!apiKey) {
    // API key missing - this should be handled by UI layer
    throw new Error("Google Maps API key is missing.");
  }

  if (locations.length < 2) {
    return Promise.resolve(0);
  }

  // Check if the Google Maps script and the required DirectionsService is loaded.
  if (!window.google || !window.google.maps || !window.google.maps.DirectionsService) {
    // Google Maps API not loaded - this should be handled by UI layer
    throw new Error("Google Maps JavaScript API is not loaded.");
  }
  
  const directionsService = new window.google.maps.DirectionsService();
  const origin = locations[0];
  const destination = locations[locations.length - 1];
  const waypoints = locations.slice(1, -1).map(location => ({
      location,
      stopover: true,
  }));
  
  // FIX: Explicitly type the request to avoid potential issues, even though it's any for now.
  const request: any = {
      origin,
      destination,
      waypoints,
      travelMode: window.google.maps.TravelMode.DRIVING,
      region: region || undefined,
  };
    
  return new Promise<number | null>((resolve, reject) => {
    directionsService.route(request, (response: any, status: any) => {
      if (status === 'OK' && response && response.routes && response.routes.length > 0) {
        const totalDistanceMeters = response.routes[0].legs.reduce((total: number, leg: any) => total + (leg.distance?.value || 0), 0);
        resolve(parseFloat((totalDistanceMeters / 1000).toFixed(1)));
      } else {
        console.error(`Directions API request failed with status: ${status}`);
        reject(new Error(`Could not calculate distance. Reason: ${status}`));
      }
    });
  });
}


/**
 * Generates a URL for a Google Static Map image showing a multi-stop route.
 * @param locations - An array of location addresses.
 * @param apiKey - The Google Maps API key.
 * @returns The URL for the static map image.
 */
export function getStaticMapUrl(
  locations: string[],
  apiKey: string
): string {
  const validLocations = locations.filter(loc => loc.trim() !== '');
  
  if (validLocations.length < 2 || !apiKey) {
    return `https://picsum.photos/seed/${encodeURIComponent(validLocations[0] || 'trip')}/800/200`;
  }

  const baseUrl = 'https://maps.googleapis.com/maps/api/staticmap';
  const params = new URLSearchParams({
    size: '800x200',
    maptype: 'roadmap',
    key: apiKey,
  });

  const origin = validLocations[0];
  const destination = validLocations[validLocations.length - 1];

  params.append('markers', `color:0x007aff|label:A|${origin}`);
  params.append('markers', `color:0x34c759|label:B|${destination}`);

  params.append('path', `color:0x007aff|weight:5|${validLocations.join('|')}`);
  
  return `${baseUrl}?${params.toString()}`;
}
