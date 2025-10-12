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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
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

  const [origin, ...rest] = locations;
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
