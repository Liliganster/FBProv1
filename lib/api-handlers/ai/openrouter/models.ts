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
  try {
    console.log('[api/ai/openrouter/models] 1. Handler started', {
      method: req.method,
      hasQuery: !!req.query,
      hasApiKey: !!req.query?.apiKey,
      headers: Object.keys(req.headers || {})
    });

    if (req.method !== 'GET') {
      console.log('[api/ai/openrouter/models] 2. Method not GET, rejecting');
      toJsonResponse(res, 405, { error: 'Method Not Allowed' });
      return;
    }

    // Require the user's API key; do not fallback to server env
    const queryKey = typeof req.query?.apiKey === 'string' && req.query.apiKey.trim() ? req.query.apiKey.trim() : null;
    const apiKey = queryKey;

    console.log('[api/ai/openrouter/models] 3. API key extracted', {
      hasApiKey: !!apiKey,
      keyLength: apiKey?.length || 0
    });

    if (!apiKey) {
      console.log('[api/ai/openrouter/models] 4. No API key provided');
      toJsonResponse(res, 400, { error: 'OpenRouter API key is required. Please add your API key in Settings.' });
      return;
    }

    console.log('[api/ai/openrouter/models] 5. Fetching models from OpenRouter...');
    
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': deriveReferer(req),
        'X-Title': APP_TITLE,
      },
    });

    console.log('[api/ai/openrouter/models] 6. OpenRouter response status:', response.status);

    if (!response.ok) {
      console.log('[api/ai/openrouter/models] 7. Response not OK, parsing error');
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
        console.error('[api/ai/openrouter/models] 8. Error parsing error response:', parseError);
        errorDetails = 'Unable to parse error response';
      }

      console.error(`[api/ai/openrouter/models] 9. OpenRouter API error ${response.status}:`, errorDetails);

      // Return a user-friendly error message with appropriate status code
      toJsonResponse(res, response.status >= 500 ? 502 : 400, {
        error: errorMessage,
        details: `Status ${response.status}: ${errorDetails.substring(0, 200)}`
      });
      return;
    }

    console.log('[api/ai/openrouter/models] 10. Parsing JSON response');
    const json = await response.json();
    console.log('[api/ai/openrouter/models] 11. Models received:', json?.data?.length || 0);
    const models = Array.isArray(json?.data)
      ? json.data
          .map((m: any) => ({ id: m.id, name: m.name || m.id }))
          .filter((m: any) => m.id && typeof m.id === 'string')
          .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
      : [];

    if (models.length === 0) {
      console.warn('[api/ai/openrouter/models] 12. WARNING: No models returned from OpenRouter API');
    }

    console.log('[api/ai/openrouter/models] 13. Returning', models.length, 'models');
    toJsonResponse(res, 200, { models });
  } catch (error) {
    console.error('[api/ai/openrouter/models] 14. CATCH ERROR:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('aborted');
    
    toJsonResponse(res, isTimeout ? 504 : 500, {
      error: isTimeout 
        ? 'Request to OpenRouter timed out. Please try again.' 
        : 'Failed to connect to OpenRouter. Please check your network connection and API key.',
      details: errorMessage
    });
  }
}

export default withRateLimit(modelsHandler);
