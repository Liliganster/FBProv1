import { withRateLimit } from '../../../rate-limiter.js';

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';
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

async function readJsonBody(req: any): Promise<any> {
  if (req.body) return req.body;
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString('utf8');
    });
    req.on('end', () => {
      if (!data.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

async function chatHandler(req: any, res: any) {
  if (req.method !== 'POST') {
    toJsonResponse(res, 405, { error: 'Method Not Allowed' });
    return;
  }


  let body: any;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    toJsonResponse(res, 400, { error: 'Invalid JSON body', details: (error as Error).message });
    return;
  }

  const messages = Array.isArray(body?.messages) ? body.messages : null;
  if (!messages || messages.length === 0) {
    toJsonResponse(res, 400, { error: 'Request body must include a non-empty messages array' });
    return;
  }

  const apiKey = typeof body?.apiKey === 'string' && body.apiKey.trim() ? body.apiKey.trim() : null;
  if (!apiKey) {
    toJsonResponse(res, 400, { error: 'OpenRouter API key is required. Please add your API key in Settings.' });
    return;
  }

  const model = typeof body?.model === 'string' && body.model.trim() ? body.model.trim() : DEFAULT_MODEL;
  const temperature = typeof body?.temperature === 'number' ? body.temperature : 0.1;

  const payload: Record<string, unknown> = {
    model,
    messages,
    temperature,
  };

  if (body?.response_format) {
    payload.response_format = body.response_format;
  }
  if (body?.max_tokens) {
    payload.max_tokens = body.max_tokens;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': deriveReferer(req),
        'X-Title': APP_TITLE,
      },
      body: JSON.stringify(payload),
    });

    let json: any;
    try {
      json = await response.json();
    } catch (parseError) {
      console.error('[api/ai/openrouter/chat] Failed to parse response as JSON:', parseError);
      toJsonResponse(res, 500, {
        error: 'Invalid response from OpenRouter',
        details: 'The API returned a non-JSON response'
      });
      return;
    }

    if (!response.ok) {
      const detail = typeof json === 'object' ? json : { detail: json };
      const errorMessage = json?.error?.message || json?.message || 'OpenRouter request failed';
      console.error(`[api/ai/openrouter/chat] OpenRouter error ${response.status}:`, JSON.stringify(detail));

      toJsonResponse(res, 400, {
        error: errorMessage,
        details: `Status ${response.status}: ${JSON.stringify(detail).substring(0, 200)}`
      });
      return;
    }

    toJsonResponse(res, 200, json);
  } catch (error) {
    console.error('[api/ai/openrouter/chat] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    toJsonResponse(res, 500, {
      error: 'Failed to connect to OpenRouter. Please check your network connection and API key.',
      details: errorMessage
    });
  }
}

export default withRateLimit(chatHandler);
