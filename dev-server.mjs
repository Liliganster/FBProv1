// Lightweight local API server for development
// Mirrors the Vercel proxy endpoints used by the app so that
// distance calculation and Google Calendar work in `vite` dev mode.

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from .env.local first, then .env
dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased for AI requests with large text

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

// -------- AI Routes --------
// Proxy AI requests (Gemini, OpenRouter, etc.)

app.post('/api/ai/gemini', async (req, res) => {
  try {
    const apiKey = assertEnv('GEMINI_API_KEY');
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured' });
    }

    const { mode, text, useCrewFirst } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Request body must include a non-empty text field' });
    }

    console.log(`[dev-server] Gemini request: mode=${mode}, textLength=${text.length}, useCrewFirst=${useCrewFirst}`);

    // Forward to Google Gemini API
    // Note: This is a simplified version. For full implementation, use the actual handler
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text }]
        }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('[dev-server] Gemini error:', detail);
      return res.status(502).json({ error: 'Gemini request failed', details: detail });
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      return res.status(500).json({ error: 'Empty response from Gemini' });
    }

    const parsed = JSON.parse(content);
    return res.status(200).json(parsed);
  } catch (error) {
    console.error('[dev-server] /api/ai/gemini error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/api/ai/openrouter/structured', async (req, res) => {
  try {
    const defaultKey = assertEnv('OPENROUTER_API_KEY');
    const { text, apiKey: bodyApiKey, model: bodyModel, useCrewFirst, mode } = req.body || {};

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Request body must include a non-empty text field' });
    }

    const apiKey = bodyApiKey || defaultKey;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenRouter API key is not configured' });
    }

    const model = bodyModel || assertEnv('OPENROUTER_MODEL') || 'google/gemini-2.0-flash-001';

    console.log(`[dev-server] OpenRouter request: model=${model}, textLength=${text.length}, useCrewFirst=${useCrewFirst}, mode=${mode}`);

    // Build system prompt based on useCrewFirst
    const systemContent = useCrewFirst
      ? 'You are a callsheet extraction service. Output ONLY valid JSON matching this exact schema (no extra fields): {"version":"parser-crew-1","date":"YYYY-MM-DD","projectName":"string","productionCompany":string|null,"motiv":string|null,"episode":string|null,"shootingDay":string|null,"generalCallTime":string|null,"locations":[{"location_type":"FILMING_PRINCIPAL"|"UNIT_BASE"|"CATERING"|"MAKEUP_HAIR"|"WARDROBE"|"CREW_PARKING"|"LOAD_UNLOAD","name"?:string,"address":string,"formatted_address"?:string|null,"latitude"?:number|null,"longitude"?:number|null,"notes"?:string[],"confidence"?:number}],"rutas":[]} Rules: 1) version must be "parser-crew-1". 2) date must be normalized to YYYY-MM-DD. 3) locations must use one of the allowed location_type values. 4) No explanations, only the JSON object.'
      : `You are a callsheet data extraction AI. Extract ONLY the main filming locations from the callsheet. 

CRITICAL RULES:
1. Extract ONLY locations marked as "Drehort", "Location", "Set", or "Motiv" (filming locations)
2. IGNORE all locations for: Basis, Parken, Aufenthalt, Kostüm, Maske, Lunch, Catering, Team, Technik, Office, Meeting
3. IGNORE room names or internal location names without a street address (e.g., "Suite Nico", "Keller", "Catering Bereich")
4. Each location MUST be a complete physical address with street name and number (e.g., "Salmgasse 10, 1030 Wien")
5. If a location has both a place name AND an address, use ONLY the address
6. Remove duplicates
7. Order locations in the sequence they appear on the callsheet

Output format: {"date":"YYYY-MM-DD","projectName":"string","locations":["complete address 1","complete address 2",...]}

Example good locations: ["Palais Rasumofsky, 23-25, 1030 Wien", "Salmgasse 10, 1030 Wien"]
Example BAD locations to IGNORE: ["Suite Nico", "Keller", "Catering Bereich", "Basis", "Parken"]`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': assertEnv('OPENROUTER_HTTP_REFERER') || 'https://fahrtenbuch-pro.app',
        'X-Title': assertEnv('OPENROUTER_TITLE') || 'Fahrtenbuch Pro',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: text }
        ],
        temperature: 0,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('[dev-server] OpenRouter error:', detail);
      return res.status(502).json({ error: 'OpenRouter request failed', details: detail });
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message?.content;
    const parsed = typeof message === 'string' ? JSON.parse(message) : message;

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('[dev-server] /api/ai/openrouter/structured error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/api/ai/openrouter/chat', async (req, res) => {
  try {
    const defaultKey = assertEnv('OPENROUTER_API_KEY');
    const { messages, apiKey: bodyApiKey, model: bodyModel, temperature, response_format, max_tokens } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Request body must include a non-empty messages array' });
    }

    const apiKey = bodyApiKey || defaultKey;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenRouter API key is not configured' });
    }

    const model = bodyModel || assertEnv('OPENROUTER_MODEL') || 'google/gemini-2.0-flash-001';

    console.log(`[dev-server] OpenRouter chat request: model=${model}, messages=${messages.length}`);

    const payload = {
      model,
      messages,
      temperature: typeof temperature === 'number' ? temperature : 0.1
    };

    if (response_format) payload.response_format = response_format;
    if (max_tokens) payload.max_tokens = max_tokens;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': assertEnv('OPENROUTER_HTTP_REFERER') || 'https://fahrtenbuch-pro.app',
        'X-Title': assertEnv('OPENROUTER_TITLE') || 'Fahrtenbuch Pro',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('[dev-server] OpenRouter chat error:', detail);
      return res.status(502).json({ error: 'OpenRouter request failed', details: detail });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('[dev-server] /api/ai/openrouter/chat error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/api/ai/openrouter/models', async (req, res) => {
  try {
    const defaultKey = assertEnv('OPENROUTER_API_KEY');
    const queryKey = req.query?.apiKey;
    const apiKey = queryKey || defaultKey;

    if (!apiKey) {
      return res.status(500).json({ error: 'OpenRouter API key is not configured' });
    }

    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': assertEnv('OPENROUTER_HTTP_REFERER') || 'https://fahrtenbuch-pro.app',
        'X-Title': assertEnv('OPENROUTER_TITLE') || 'Fahrtenbuch Pro',
      }
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('[dev-server] OpenRouter models error:', detail);
      return res.status(502).json({ error: 'OpenRouter request failed', details: detail });
    }

    const data = await response.json();
    const models = Array.isArray(data?.data)
      ? data.data
          .map(m => ({ id: m.id, name: m.name || m.id }))
          .filter(m => m.id)
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];

    return res.status(200).json({ models });
  } catch (error) {
    console.error('[dev-server] /api/ai/openrouter/models error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Dev API server running on http://localhost:${PORT}`);
});
