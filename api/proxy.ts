import type { VercelRequest, VercelResponse } from '@vercel/node';

// Import consolidated handlers (already wrapped with rate limiting where applicable)
import geminiHandler from '../lib/api-handlers/ai/gemini.js';
import openrouterStructuredHandler from '../lib/api-handlers/ai/openrouter/structured.js';
import openrouterModelsHandler from '../lib/api-handlers/ai/openrouter/models.js';
import openrouterChatHandler from '../lib/api-handlers/ai/openrouter/chat.js';
import statusHandler from '../lib/api-handlers/ai/status.js';
import googleCalendarEventsHandler from '../lib/api-handlers/google/calendar/events.js';
import googleCalendarCalendarsHandler from '../lib/api-handlers/google/calendar/calendars.js';

type Handler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>;

const routes: Record<string, Handler> = {
  // AI endpoints
  'ai/gemini': geminiHandler,
  'ai/openrouter/structured': openrouterStructuredHandler,
  'ai/openrouter/models': openrouterModelsHandler,
  'ai/openrouter/chat': openrouterChatHandler,
  'ai/status': statusHandler,
  // Google Calendar proxy endpoints
  'google/calendar/events': googleCalendarEventsHandler,
  'google/calendar/calendars': googleCalendarCalendarsHandler,
};

function toJsonResponse(res: VercelResponse, status: number, payload: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));
}

export default async function proxy(req: VercelRequest, res: VercelResponse) {
  // Accept both /api/proxy?path=... and body.path if sent
  const raw = (req.query?.path as string) || (req.body as any)?.path || '';
  const path = String(raw || '').replace(/^\/+|\/+$/g, ''); // trim leading/trailing slashes

  if (!path) {
    toJsonResponse(res, 400, { error: 'Missing required query parameter: path' });
    return;
  }

  const handler = routes[path];
  if (!handler) {
    toJsonResponse(res, 404, { error: 'Not Found', path });
    return;
  }

  try {
    await handler(req as any, res as any);
  } catch (error) {
    console.error('[api/proxy] Unhandled error:', error);
    toJsonResponse(res, 500, { error: 'Internal Server Error', details: (error as Error)?.message || String(error) });
  }
}
