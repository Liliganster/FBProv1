import type { VercelRequest, VercelResponse } from '@vercel/node';

// Consolidated API proxy handler for all routes
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { path } = req.query;
  
  if (!path || !Array.isArray(path)) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  const route = path.join('/');
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
    
    return res.status(404).json({ error: 'Route not found' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

async function handleAI(route: string, req: VercelRequest, res: VercelResponse) {
  // Import handlers dynamically from lib/api-handlers
  if (route === 'gemini-proxy' || route === 'gemini') {
    const { default: handler } = await import('../lib/api-handlers/ai/gemini-proxy');
    return handler(req, res);
  } else if (route.startsWith('openrouter/')) {
    const subRoute = route.replace('openrouter/', '');
    if (subRoute === 'chat') {
      const { default: handler } = await import('../lib/api-handlers/ai/openrouter/chat');
      return handler(req, res);
    } else if (subRoute === 'models') {
      const { default: handler } = await import('../lib/api-handlers/ai/openrouter/models');
      return handler(req, res);
    } else if (subRoute === 'structured') {
      const { default: handler } = await import('../lib/api-handlers/ai/openrouter/structured');
      return handler(req, res);
    }
  } else if (route === 'openrouter-models') {
    const { default: handler } = await import('../lib/api-handlers/ai/openrouter-models');
    return handler(req, res);
  } else if (route === 'openrouter-proxy') {
    const { default: handler } = await import('../lib/api-handlers/ai/openrouter-proxy');
    return handler(req, res);
  } else if (route === 'status') {
    const { default: handler } = await import('../lib/api-handlers/ai/status');
    return handler(req, res);
  }
  
  return res.status(404).json({ error: 'AI route not found' });
}

async function handleGoogle(route: string, req: VercelRequest, res: VercelResponse) {
  if (route.startsWith('calendar/')) {
    const subRoute = route.replace('calendar/', '');
    if (subRoute === 'calendars') {
      const { default: handler } = await import('../lib/api-handlers/google/calendar/calendars');
      return handler(req, res);
    } else if (subRoute === 'events') {
      const { default: handler } = await import('../lib/api-handlers/google/calendar/events');
      return handler(req, res);
    }
  } else if (route.startsWith('maps/')) {
    const subRoute = route.replace('maps/', '');
    if (subRoute === 'directions') {
      const { default: handler } = await import('../lib/api-handlers/google/maps/directions');
      return handler(req, res);
    } else if (subRoute === 'script') {
      const { default: handler } = await import('../lib/api-handlers/google/maps/script');
      return handler(req, res);
    } else if (subRoute === 'staticmap') {
      const { default: handler } = await import('../lib/api-handlers/google/maps/staticmap');
      return handler(req, res);
    }
  }
  
  return res.status(404).json({ error: 'Google route not found' });
}

async function handleAdmin(route: string, req: VercelRequest, res: VercelResponse) {
  if (route === 'migrate-api-keys') {
    const { default: handler } = await import('../lib/api-handlers/admin/migrate-api-keys');
    return handler(req, res);
  }
  
  return res.status(404).json({ error: 'Admin route not found' });
}
