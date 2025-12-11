const DIRECTIONS_ENDPOINT = 'https://maps.googleapis.com/maps/api/directions/json';

function json(res: any, status: number, payload: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));
}

async function readBody(req: any): Promise<any> {
  if (req.body) return req.body;
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString('utf8');
    });
    req.on('end', () => {
      if (!data.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

type DirectionsResponse = {
  routes?: Array<{
    legs?: Array<{
      distance?: { value?: number };
    }>;
  }>;
  status?: string;
  error_message?: string;
};

function extractCountryCode(result: any): string | undefined {
  const countryComponent = result?.address_components?.find((c: any) => Array.isArray(c.types) && c.types.includes('country'));
  return countryComponent?.short_name ? String(countryComponent.short_name).toUpperCase() : undefined;
}

function countryHintFromString(raw: string): string | undefined {
  const map: Record<string, string> = {
    austria: 'AT',
    österreich: 'AT',
    oesterreich: 'AT',
    germany: 'DE',
    deutschland: 'DE',
    spain: 'ES',
    españa: 'ES',
    espana: 'ES',
    france: 'FR',
    italy: 'IT',
    italia: 'IT',
    switzerland: 'CH',
    schweiz: 'CH',
    suisse: 'CH',
    usa: 'US',
    'united states': 'US',
    uk: 'GB',
    'united kingdom': 'GB',
    portugal: 'PT',
    netherlands: 'NL',
    holland: 'NL',
  };
  const lower = raw.toLowerCase();
  for (const [name, code] of Object.entries(map)) {
    if (lower.includes(name)) return code;
  }
  const codeMatch = raw.match(/\b([A-Z]{2})\b/);
  if (codeMatch) return codeMatch[1];
  return undefined;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    json(res, 500, { error: 'Google Maps API key is not configured on the server' });
    return;
  }

  let body: any;
  try {
    body = await readBody(req);
  } catch (error) {
    json(res, 400, { error: 'Invalid JSON body', details: (error as Error).message });
    return;
  }

  const locations: unknown = body?.locations;
  const region = typeof body?.region === 'string' && body.region.trim() ? body.region.trim() : undefined;
  const travelMode = typeof body?.travelMode === 'string' ? body.travelMode : 'DRIVING';

  if (!Array.isArray(locations) || locations.length < 2 || !locations.every(loc => typeof loc === 'string' && loc.trim().length > 0)) {
    json(res, 400, { error: 'locations must be an array of at least two non-empty strings' });
    return;
  }

  // Geocode each address to get complete, normalized version (retry without region bias if needed)
  const enrichedLocations: string[] = [];

  const geocode = async (query: string, regionBias?: string) => {
    const params = new URLSearchParams();
    params.set('address', query);
    params.set('key', apiKey);
    if (regionBias) {
      params.set('region', regionBias);
      params.set('components', `country:${regionBias}`);
    }
    const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;
    const res = await fetch(url);
    return res.json();
  };

  for (const loc of locations) {
    try {
      const primary = await geocode(loc, region);
      const primaryResult = primary?.results?.[0] || null;

      const matchesRegion = (result: any) => {
        if (!region) return true;
        const countryComponent = result?.address_components?.find((c: any) => c.types?.includes('country'));
        return !countryComponent || countryComponent.short_name === region.toUpperCase();
      };

      let chosen = primaryResult && matchesRegion(primaryResult) ? primaryResult : null;
      let fallbackResult: any = null;

      if (!chosen) {
        const fallback = await geocode(loc);
        fallbackResult = fallback?.results?.[0] || null;
        chosen = fallbackResult;
      } else {
        // Still fetch fallback to compare if countries differ
        const fallback = await geocode(loc);
        fallbackResult = fallback?.results?.[0] || null;
      }

      const originalCountryHint = countryHintFromString(loc);
      const primaryCode = primaryResult ? extractCountryCode(primaryResult) : undefined;
      const fallbackCode = fallbackResult ? extractCountryCode(fallbackResult) : undefined;

      if (primaryResult && fallbackResult && primaryCode && fallbackCode && primaryCode !== fallbackCode) {
        if (originalCountryHint) {
          if (primaryCode === originalCountryHint) chosen = primaryResult;
          else if (fallbackCode === originalCountryHint) chosen = fallbackResult;
        } else if (region) {
          if (primaryCode === region.toUpperCase()) chosen = primaryResult;
          else if (fallbackCode === region.toUpperCase()) chosen = fallbackResult;
        }
      }

      if (chosen?.formatted_address) {
        enrichedLocations.push(chosen.formatted_address);
        console.log(`[directions] Enriched "${loc}" -> "${chosen.formatted_address}"`);
      } else {
        enrichedLocations.push(loc);
        console.warn(`[directions] Geocoding failed for "${loc}" (status: ${primary?.status ?? 'unknown'}), using original`);
      }
    } catch (error) {
      enrichedLocations.push(loc);
      console.error(`[directions] Geocoding error for "${loc}":`, error);
    }
  }


  console.log(`[directions] Original: ${locations.join(' → ')}`);
  console.log(`[directions] Enriched: ${enrichedLocations.join(' → ')}`);

  const [origin, ...rest] = enrichedLocations;
  const destination = rest.pop() as string;
  const waypoints = rest;

  const params = new URLSearchParams();
  params.set('origin', origin);
  params.set('destination', destination);
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.join('|'));
  }
  if (region) {
    params.set('region', region);
  }
  params.set('mode', travelMode);
  params.set('units', 'metric');
  params.set('language', 'es');
  params.set('key', apiKey);

  try {
    const response = await fetch(`${DIRECTIONS_ENDPOINT}?${params.toString()}`);
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Google Directions error ${response.status}: ${detail}`);
    }
    const payload = (await response.json()) as DirectionsResponse;
    if (payload.status !== 'OK') {
      throw new Error(payload.error_message || `Google Directions returned status ${payload.status}`);
    }

    const routes = payload.routes ?? [];
    const primaryRoute = routes[0];
    const legs = primaryRoute?.legs ?? [];
    const totalMeters = legs.reduce((total, leg) => total + (leg.distance?.value ?? 0), 0);
    const distanceKm = Number.isFinite(totalMeters) ? parseFloat((totalMeters / 1000).toFixed(1)) : null;

    json(res, 200, {
      distanceKm,
      distanceMeters: totalMeters,
      routeLegs: legs.length,
    });
  } catch (error) {
    console.error('[api/google/maps/directions] Error:', error);
    json(res, 502, { error: 'Google Directions request failed', details: (error as Error).message });
  }
}
