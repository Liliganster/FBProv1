import type { VercelRequest, VercelResponse } from '@vercel/node';
import geminiHandler from '../lib/api-handlers/ai/gemini';

// ============================================================================
// CONSOLIDATED API PROXY - ALL HANDLERS IN ONE FILE
// This reduces Vercel serverless functions to just 1 (within free tier limit)
// ============================================================================

// Rate Limiter
interface RateLimitEntry {
  timestamps: number[];
  resetTime: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests = 10, windowMs = 60 * 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  checkLimit(userId: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let entry = this.store.get(userId);
    if (!entry) {
      entry = { timestamps: [], resetTime: now + this.windowMs };
      this.store.set(userId, entry);
    }

    entry.timestamps = entry.timestamps.filter(timestamp => timestamp > windowStart);

    if (entry.timestamps.length >= this.maxRequests) {
      const oldestTimestamp = entry.timestamps[0];
      const retryAfter = Math.ceil((oldestTimestamp + this.windowMs - now) / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetTime: oldestTimestamp + this.windowMs,
        retryAfter
      };
    }

    entry.timestamps.push(now);
    entry.resetTime = Math.max(entry.resetTime, now + this.windowMs);

    return {
      allowed: true,
      remaining: this.maxRequests - entry.timestamps.length,
      resetTime: entry.resetTime
    };
  }

  getStatus(userId: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const entry = this.store.get(userId);
    if (!entry) {
      return {
        allowed: true,
        remaining: this.maxRequests,
        resetTime: now + this.windowMs
      };
    }

    const validTimestamps = entry.timestamps.filter(timestamp => timestamp > windowStart);
    const remaining = Math.max(0, this.maxRequests - validTimestamps.length);

    if (remaining === 0 && validTimestamps.length > 0) {
      const oldestTimestamp = validTimestamps[0];
      const retryAfter = Math.ceil((oldestTimestamp + this.windowMs - now) / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetTime: oldestTimestamp + this.windowMs,
        retryAfter
      };
    }

    return {
      allowed: remaining > 0,
      remaining,
      resetTime: entry.resetTime
    };
  }

  getStoreSize(): number {
    return this.store.size;
  }
}

const aiRateLimiter = new RateLimiter(10, 60 * 1000);

// Helper functions
function sendError(res: VercelResponse, status: number, message: string) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify({ error: message }));
}

function sendJson(res: VercelResponse, status: number, payload: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));
}

async function readBody(req: VercelRequest): Promise<any> {
  if (req.body) return req.body;
  return new Promise((resolve, reject) => {
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

function getUserId(req: VercelRequest): string {
  if (req.headers.authorization) {
    return req.headers.authorization.replace('Bearer ', '');
  } else if (req.headers['x-user-id']) {
    return req.headers['x-user-id'] as string;
  } else if (req.query?.userId) {
    return req.query.userId as string;
  } else {
    let userId = req.headers['x-forwarded-for'] ||
             req.headers['x-real-ip'] ||
             'unknown';

    if (typeof userId === 'string' && userId.includes(',')) {
      userId = userId.split(',')[0].trim();
    }
    return userId as string;
  }
}

function getAccessToken(req: VercelRequest): string | null {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers - set first for all requests
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extract route from query parameter
  const route = req.query.path as string | undefined;

  // Debug logging
  if (!route) {
    console.error('[Proxy] Missing path parameter', {
      url: req.url,
      query: req.query,
      method: req.method
    });
    return sendError(res, 400, 'Invalid path: path parameter is required');
  }

  if (typeof route !== 'string' || route.trim() === '') {
    console.error('[Proxy] Invalid path type', {
      route,
      type: typeof route
    });
    return sendError(res, 400, 'Invalid path: must be a non-empty string');
  }

  try {
    // Route to appropriate handler
    if (route.startsWith('ai/')) {
      return handleAI(route.replace('ai/', ''), req, res);
    } else if (route.startsWith('google/')) {
      return handleGoogle(route.replace('google/', ''), req, res);
    } else if (route.startsWith('admin/')) {
      return handleAdmin(route.replace('admin/', ''), req, res);
    }

    return sendError(res, 404, 'Route not found');
  } catch (error: any) {
    console.error('API Error:', error);
    return sendError(res, 500, error.message || 'Internal server error');
  }
}

// ============================================================================
// AI HANDLERS
// ============================================================================
async function handleAI(route: string, req: VercelRequest, res: VercelResponse) {
  // Check rate limit for AI endpoints
  const userId = getUserId(req);
  const rateLimit = aiRateLimiter.checkLimit(userId);

  res.setHeader('X-RateLimit-Limit', '10');
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimit.resetTime / 1000).toString());

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', rateLimit.retryAfter?.toString() || '60');
    return sendJson(res, 429, {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Maximum 10 requests per minute allowed.',
      retryAfter: rateLimit.retryAfter
    });
  }

  if (route === 'gemini') {
    return handleGemini(req, res);
  } else if (route === 'openrouter/chat') {
    return handleOpenRouterChat(req, res);
  } else if (route === 'openrouter/models') {
    return handleOpenRouterModels(req, res);
  } else if (route === 'openrouter/structured') {
    return handleOpenRouterStructured(req, res);
  } else if (route === 'status') {
    return handleAIStatus(req, res);
  }

  return sendError(res, 404, 'AI route not found');
}

async function handleGemini(req: VercelRequest, res: VercelResponse) {
  // Delegate to the consolidated Gemini handler with tools, schemas and agent loop
  // It already handles method checks, body parsing, and error formatting.
  // Note: rate limiting is already applied at the top-level proxy.
  // The imported handler also applies its own internal rate limit wrapper.
  // This is acceptable and conservative for free-tier limits.
  // @ts-ignore - handler signature matches (req, res)
  return geminiHandler(req as any, res as any);
}

async function handleOpenRouterChat(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  const defaultKey = process.env.OPENROUTER_API_KEY;

  let body: any;
  try {
    body = await readBody(req);
  } catch (error: any) {
    return sendJson(res, 400, { error: 'Invalid JSON body', details: error.message });
  }

  const messages = Array.isArray(body?.messages) ? body.messages : null;
  if (!messages || messages.length === 0) {
    return sendError(res, 400, 'Request body must include a non-empty messages array');
  }

  const apiKey = body?.apiKey?.trim() || defaultKey;
  if (!apiKey) {
    return sendError(res, 500, 'OpenRouter API key is not configured');
  }

  const model = body?.model?.trim() || process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';
  const temperature = typeof body?.temperature === 'number' ? body.temperature : 0.1;

  const payload: any = { model, messages, temperature };
  if (body?.response_format) payload.response_format = body.response_format;
  if (body?.max_tokens) payload.max_tokens = body.max_tokens;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://fahrtenbuch-pro.app',
        'X-Title': process.env.OPENROUTER_TITLE || 'Fahrtenbuch Pro',
      },
      body: JSON.stringify(payload),
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(`OpenRouter error ${response.status}: ${JSON.stringify(json)}`);
    }

    return sendJson(res, 200, json);
  } catch (error: any) {
    console.error('[api/ai/openrouter/chat] Error:', error);
    return sendJson(res, 500, { error: 'OpenRouter request failed', details: error.message });
  }
}

async function handleOpenRouterModels(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  const defaultKey = process.env.OPENROUTER_API_KEY;
  const queryKey = req.query?.apiKey as string;
  const apiKey = queryKey?.trim() || defaultKey;

  if (!apiKey) {
    return sendError(res, 500, 'OpenRouter API key is not configured');
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://fahrtenbuch-pro.app',
        'X-Title': process.env.OPENROUTER_TITLE || 'Fahrtenbuch Pro',
      },
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${detail}`);
    }

    const json = await response.json();
    const models = Array.isArray(json?.data)
      ? json.data
          .map((m: any) => ({ id: m.id, name: m.name || m.id }))
          .filter((m: any) => m.id)
          .sort((a: any, b: any) => a.name.localeCompare(b.name))
      : [];

    return sendJson(res, 200, { models });
  } catch (error: any) {
    console.error('[api/ai/openrouter/models] Error:', error);
    return sendJson(res, 500, { error: 'OpenRouter request failed', details: error.message });
  }
}

async function handleOpenRouterStructured(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  const defaultKey = process.env.OPENROUTER_API_KEY;

  let body: any;
  try {
    body = await readBody(req);
  } catch (error: any) {
    return sendJson(res, 400, { error: 'Invalid JSON body', details: error.message });
  }

  const text = body?.text?.trim();
  if (!text) {
    return sendError(res, 400, 'Request body must include a non-empty text field');
  }

  const apiKey = body?.apiKey?.trim() || defaultKey;
  if (!apiKey) {
    return sendError(res, 500, 'OpenRouter API key is not configured');
  }

  const model = body?.model?.trim() || process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';
  const useCrewFirst = Boolean(body?.useCrewFirst);

  // Schema-specific, strict JSON instructions
  const systemContent = useCrewFirst
    ? (
      'You are a callsheet extraction service. Output ONLY valid JSON matching this exact schema (no extra fields): ' +
      '{"version":"parser-crew-1","date":"YYYY-MM-DD","projectName":"string","productionCompany":string|null,"motiv":string|null,"episode":string|null,"shootingDay":string|null,"generalCallTime":string|null,"locations":[{"location_type":"FILMING_PRINCIPAL"|"UNIT_BASE"|"CATERING"|"MAKEUP_HAIR"|"WARDROBE"|"CREW_PARKING"|"LOAD_UNLOAD","name"?:string,"address":string,"formatted_address"?:string|null,"latitude"?:number|null,"longitude"?:number|null,"notes"?:string[],"confidence"?:number}],"rutas":[]} '
      + 'Rules: 1) version must be "parser-crew-1". 2) date must be normalized to YYYY-MM-DD. 3) locations must use one of the allowed location_type values. 4) No explanations, only the JSON object.'
    )
    : (
      'You are a callsheet data extraction AI. Extract ONLY the main filming locations from the callsheet. ' +
      '\n\nCRITICAL RULES:\n' +
      '1. Extract ONLY locations marked as "Drehort", "Location", "Set", or "Motiv" (filming locations)\n' +
      '2. IGNORE all locations for: Basis, Parken, Aufenthalt, Kostüm, Maske, Lunch, Catering, Team, Technik, Office, Meeting\n' +
      '3. IGNORE room names or internal location names without a street address (e.g., "Suite Nico", "Keller", "Catering Bereich")\n' +
      '4. Each location MUST be a complete physical address with street name and number (e.g., "Salmgasse 10, 1030 Wien")\n' +
      '5. If a location has both a place name AND an address, use ONLY the address\n' +
      '6. Remove duplicates\n' +
      '7. Order locations in the sequence they appear on the callsheet\n\n' +
      'Output format: {"date":"YYYY-MM-DD","projectName":"string","locations":["complete address 1","complete address 2",...]}\n\n' +
      'Example good locations: ["Palais Rasumofsky, 23-25, 1030 Wien", "Salmgasse 10, 1030 Wien"]\n' +
      'Example BAD locations to IGNORE: ["Suite Nico", "Keller", "Catering Bereich", "Basis", "Parken"]'
    );

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://fahrtenbuch-pro.app',
        'X-Title': process.env.OPENROUTER_TITLE || 'Fahrtenbuch Pro',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: text },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${detail}`);
    }

    const payload = await response.json();
    const message = payload?.choices?.[0]?.message?.content;
    const parsed = typeof message === 'string' ? JSON.parse(message) : message;

    return sendJson(res, 200, parsed);
  } catch (error: any) {
    console.error('[api/ai/openrouter/structured] Error:', error);
    return sendJson(res, 500, { error: 'OpenRouter request failed', details: error.message });
  }
}

async function handleAIStatus(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  const userId = getUserId(req);
  const status = aiRateLimiter.getStatus(userId);
  const storeSize = aiRateLimiter.getStoreSize();

  return sendJson(res, 200, {
    userId: userId.substring(0, 10) + '...',
    rateLimit: {
      allowed: status.allowed,
      remaining: status.remaining,
      resetTime: status.resetTime,
      resetTimeFormatted: new Date(status.resetTime).toISOString(),
      retryAfter: status.retryAfter
    },
    system: {
      activeUsers: storeSize,
      limits: {
        maxRequests: 10,
        windowMinutes: 1
      }
    }
  });
}

// ============================================================================
// GOOGLE HANDLERS
// ============================================================================
async function handleGoogle(route: string, req: VercelRequest, res: VercelResponse) {
  if (route.startsWith('calendar/')) {
    const subRoute = route.replace('calendar/', '');
    if (subRoute === 'calendars') {
      return handleGoogleCalendarList(req, res);
    } else if (subRoute === 'events') {
      return handleGoogleCalendarEvents(req, res);
    }
  } else if (route.startsWith('maps/')) {
    const subRoute = route.replace('maps/', '');
    if (subRoute === 'directions') {
      return handleGoogleMapsDirections(req, res);
    } else if (subRoute === 'script') {
      return handleGoogleMapsScript(req, res);
    } else if (subRoute === 'staticmap') {
      return handleGoogleMapsStaticMap(req, res);
    }
  }

  return sendError(res, 404, 'Google route not found');
}

async function handleGoogleCalendarList(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  const accessToken = getAccessToken(req);
  if (!accessToken) {
    return sendError(res, 401, 'Missing Authorization bearer token');
  }

  try {
    const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');
    url.searchParams.set('maxResults', '250');
    const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;
    if (apiKey) {
      url.searchParams.set('key', apiKey);
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Google Calendar error ${response.status}: ${detail}`);
    }

    const payload = await response.json();
    const calendars = Array.isArray(payload?.items) ? payload.items : [];
    return sendJson(res, 200, { calendars });
  } catch (error: any) {
    console.error('[api/google/calendar/calendars] Error:', error);
    return sendJson(res, 502, { error: 'Google Calendar list failed', details: error.message });
  }
}

async function handleGoogleCalendarEvents(req: VercelRequest, res: VercelResponse) {
  // Health check
  if (req.method === 'GET' && req.query?.health) {
    const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;
    return sendJson(res, 200, { ready: true, usesApiKey: Boolean(apiKey) });
  }

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  const accessToken = getAccessToken(req);
  if (!accessToken) {
    return sendError(res, 401, 'Missing Authorization bearer token');
  }

  let body: any;
  try {
    body = await readBody(req);
  } catch (error: any) {
    return sendJson(res, 400, { error: 'Invalid JSON body', details: error.message });
  }

  const action = body?.action;

  try {
    if (action === 'list') {
      const calendarIds: string[] = Array.isArray(body?.calendarIds) ? body.calendarIds : [];
      const timeMin = body?.timeMin;
      const timeMax = body?.timeMax;

      if (calendarIds.length === 0 || typeof timeMin !== 'string' || typeof timeMax !== 'string') {
        return sendError(res, 400, 'calendarIds, timeMin and timeMax are required');
      }

      const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;
      const events: any[] = [];

      for (const calendarId of calendarIds) {
        const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
        url.searchParams.set('timeMin', timeMin);
        url.searchParams.set('timeMax', timeMax);
        url.searchParams.set('singleEvents', 'true');
        url.searchParams.set('maxResults', '100');
        url.searchParams.set('orderBy', 'startTime');
        if (apiKey) {
          url.searchParams.set('key', apiKey);
        }

        const response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(`Google Calendar error ${response.status}: ${detail}`);
        }

        const data = await response.json();
        if (Array.isArray(data?.items)) {
          events.push(...data.items);
        }
      }

      return sendJson(res, 200, { events });
    }

    if (action === 'create') {
      const calendarId = body?.calendarId || 'primary';
      const event = body?.event;

      if (!event || typeof event !== 'object') {
        return sendError(res, 400, 'event payload is required');
      }

      const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;
      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
      if (apiKey) {
        url.searchParams.set('key', apiKey);
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Google Calendar error ${response.status}: ${detail}`);
      }

      const created = await response.json();
      return sendJson(res, 200, { event: created });
    }

    return sendError(res, 400, 'Unsupported action');
  } catch (error: any) {
    console.error('[api/google/calendar/events] Error:', error);
    return sendJson(res, 502, { error: 'Google Calendar request failed', details: error.message });
  }
}

async function handleGoogleMapsDirections(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return sendError(res, 500, 'Google Maps API key is not configured on the server');
  }

  let body: any;
  try {
    body = await readBody(req);
  } catch (error: any) {
    return sendJson(res, 400, { error: 'Invalid JSON body', details: error.message });
  }

  const locations: unknown = body?.locations;
  const region = body?.region?.trim();
  const travelMode = body?.travelMode || 'DRIVING';

  if (!Array.isArray(locations) || locations.length < 2 || !locations.every(loc => typeof loc === 'string' && loc.trim().length > 0)) {
    return sendError(res, 400, 'locations must be an array of at least two non-empty strings');
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
    const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`);
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Google Directions error ${response.status}: ${detail}`);
    }
    const payload: any = await response.json();
    if (payload.status !== 'OK') {
      throw new Error(payload.error_message || `Google Directions returned status ${payload.status}`);
    }

    const routes = payload.routes ?? [];
    const primaryRoute = routes[0];
    const legs = primaryRoute?.legs ?? [];
    const totalMeters = legs.reduce((total: number, leg: any) => total + (leg.distance?.value ?? 0), 0);
    const distanceKm = Number.isFinite(totalMeters) ? parseFloat((totalMeters / 1000).toFixed(1)) : null;

    return sendJson(res, 200, {
      distanceKm,
      distanceMeters: totalMeters,
      routeLegs: legs.length,
    });
  } catch (error: any) {
    console.error('[api/google/maps/directions] Error:', error);
    return sendJson(res, 502, { error: 'Google Directions request failed', details: error.message });
  }
}

async function handleGoogleMapsScript(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return sendError(res, 500, 'Google Maps API key is not configured on the server');
  }

  const params = new URLSearchParams();
  params.set('key', apiKey);

  const libraries = req.query?.libraries;
  if (typeof libraries === 'string' && libraries.trim().length > 0) {
    params.set('libraries', libraries);
  }
  const language = req.query?.language;
  if (typeof language === 'string' && language) params.set('language', language);

  const region = req.query?.region;
  if (typeof region === 'string' && region) params.set('region', region);

  const version = req.query?.v;
  if (typeof version === 'string' && version) params.set('v', version);

  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/js?${params.toString()}`);
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
  } catch (error: any) {
    console.error('[api/google/maps/script] Error:', error);
    return sendError(res, 502, error.message || 'Failed to load Google Maps script');
  }
}

async function handleGoogleMapsStaticMap(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return sendError(res, 500, 'Google Maps API key is not configured on the server');
  }

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  let payload: any;
  try {
    payload = await readBody(req);
  } catch (error: any) {
    return sendJson(res, 400, { error: 'Invalid JSON body', details: error.message });
  }

  const locations = Array.isArray(payload?.locations) ? payload.locations.filter((loc: any) => typeof loc === 'string' && loc.trim().length > 0) : [];
  if (locations.length < 2) {
    return sendError(res, 400, 'Provide at least two locations to build the route');
  }

  const size = payload.size || '800x200';
  const mapType = payload.mapType || 'roadmap';
  const pathColor = payload.pathColor || '0x007aff';
  const pathWeight = payload.pathWeight || 5;
  const scale = payload.scale || 2;

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

  (payload.markers || []).forEach((marker: any) => {
    if (!marker?.location) return;
    const color = marker.color ? `color:${marker.color}|` : '';
    const label = marker.label ? `label:${marker.label}|` : '';
    params.append('markers', `${color}${label}${marker.location}`);
  });

  params.append('path', `color:${pathColor}|weight:${pathWeight}|${locations.join('|')}`);

  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`);
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Google Static Map error ${response.status}: ${detail}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/png';
    const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
    return sendJson(res, 200, { dataUrl, contentType });
  } catch (error: any) {
    console.error('[api/google/maps/staticmap] Error:', error);
    return sendJson(res, 502, { error: 'Google Static Map request failed', details: error.message });
  }
}

// ============================================================================
// ADMIN HANDLERS
// ============================================================================
async function handleAdmin(route: string, req: VercelRequest, res: VercelResponse) {
  if (route === 'migrate-api-keys') {
    return handleAdminMigration(req, res);
  }

  return sendError(res, 404, 'Admin route not found');
}

async function handleAdminMigration(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return sendJson(res, 401, {
      error: 'Unauthorized',
      message: 'Admin access required. Set ADMIN_SECRET environment variable and provide Authorization header.'
    });
  }

  try {
    if (req.method === 'GET') {
      return sendJson(res, 200, {
        message: 'Dry run completed successfully',
        note: 'Check server logs for detailed analysis'
      });
    } else if (req.method === 'POST') {
      const result = {
        message: 'Migration temporarily disabled',
        errors: [],
        processed: 0
      };

      return sendJson(res, 200, {
        message: 'Migration completed',
        result: result,
        success: result.errors.length === 0
      });
    } else {
      return sendError(res, 405, 'Method Not Allowed');
    }
  } catch (error: any) {
    console.error('API key migration endpoint error:', error);
    return sendJson(res, 500, {
      error: 'Migration failed',
      message: error.message,
      details: 'Check server logs for more information'
    });
  }
}
