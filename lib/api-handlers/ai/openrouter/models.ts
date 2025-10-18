import { withRateLimit } from '../../../rate-limiter';

function deriveReferer(req: any): string {
  try {
    const xfProto = (req.headers?.['x-forwarded-proto'] || 'https') as string;
    const xfHost = (req.headers?.['x-forwarded-host'] || req.headers?.host || '').toString();
    if (xfHost) return `${xfProto}://${xfHost}`;
  } catch {}
  return process.env.OPENROUTER_HTTP_REFERER || 'https://fahrtenbuch-pro.app';
}
const APP_TITLE = process.env.OPENROUTER_TITLE || 'Fahrtenbuch Pro';

function toJsonResponse(res: any, status: number, payload: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));
}

async function modelsHandler(req: any, res: any) {
  if (req.method !== 'GET') {
    toJsonResponse(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  // Require the user's API key; do not fallback to server env
  const queryKey = typeof req.query?.apiKey === 'string' && req.query.apiKey.trim() ? req.query.apiKey.trim() : null;
  const apiKey = queryKey;

  if (!apiKey) {
    toJsonResponse(res, 400, { error: 'OpenRouter API key is required. Please add your API key in Settings.' });
    return;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': deriveReferer(req),
        'X-Title': APP_TITLE,
      },
    });

    if (!response.ok) {
      let errorMessage = 'Failed to fetch models from OpenRouter';
      let errorDetails = '';

      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorJson = await response.json();
          errorDetails = JSON.stringify(errorJson);
          errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
        } else {
          errorDetails = await response.text();
        }
      } catch (parseError) {
        console.error('[api/ai/openrouter/models] Error parsing error response:', parseError);
        errorDetails = 'Unable to parse error response';
      }

      console.error(`[api/ai/openrouter/models] OpenRouter API error ${response.status}:`, errorDetails);

      // Return a user-friendly error message
      toJsonResponse(res, 400, {
        error: errorMessage,
        details: `Status ${response.status}: ${errorDetails.substring(0, 200)}`
      });
      return;
    }

    const json = await response.json();
    const models = Array.isArray(json?.data)
      ? json.data
          .map((m: any) => ({ id: m.id, name: m.name || m.id }))
          .filter((m: any) => m.id && typeof m.id === 'string')
          .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
      : [];

    if (models.length === 0) {
      console.warn('[api/ai/openrouter/models] No models returned from OpenRouter API');
    }

    toJsonResponse(res, 200, { models });
  } catch (error) {
    console.error('[api/ai/openrouter/models] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    toJsonResponse(res, 500, {
      error: 'Failed to connect to OpenRouter. Please check your network connection and API key.',
      details: errorMessage
    });
  }
}

export default withRateLimit(modelsHandler);
