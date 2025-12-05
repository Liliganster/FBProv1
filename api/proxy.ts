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
      // Google Maps proxy endpoints
      case 'google/maps/directions':
        return (await import('../lib/api-handlers/google/maps/directions.js')).default as unknown as Handler;
      case 'google/maps/staticmap':
        return (await import('../lib/api-handlers/google/maps/staticmap.js')).default as unknown as Handler;
      case 'google/maps/script':
        return (await import('../lib/api-handlers/google/maps/script.js')).default as unknown as Handler;
      // Auth endpoints
      case 'auth/delete-account':
        return (await import('../lib/api-handlers/auth/delete-account.js')).default as unknown as Handler;
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

  // Abuse Prevention Check for AI endpoints
  if (path.startsWith('ai/')) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const { checkAbuse } = await import('../lib/abuse-prevention.js');

      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && serviceRoleKey) {
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false }
        });

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const fingerprint = req.headers['x-device-fingerprint']; // Frontend must send this

        const isBanned = await checkAbuse(supabaseAdmin, {
          ip: Array.isArray(ip) ? ip[0] : ip,
          fingerprint: Array.isArray(fingerprint) ? fingerprint[0] : fingerprint
        });

        if (isBanned) {
          console.warn(`[AbusePrevention] Blocked request from IP: ${ip}, Fingerprint: ${fingerprint}`);
          toJsonResponse(res, 403, {
            error: 'Access Denied',
            message: 'Your device or network has been flagged for abuse of the free tier.'
          });
          return;
        }
      }
    } catch (error) {
      console.error('[AbusePrevention] Error checking abuse status:', error);
      // Fail open to avoid blocking legitimate users on error
    }
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
