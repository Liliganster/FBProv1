import type { CallsheetExtraction, CrewFirstCallsheet } from '../../../../services/extractor-universal/config/schema.js';
import { callsheetSchema, crewFirstCallsheetSchema } from '../../../../services/extractor-universal/config/schema.js';
import { buildDirectPrompt, buildCrewFirstDirectPrompt, sanitizeModelText } from '../../../../services/extractor-universal/prompts/callsheet.js';
import { isCallsheetExtraction, isCrewFirstCallsheet } from '../../../../services/extractor-universal/verify.js';
import { withRateLimit } from '../../../rate-limiter.js';
import { GoogleGenAI } from '@google/genai';

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
  console.log('[api/ai/openrouter/structured] 1. Handler start');
  if (req.method !== 'POST') {
    toJsonResponse(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  // Do not use server env defaults; require user's key from request

  let body: any;
  try {
    body = await readJsonBody(req);
    console.log('[api/ai/openrouter/structured] 2. Body parsed', {
      hasText: typeof body?.text === 'string',
      mode: body?.mode,
      useCrewFirst: body?.useCrewFirst,
      hasApiKey: !!body?.apiKey,
      hasModel: !!body?.model
    });
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
      console.log('[api/ai/openrouter/structured] 3. Agent mode with function calling');
      const { runAgentWithOpenRouter } = await import('../../../agent/orchestrator.js');
      const result = await runAgentWithOpenRouter({ apiKey, model, text });
      toJsonResponse(res, 200, result);
      return;
    }

    // Modo directo (sin function calling)
    const prompt = useCrewFirst
      ? buildCrewFirstDirectPrompt(sanitizeModelText(text))
      : buildDirectPrompt(sanitizeModelText(text));
    console.log('[api/ai/openrouter/structured] 4. Calling OpenRouter chat/completions');
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

    console.log('[api/ai/openrouter/structured] 5. OpenRouter status', response.status);
    if (!response.ok) {
      const detail = await response.text();
      console.error('[api/ai/openrouter/structured] 6. OpenRouter error', response.status, detail?.slice?.(0, 200));
      // On 5xx, try a single lightweight fallback to Gemini
      if (response.status >= 500) {
        try {
          const extraction = await fallbackWithGemini(text, useCrewFirst);
          toJsonResponse(res, 200, extraction);
          return;
        } catch (fallbackErr) {
          console.error('[api/ai/openrouter/structured] Gemini fallback failed:', fallbackErr);
        }
      }
      throw new Error(`OpenRouter error ${response.status}: ${detail}`);
    }

    console.log('[api/ai/openrouter/structured] 7. Parsing JSON');
    const payload = await response.json();
    const rawContent = payload?.choices?.[0]?.message?.content;

    function coerceTextFromContent(content: any): string | null {
      if (!content) return null;
      if (typeof content === 'string') return content;
      // Some models return array parts
      if (Array.isArray(content)) {
        const joined = content.map((c) => (typeof c === 'string' ? c : c?.text || c?.content || '')).join('');
        return joined || null;
      }
      // Already an object (when response_format enforces JSON object)
      if (typeof content === 'object') return JSON.stringify(content);
      return null;
    }

    function extractJson(text: string): any {
      let t = text.trim();
      // strip common code fences
      t = t.replace(/^```json\s*|```$/gim, '').trim();
      // Try full parse first
      try { return JSON.parse(t); } catch {}
      // Try to locate first {...} block
      const start = t.indexOf('{');
      const end = t.lastIndexOf('}');
      if (start >= 0 && end > start) {
        const slice = t.slice(start, end + 1);
        try { return JSON.parse(slice); } catch {}
      }
      return null;
    }

    const asText = coerceTextFromContent(rawContent);
    const parsedCandidate = asText ? extractJson(asText) : (typeof rawContent === 'object' ? rawContent : null);

    // Normalize for direct mode
    function normalizeDirect(candidate: any) {
      if (!candidate || typeof candidate !== 'object') return candidate;
      const obj: any = { ...candidate };
      if (typeof obj.productionCompany === 'string' && !obj.productionCompanies) {
        obj.productionCompanies = [obj.productionCompany];
        delete obj.productionCompany;
      }
      if (!Array.isArray(obj.productionCompanies)) {
        if (typeof obj.productionCompanies === 'string') obj.productionCompanies = [obj.productionCompanies];
        else if (obj.productionCompanies == null) obj.productionCompanies = ['Unknown'];
        else obj.productionCompanies = [String(obj.productionCompanies)];
      }
      if (!Array.isArray(obj.locations)) {
        if (typeof obj.locations === 'string') obj.locations = obj.locations.split(/\s*[;|\n]\s*/).filter(Boolean);
        else if (Array.isArray(obj.locations)) obj.locations = obj.locations.map((v: any) => typeof v === 'string' ? v : (v?.address || v?.name || ''));
        else obj.locations = [];
      } else {
        obj.locations = obj.locations.map((v: any) => typeof v === 'string' ? v : (v?.address || v?.name || ''));
      }
      if (typeof obj.date !== 'string') obj.date = String(obj.date || '');
      if (typeof obj.projectName !== 'string') obj.projectName = String(obj.projectName || '');
      return obj;
    }

    const parsed = useCrewFirst ? parsedCandidate : normalizeDirect(parsedCandidate);

    if (useCrewFirst) {
      if (!isCrewFirstCallsheet(parsed)) {
        console.error('[api/ai/openrouter/structured] 8. Invalid CrewFirst structure', parsed);
        // Fallback to Gemini if available
        try {
          const extraction = await fallbackWithGemini(text, true);
          toJsonResponse(res, 200, extraction);
          return;
        } catch (fallbackErr) {
          console.error('[api/ai/openrouter/structured] Gemini fallback failed:', fallbackErr);
          throw new Error('OpenRouter returned an unexpected CrewFirst JSON structure');
        }
      }
      toJsonResponse(res, 200, parsed);
    } else {
      if (!isCallsheetExtraction(parsed)) {
        console.error('[api/ai/openrouter/structured] 9. Invalid direct structure', parsed);
        // Fallback to Gemini if available
        try {
          const extraction = await fallbackWithGemini(text, false);
          toJsonResponse(res, 200, extraction);
          return;
        } catch (fallbackErr) {
          console.error('[api/ai/openrouter/structured] Gemini fallback failed:', fallbackErr);
          throw new Error('OpenRouter returned an unexpected JSON structure');
        }
      }
      toJsonResponse(res, 200, normalizeExtraction(parsed));
    }
  } catch (error) {
    console.error('[api/ai/openrouter/structured] 10. Error:', error);
    toJsonResponse(res, 500, { error: 'OpenRouter request failed', details: (error as Error).message });
  }
}

export default withRateLimit(structuredHandler);

// Server-side fallback to Gemini (direct mode). Returns normalized extraction or throws.
async function fallbackWithGemini(rawText: string, useCrewFirst: boolean): Promise<CallsheetExtraction | CrewFirstCallsheet> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured for fallback');
  const ai = new GoogleGenAI({ apiKey });
  const text = sanitizeModelText(rawText);
  const prompt = useCrewFirst ? buildCrewFirstDirectPrompt(text) : buildDirectPrompt(text);

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const result: any = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    responseMimeType: 'application/json',
    responseSchema: useCrewFirst ? (crewFirstCallsheetSchema as any) : (callsheetSchema as any),
  } as any);

  const output = typeof result.text === 'function'
    ? result.text()
    : result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!output) throw new Error('Empty response from Gemini fallback');
  const parsed = JSON.parse(output);
  if (useCrewFirst) {
    if (!isCrewFirstCallsheet(parsed)) throw new Error('Gemini fallback returned invalid CrewFirst payload');
    return parsed;
  }
  if (!isCallsheetExtraction(parsed)) throw new Error('Gemini fallback returned invalid payload');
  return normalizeExtraction(parsed);
}
