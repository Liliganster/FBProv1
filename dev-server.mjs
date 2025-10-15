// Lightweight local API server for development
// Mirrors the Vercel proxy endpoints used by the app so that
// distance calculation and Google Calendar work in `vite` dev mode.

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables from .env.local first, then .env
dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

function assertEnv(name) {
  const val = process.env[name];
  if (!val) return null;
  return String(val);
}

// -------- Google Calendar (server-side proxy) --------
const GCAL_EVENTS_BASE = 'https://www.googleapis.com/calendar/v3/calendars';
const GCAL_CAL_LIST_URL = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';

app.get('/api/google/calendar/calendars', async (req, res) => {
  try {
    const auth = req.headers['authorization'] || req.headers['Authorization'];
    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Authorization bearer token' });
    }
    const accessToken = auth.replace('Bearer ', '');
    const apiKey = assertEnv('GOOGLE_CALENDAR_API_KEY');

    const url = new URL(GCAL_CAL_LIST_URL);
    url.searchParams.set('maxResults', '250');
    if (apiKey) {
      url.searchParams.set('key', apiKey);
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error(`[dev-server] Google Calendar List Error ${response.status}:`, detail);
      return res.status(502).json({ error: 'Google Calendar list failed', details: detail });
    }

    const payload = await response.json();
    const calendars = Array.isArray(payload?.items) ? payload.items : [];
    return res.status(200).json({ calendars });

  } catch (error) {
    console.error('[dev-server] /api/google/calendar/calendars Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/google/calendar/events', async (req, res) => {
  // Health check: indicates whether server has an API key configured
  if (req.query.health) {
    const apiKey = assertEnv('GOOGLE_CALENDAR_API_KEY');
    return res.status(200).json({ ready: true, usesApiKey: Boolean(apiKey) });
  }
  return res.status(405).json({ error: 'Method Not Allowed' });
});

app.post('/api/google/calendar/events', async (req, res) => {
  try {
    const auth = req.headers['authorization'] || req.headers['Authorization'];
    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Authorization bearer token' });
    }
    const accessToken = auth.replace('Bearer ', '');
    const apiKey = assertEnv('GOOGLE_CALENDAR_API_KEY');

    const { action } = req.body || {};
    if (action === 'list') {
      const { calendarIds, timeMin, timeMax } = req.body || {};
      if (!Array.isArray(calendarIds) || !timeMin || !timeMax) {
        return res.status(400).json({ error: 'calendarIds, timeMin and timeMax are required' });
      }

      const events = [];
      for (const calendarId of calendarIds) {
        const url = new URL(`${GCAL_EVENTS_BASE}/${encodeURIComponent(calendarId)}/events`);
        url.searchParams.set('timeMin', String(timeMin));
        url.searchParams.set('timeMax', String(timeMax));
        url.searchParams.set('singleEvents', 'true');
        url.searchParams.set('maxResults', '100');
        url.searchParams.set('orderBy', 'startTime');
        if (apiKey) url.searchParams.set('key', apiKey);

        const response = await fetch(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
          const text = await response.text();
          return res.status(502).json({ error: 'Google Calendar error', details: `${response.status}: ${text}` });
        }
        const data = await response.json();
        if (Array.isArray(data?.items)) events.push(...data.items);
      }
      return res.status(200).json({ events });
    }

    if (action === 'create') {
      const calendarId = req.body?.calendarId || 'primary';
      const event = req.body?.event;
      if (!event || typeof event !== 'object') {
        return res.status(400).json({ error: 'event payload is required' });
      }
      const url = new URL(`${GCAL_EVENTS_BASE}/${encodeURIComponent(calendarId)}/events`);
      if (apiKey) url.searchParams.set('key', apiKey);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });
      if (!response.ok) {
        const text = await response.text();
        return res.status(502).json({ error: 'Google Calendar error', details: `${response.status}: ${text}` });
      }
      const data = await response.json();
      return res.status(200).json({ event: data });
    }

    return res.status(400).json({ error: 'Unsupported action' });
  } catch (err) {
    console.error('[dev-server] calendar/events error', err);
    return res.status(500).json({ error: 'Internal error', details: String(err?.message || err) });
  }
});

// -------- Google Maps (server-side proxy) --------
app.post('/api/google/maps/directions', async (req, res) => {
  try {
    const apiKey = assertEnv('GOOGLE_MAPS_API_KEY') || assertEnv('VITE_GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      return res.status(500).json({ error: 'Google Maps API key not configured on server' });
    }
    const locations = Array.isArray(req.body?.locations) ? req.body.locations.filter(x => typeof x === 'string' && x.trim() !== '') : [];
    const region = typeof req.body?.region === 'string' ? req.body.region : undefined;
    if (locations.length < 2) {
      return res.status(400).json({ error: 'At least two locations are required' });
    }

    const origin = locations[0];
    const destination = locations[locations.length - 1];
    const waypoints = locations.slice(1, -1);
    const params = new URLSearchParams();
    params.set('origin', origin);
    params.set('destination', destination);
    if (waypoints.length) params.set('waypoints', waypoints.join('|'));
    params.set('mode', 'driving');
    params.set('units', 'metric');
    params.set('key', apiKey);
    if (region) params.set('region', region);

    const url = `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ error: 'Google Directions error', details: `${response.status}: ${text}` });
    }
    const data = await response.json();
    const legs = (data?.routes?.[0]?.legs || []);
    const totalMeters = legs.reduce((sum, leg) => sum + (leg?.distance?.value || 0), 0);
    const distanceKm = Number.isFinite(totalMeters) ? parseFloat((totalMeters / 1000).toFixed(1)) : null;
    return res.status(200).json({ distanceKm, distanceMeters: totalMeters, legsCount: legs.length });
  } catch (err) {
    console.error('[dev-server] maps/directions error', err);
    return res.status(500).json({ error: 'Internal error', details: String(err?.message || err) });
  }
});

app.post('/api/google/maps/staticmap', async (req, res) => {
  try {
    const apiKey = assertEnv('GOOGLE_MAPS_API_KEY') || assertEnv('VITE_GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      return res.status(500).json({ error: 'Google Maps API key not configured on server' });
    }
    const locations = Array.isArray(req.body?.locations) ? req.body.locations.filter(x => typeof x === 'string' && x.trim() !== '') : [];
    if (locations.length < 2) {
      return res.status(400).json({ error: 'At least two locations are required' });
    }

    const size = typeof req.body?.size === 'string' ? req.body.size : '800x200';
    const scale = Number.isFinite(Number(req.body?.scale)) ? Number(req.body.scale) : 2;

    const path = `color:0x4285F4FF|weight:4|${locations.map(l => encodeURIComponent(l)).join('|')}`;
    const params = new URLSearchParams();
    params.set('size', size);
    params.set('scale', String(scale));
    params.set('key', apiKey);
    params.append('path', path);

    // Add start/end markers
    params.append('markers', `color:green|label:A|${locations[0]}`);
    params.append('markers', `color:red|label:B|${locations[locations.length - 1]}`);

    const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
    const response = await fetch(mapUrl);
    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ error: 'Google Static Maps error', details: `${response.status}: ${text}` });
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
    return res.status(200).json({ dataUrl });
  } catch (err) {
    console.error('[dev-server] maps/staticmap error', err);
    return res.status(500).json({ error: 'Internal error', details: String(err?.message || err) });
  }
});

// Optional: proxy the JS loader if client lacks a VITE_GOOGLE_MAPS_API_KEY
app.get('/api/google/maps/script', async (req, res) => {
  try {
    const apiKey = assertEnv('GOOGLE_MAPS_API_KEY') || assertEnv('VITE_GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      return res.status(500).send('// Google Maps API key not configured on server');
    }
    const params = new URLSearchParams(req.query);
    params.set('key', apiKey);
    const src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    const response = await fetch(src);
    if (!response.ok) {
      const text = await response.text();
      res.status(502).type('text/javascript').send(`// Error ${response.status}\n/* ${text} */`);
      return;
    }
    const body = await response.text();
    res.type('text/javascript').send(body);
  } catch (err) {
    console.error('[dev-server] maps/script error', err);
    res.type('text/javascript').send(`// Internal error\n/* ${String(err?.message || err)} */`);
  }
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Dev API server running on http://localhost:${PORT}`);
});
