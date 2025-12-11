const GEOCODE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

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

function respondJson(res: any, status: number, payload: unknown) {
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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    respondJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    respondJson(res, 500, { error: 'Google Maps API key is not configured on the server' });
    return;
  }

  let body: any;
  try {
    body = await readBody(req);
  } catch (error) {
    respondJson(res, 400, { error: 'Invalid JSON body', details: (error as Error).message });
    return;
  }

  const locations: unknown = body?.locations;
  const region = typeof body?.region === 'string' && body.region.trim() ? body.region.trim() : undefined;

  if (!Array.isArray(locations) || locations.length === 0 || !locations.every(loc => typeof loc === 'string' && loc.trim().length > 0)) {
    respondJson(res, 400, { error: 'locations must be a non-empty array of strings' });
    return;
  }

  const geocode = async (query: string, regionBias?: string) => {
    const params = new URLSearchParams();
    params.set('address', query);
    params.set('key', apiKey);
    if (regionBias) {
      params.set('region', regionBias);
      params.set('components', `country:${regionBias}`);
    }
    const url = `${GEOCODE_ENDPOINT}?${params.toString()}`;
    const response = await fetch(url);
    return response.json();
  };

  const results: Array<{ input: string; formatted_address: string; latitude: number; longitude: number }> = [];

  for (const loc of locations) {
    try {
      const primary = await geocode(loc, region);
      const primaryResult = primary?.results?.[0] || null;
      const fallback = await geocode(loc);
      const fallbackResult = fallback?.results?.[0] || null;

      const matchesRegion = (result: any) => {
        if (!region) return true;
        const countryComponent = result?.address_components?.find((c: any) => c.types?.includes('country'));
        return !countryComponent || countryComponent.short_name === region.toUpperCase();
      };

      let chosen = primaryResult && matchesRegion(primaryResult) ? primaryResult : null;
      if (!chosen) {
        chosen = fallbackResult;
      } else if (fallbackResult) {
        const originalHint = countryHintFromString(loc);
        const primaryCode = extractCountryCode(primaryResult);
        const fallbackCode = extractCountryCode(fallbackResult);
        if (primaryCode && fallbackCode && primaryCode !== fallbackCode) {
          if (originalHint) {
            if (primaryCode === originalHint) chosen = primaryResult;
            else if (fallbackCode === originalHint) chosen = fallbackResult;
          } else if (region) {
            if (primaryCode === region.toUpperCase()) chosen = primaryResult;
            else if (fallbackCode === region.toUpperCase()) chosen = fallbackResult;
          }
        }
      }

      if (chosen?.formatted_address && chosen?.geometry?.location) {
        results.push({
          input: loc,
          formatted_address: chosen.formatted_address,
          latitude: chosen.geometry.location.lat,
          longitude: chosen.geometry.location.lng,
        });
      } else {
        results.push({
          input: loc,
          formatted_address: loc,
          latitude: NaN,
          longitude: NaN,
        });
        console.warn(`[geocode] Geocoding failed for "${loc}" (status: ${primary?.status ?? 'unknown'}), returning original`);
      }
    } catch (error) {
      results.push({
        input: loc,
        formatted_address: loc,
        latitude: NaN,
        longitude: NaN,
      });
      console.error(`[geocode] Geocoding error for "${loc}":`, error);
    }
  }

  respondJson(res, 200, { results });
}
