import type { VercelRequest, VercelResponse } from '@vercel/node';

type Handler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>;

async function getHandler(path: string): Promise<Handler | null> {
  try {
    switch (path) {
      // AI endpoints
      case 'ai/gemini':
        return (await import('../lib/api-handlers/ai/gemini.js')).default as unknown as Handler;
      case 'ai/openrouter/structured':
        return (await import('../lib/api-handlers/ai/openrouter/structured.js')).default as unknown as Handler;
      case 'ai/openrouter/models':
        return (await import('../lib/api-handlers/ai/openrouter/models.js')).default as unknown as Handler;
      case 'ai/openrouter/chat':
        return (await import('../lib/api-handlers/ai/openrouter/chat.js')).default as unknown as Handler;
      case 'ai/status':
        return (await import('../lib/api-handlers/ai/status.js')).default as unknown as Handler;
      // Google Calendar proxy endpoints
      case 'google/calendar/events':
        return (await import('../lib/api-handlers/google/calendar/events.js')).default as unknown as Handler;
      case 'google/calendar/calendars':
        return (await import('../lib/api-handlers/google/calendar/calendars.js')).default as unknown as Handler;
      default:
        return null;
    }
  } catch (err) {
    console.error('[api/proxy] Failed to import handler for path:', path, err);
    throw err;
  }
}

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

  const handler = await getHandler(path);
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
