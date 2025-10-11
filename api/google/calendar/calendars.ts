function json(res: any, status: number, payload: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));
}

function getAccessToken(req: any): string | null {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
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

  try {
    const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');
    url.searchParams.set('maxResults', '250');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Google Calendar error ${response.status}: ${detail}`);
    }

    const payload = await response.json();
    const calendars = Array.isArray(payload?.items) ? payload.items : [];
    json(res, 200, { calendars });
  } catch (error) {
    console.error('[api/google/calendar/calendars] Error:', error);
    json(res, 502, { error: 'Google Calendar list failed', details: (error as Error).message });
  }
}
