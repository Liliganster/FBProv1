import type { CallsheetExtraction } from './config/schema';
import { isCallsheetExtraction } from './verify';
import { fetchWithRateLimit } from '../../lib/rate-limit-client';

function normalizeExtraction(raw: CallsheetExtraction): CallsheetExtraction {
  return {
    ...raw,
    locations: Array.from(new Set((raw.locations || []).map((s) => s.trim()).filter(Boolean))),
  };
}

async function parseJsonResponse(res: Response, provider: 'gemini' | 'openrouter'): Promise<CallsheetExtraction> {
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${provider} request failed: ${res.status} ${detail}`);
  }
  const payload = await res.json();
  if (!isCallsheetExtraction(payload)) {
    throw new Error(`${provider} returned an unexpected JSON payload`);
  }
  return normalizeExtraction(payload);
}

export async function parseWithGemini(text: string): Promise<CallsheetExtraction> {
  const res = await fetchWithRateLimit('/api/ai/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'direct', text }),
  });
  return await parseJsonResponse(res, 'gemini');
}

export async function parseWithOpenRouter(
  text: string,
  apiKeyOverride?: string | null,
  modelOverride?: string | null
): Promise<CallsheetExtraction> {
  const res = await fetchWithRateLimit('/api/ai/openrouter/structured', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      apiKey: apiKeyOverride ?? undefined,
      model: modelOverride ?? undefined,
    }),
  });
  return await parseJsonResponse(res, 'openrouter');
}
