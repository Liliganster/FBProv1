import type { CallsheetExtraction, CrewFirstCallsheet } from '../../../../services/extractor-universal/config/schema.js';
import { buildDirectPrompt, buildCrewFirstDirectPrompt, sanitizeModelText } from '../../../../services/extractor-universal/prompts/callsheet.js';
import { isCallsheetExtraction, isCrewFirstCallsheet } from '../../../../services/extractor-universal/verify.js';
import { withRateLimit } from '../../../rate-limiter.js';
import { runAgentWithOpenRouter } from '../../../agent/orchestrator.js';

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

  // Do not use server env defaults; require user's key from request

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

  const mode = body?.mode === 'agent' ? 'agent' : 'direct';
  const useCrewFirst = body?.useCrewFirst === true;
  const apiKey = typeof body?.apiKey === 'string' && body.apiKey.trim() ? body.apiKey.trim() : null;
  if (!apiKey) {
    toJsonResponse(res, 400, { error: 'OpenRouter API key is required. Please add your API key in Settings.' });
    return;
  }

  const model = typeof body?.model === 'string' && body.model.trim() ? body.model.trim() : DEFAULT_MODEL;

  try {
    // Si es modo agente con crew-first, usar el orquestador con function calling
    if (mode === 'agent' && useCrewFirst) {
      console.log('[OpenRouter] Using agent mode with function calling');
      const result = await runAgentWithOpenRouter({
        apiKey,
        model,
        text
      });
      toJsonResponse(res, 200, result);
      return;
    }

    // Modo directo (sin function calling)
    const prompt = useCrewFirst
      ? buildCrewFirstDirectPrompt(sanitizeModelText(text))
      : buildDirectPrompt(sanitizeModelText(text));
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': deriveReferer(req),
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

    if (useCrewFirst) {
      if (!isCrewFirstCallsheet(parsed)) {
        throw new Error('OpenRouter returned an unexpected CrewFirst JSON structure');
      }
      toJsonResponse(res, 200, parsed);
    } else {
      if (!isCallsheetExtraction(parsed)) {
        throw new Error('OpenRouter returned an unexpected JSON structure');
      }
      toJsonResponse(res, 200, normalizeExtraction(parsed));
    }
  } catch (error) {
    console.error('[api/ai/openrouter/structured] Error:', error);
    toJsonResponse(res, 500, { error: 'OpenRouter request failed', details: (error as Error).message });
  }
}

export default withRateLimit(structuredHandler);
