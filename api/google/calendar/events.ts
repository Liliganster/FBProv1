type CalendarEvent = Record<string, unknown>;

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

function getAccessToken(req: any): string | null {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

const GOOGLE_EVENTS_ENDPOINT = 'https://www.googleapis.com/calendar/v3/calendars';

async function fetchJson(url: string, init: RequestInit): Promise<any> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Calendar error ${response.status}: ${text}`);
  }
  return await response.json();
}

async function listEvents(params: {
  calendarIds: string[];
  timeMin: string;
  timeMax: string;
  accessToken: string;
  apiKey?: string;
}): Promise<CalendarEvent[]> {
  const { calendarIds, timeMin, timeMax, accessToken, apiKey } = params;
  const events: CalendarEvent[] = [];

  for (const calendarId of calendarIds) {
    const url = new URL(`${GOOGLE_EVENTS_ENDPOINT}/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('maxResults', '100');
    url.searchParams.set('orderBy', 'startTime');
    if (apiKey) {
      url.searchParams.set('key', apiKey);
    }

    const data = await fetchJson(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (Array.isArray(data?.items)) {
      events.push(...data.items);
    }
  }

  return events;
}

async function createEvent(params: {
  calendarId: string;
  event: CalendarEvent;
  accessToken: string;
  apiKey?: string;
}) {
  const { calendarId, event, accessToken, apiKey } = params;
  const url = new URL(`${GOOGLE_EVENTS_ENDPOINT}/${encodeURIComponent(calendarId)}/events`);
  if (apiKey) {
    url.searchParams.set('key', apiKey);
  }

  return await fetchJson(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });
}

export default async function handler(req: any, res: any) {
  if (req.method === 'GET' && req.query?.health) {
    json(res, 200, { ready: Boolean(process.env.GOOGLE_CALENDAR_API_KEY) });
    return;
  }

  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;
  if (!apiKey) {
    json(res, 500, { error: 'Google Calendar API key is not configured on the server' });
    return;
  }

  const accessToken = getAccessToken(req);
  if (!accessToken) {
    json(res, 401, { error: 'Missing Authorization bearer token' });
    return;
  }

  let body: any;
  try {
    body = await readBody(req);
  } catch (error) {
    json(res, 400, { error: 'Invalid JSON body', details: (error as Error).message });
    return;
  }

  const action = body?.action;

  try {
    if (action === 'list') {
      const calendarIds: string[] = Array.isArray(body?.calendarIds) ? body.calendarIds : [];
      const timeMin = body?.timeMin;
      const timeMax = body?.timeMax;

      if (calendarIds.length === 0 || typeof timeMin !== 'string' || typeof timeMax !== 'string') {
        json(res, 400, { error: 'calendarIds, timeMin and timeMax are required' });
        return;
      }

      const events = await listEvents({ calendarIds, timeMin, timeMax, accessToken, apiKey });
      json(res, 200, { events });
      return;
    }

    if (action === 'create') {
      const calendarId = body?.calendarId || 'primary';
      const event = body?.event;

      if (!event || typeof event !== 'object') {
        json(res, 400, { error: 'event payload is required' });
        return;
      }

      const created = await createEvent({ calendarId, event, accessToken, apiKey });
      json(res, 200, { event: created });
      return;
    }

    json(res, 400, { error: 'Unsupported action' });
  } catch (error) {
    console.error('[api/google/calendar/events] Error:', error);
    json(res, 502, { error: 'Google Calendar request failed', details: (error as Error).message });
  }
}
