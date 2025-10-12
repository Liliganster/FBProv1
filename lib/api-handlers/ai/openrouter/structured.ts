import type { CallsheetExtraction } from '../../../../services/extractor-universal/config/schema';
import { buildDirectPrompt, sanitizeModelText } from '../../../../services/extractor-universal/prompts/callsheet';
import { isCallsheetExtraction } from '../../../../services/extractor-universal/verify';
import { withRateLimit } from '../../../rate-limiter';

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';
const APP_REFERER = process.env.OPENROUTER_HTTP_REFERER || 'https://fahrtenbuch-pro.app';
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

function normalizeExtraction(raw: CallsheetExtraction): CallsheetExtraction {
  return {
    ...raw,
    locations: Array.from(new Set((raw.locations || []).map((loc) => loc.trim()).filter(Boolean))),
  };
}

async function structuredHandler(req: any, res: any) {
  if (req.method !== 'POST') {
    toJsonResponse(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const defaultKey = process.env.OPENROUTER_API_KEY;

  let body: any;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    toJsonResponse(res, 400, { error: 'Invalid JSON body', details: (error as Error).message });
    return;
  }

  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) {
    toJsonResponse(res, 400, { error: 'Request body must include a non-empty text field' });
    return;
  }

  const apiKeyFromRequest = typeof body?.apiKey === 'string' && body.apiKey.trim() ? body.apiKey.trim() : null;
  const apiKey = apiKeyFromRequest || defaultKey;
  if (!apiKey) {
    toJsonResponse(res, 500, { error: 'OpenRouter API key is not configured' });
    return;
  }

  const model = typeof body?.model === 'string' && body.model.trim() ? body.model.trim() : DEFAULT_MODEL;

  try {
    const prompt = buildDirectPrompt(sanitizeModelText(text));
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': APP_REFERER,
        'X-Title': APP_TITLE,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You output ONLY valid JSON. No explanations.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${detail}`);
    }

    const payload = await response.json();
    const message = payload?.choices?.[0]?.message?.content;
    const parsed = typeof message === 'string' ? JSON.parse(message) : message;

    if (!isCallsheetExtraction(parsed)) {
      throw new Error('OpenRouter returned an unexpected JSON structure');
    }

    toJsonResponse(res, 200, normalizeExtraction(parsed));
  } catch (error) {
    console.error('[api/ai/openrouter/structured] Error:', error);
    toJsonResponse(res, 500, { error: 'OpenRouter request failed', details: (error as Error).message });
  }
}

export default withRateLimit(structuredHandler);
