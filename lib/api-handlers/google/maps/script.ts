const MAPS_JS_ENDPOINT = 'https://maps.googleapis.com/maps/api/js';

function sendError(res: any, status: number, message: string) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify({ error: message }));
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    sendError(res, 405, 'Method Not Allowed');
    return;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    sendError(res, 500, 'Google Maps API key is not configured on the server');
    return;
  }

  const params = new URLSearchParams();
  params.set('key', apiKey);

  const libraries = req.query?.libraries;
  if (typeof libraries === 'string' && libraries.trim().length > 0) {
    params.set('libraries', libraries);
  }
  const language = typeof req.query?.language === 'string' ? req.query.language : undefined;
  if (language) params.set('language', language);

  const region = typeof req.query?.region === 'string' ? req.query.region : undefined;
  if (region) params.set('region', region);

  const version = typeof req.query?.v === 'string' ? req.query.v : undefined;
  if (version) params.set('v', version);

  try {
    const response = await fetch(`${MAPS_JS_ENDPOINT}?${params.toString()}`);
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Google Maps JS error ${response.status}: ${detail}`);
    }
    const script = await response.text();
    res
      .status(200)
      .setHeader('Content-Type', 'application/javascript')
      .setHeader('Cache-Control', 'public, max-age=3600')
      .send(script);
  } catch (error) {
    console.error('[api/google/maps/script] Error:', error);
    sendError(res, 502, (error as Error).message || 'Failed to load Google Maps script');
  }
}
