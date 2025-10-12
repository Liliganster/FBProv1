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
};

export default async function handler(req: any, res: any) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
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

  const size = typeof payload.size === 'string' && payload.size.trim().length > 0 ? payload.size : '800x200';
  const mapType = typeof payload.mapType === 'string' && payload.mapType.trim().length > 0 ? payload.mapType : 'roadmap';
  const pathColor = typeof payload.pathColor === 'string' && payload.pathColor.trim().length > 0 ? payload.pathColor : '0x007aff';
  const pathWeight = typeof payload.pathWeight === 'number' && payload.pathWeight > 0 ? payload.pathWeight : 5;
  const scale = typeof payload.scale === 'number' && payload.scale >= 1 && payload.scale <= 4 ? payload.scale : 2;

  const params = new URLSearchParams({
    size,
    maptype: mapType,
    key: apiKey,
    scale: String(scale),
  });

  const origin = locations[0];
  const destination = locations[locations.length - 1];
  params.append('markers', `color:0x007aff|label:A|${origin}`);
  params.append('markers', `color:0x34c759|label:B|${destination}`);

  (payload.markers || []).forEach(marker => {
    if (!marker?.location) return;
    const color = marker.color ? `color:${marker.color}|` : '';
    const label = marker.label ? `label:${marker.label}|` : '';
    params.append('markers', `${color}${label}${marker.location}`);
  });

  params.append('path', `color:${pathColor}|weight:${pathWeight}|${locations.join('|')}`);

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
