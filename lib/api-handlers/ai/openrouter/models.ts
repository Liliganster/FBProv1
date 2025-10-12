import { withRateLimit } from '../../../lib/rate-limiter';

const APP_REFERER = process.env.OPENROUTER_HTTP_REFERER || 'https://fahrtenbuch-pro.app';
const APP_TITLE = process.env.OPENROUTER_TITLE || 'Fahrtenbuch Pro';

function toJsonResponse(res: any, status: number, payload: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));
}

async function modelsHandler(req: any, res: any) {
  if (req.method !== 'GET') {
    toJsonResponse(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const defaultKey = process.env.OPENROUTER_API_KEY;
  const queryKey = typeof req.query?.apiKey === 'string' && req.query.apiKey.trim() ? req.query.apiKey.trim() : null;
  const apiKey = queryKey || defaultKey;

  if (!apiKey) {
    toJsonResponse(res, 500, { error: 'OpenRouter API key is not configured' });
    return;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': APP_REFERER,
        'X-Title': APP_TITLE,
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

    toJsonResponse(res, 200, { models });
  } catch (error) {
    console.error('[api/ai/openrouter/models] Error:', error);
    toJsonResponse(res, 500, { error: 'OpenRouter request failed', details: (error as Error).message });
  }
}

export default withRateLimit(modelsHandler);
