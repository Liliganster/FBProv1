const STATIC_MAP_ENDPOINT = 'https://maps.googleapis.com/maps/api/staticmap';

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

type StaticMapOptions = {
  locations: string[];
  size?: string;
  mapType?: string;
  pathColor?: string;
  pathWeight?: number;
  scale?: number;
  markers?: Array<{ color?: string; label?: string; location: string }>;
  region?: string;
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
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    respondJson(res, 500, { error: 'Google Maps API key is not configured on the server' });
    return;
  }

  if (req.method !== 'POST') {
    respondJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  let payload: StaticMapOptions;
  try {
    payload = await readBody(req);
  } catch (error) {
    respondJson(res, 400, { error: 'Invalid JSON body', details: (error as Error).message });
    return;
  }

  const locations = Array.isArray(payload?.locations) ? payload.locations.filter(loc => typeof loc === 'string' && loc.trim().length > 0) : [];
  if (locations.length < 2) {
    respondJson(res, 400, { error: 'Provide at least two locations to build the route' });
    return;
  }
  const region = typeof payload?.region === 'string' && payload.region.trim() ? payload.region.trim() : undefined;

  const size = typeof payload.size === 'string' && payload.size.trim().length > 0 ? payload.size : '800x200';
  const mapType = typeof payload.mapType === 'string' && payload.mapType.trim().length > 0 ? payload.mapType : 'roadmap';
  const pathColor = typeof payload.pathColor === 'string' && payload.pathColor.trim().length > 0 ? payload.pathColor : '0x007aff';
  const pathWeight = typeof payload.pathWeight === 'number' && payload.pathWeight > 0 ? payload.pathWeight : 5;
  const scale = typeof payload.scale === 'number' && payload.scale >= 1 && payload.scale <= 4 ? payload.scale : 2;

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

  const enrichedLocations: string[] = [];

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
      if (!chosen) {
        const fallback = await geocode(loc);
        const fallbackResult = fallback?.results?.[0] || null;
        chosen = fallbackResult;
      } else {
        // Fetch fallback to compare countries if needed
        const fallback = await geocode(loc);
        const fallbackResult = fallback?.results?.[0] || null;
        const originalHint = countryHintFromString(loc);
        const primaryCode = primaryResult ? extractCountryCode(primaryResult) : undefined;
        const fallbackCode = fallbackResult ? extractCountryCode(fallbackResult) : undefined;
        if (primaryResult && fallbackResult && primaryCode && fallbackCode && primaryCode !== fallbackCode) {
          if (originalHint) {
            if (primaryCode === originalHint) chosen = primaryResult;
            else if (fallbackCode === originalHint) chosen = fallbackResult;
          } else if (region) {
            if (primaryCode === region.toUpperCase()) chosen = primaryResult;
            else if (fallbackCode === region.toUpperCase()) chosen = fallbackResult;
          }
        }
      }
      if (chosen?.formatted_address) {
        enrichedLocations.push(chosen.formatted_address);
        console.log(`[staticmap] Enriched "${loc}" -> "${chosen.formatted_address}"`);
      } else {
        enrichedLocations.push(loc);
        console.warn(`[staticmap] Geocoding failed for "${loc}" (status: ${primary?.status ?? 'unknown'}), using original`);
      }
    } catch (error) {
      enrichedLocations.push(loc);
      console.error(`[staticmap] Geocoding error for "${loc}":`, error);
    }
  }

  const params = new URLSearchParams({
    size,
    maptype: mapType,
    key: apiKey,
    scale: String(scale),
  });

  const origin = enrichedLocations[0];
  const destination = enrichedLocations[enrichedLocations.length - 1];
  params.append('markers', `color:0x007aff|label:A|${origin}`);
  params.append('markers', `color:0x34c759|label:B|${destination}`);

  (payload.markers || []).forEach(marker => {
    if (!marker?.location) return;
    const color = marker.color ? `color:${marker.color}|` : '';
    const label = marker.label ? `label:${marker.label}|` : '';
    params.append('markers', `${color}${label}${marker.location}`);
  });

  params.append('path', `color:${pathColor}|weight:${pathWeight}|${enrichedLocations.join('|')}`);

  try {
    const response = await fetch(`${STATIC_MAP_ENDPOINT}?${params.toString()}`);
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Google Static Map error ${response.status}: ${detail}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/png';
    const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
    respondJson(res, 200, { dataUrl, contentType });
  } catch (error) {
    console.error('[api/google/maps/staticmap] Error:', error);
    respondJson(res, 502, { error: 'Google Static Map request failed', details: (error as Error).message });
  }
}
