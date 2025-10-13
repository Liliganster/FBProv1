import type { CallsheetExtraction, CrewFirstCallsheet } from './config/schema';
import { isCallsheetExtraction, isCrewFirstCallsheet } from './verify';
import { fetchWithRateLimit } from '../../lib/rate-limit-client';

function normalizeExtraction(raw: CallsheetExtraction): CallsheetExtraction {
  return {
    ...raw,
    locations: Array.from(new Set((raw.locations || []).map((s) => s.trim()).filter(Boolean))),
  };
}

async function parseJsonResponse(
  res: Response,
  provider: 'gemini' | 'openrouter',
  useCrewFirst = false
): Promise<CallsheetExtraction | CrewFirstCallsheet> {
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${provider} request failed: ${res.status} ${detail}`);
  }
  const payload = await res.json();

  if (useCrewFirst) {
    if (!isCrewFirstCallsheet(payload)) {
      throw new Error(`${provider} returned an unexpected CrewFirst JSON payload`);
    }
    return payload;
  } else {
    if (!isCallsheetExtraction(payload)) {
      throw new Error(`${provider} returned an unexpected JSON payload`);
    }
    return normalizeExtraction(payload);
  }
}

export async function parseWithGemini(
  text: string,
  useCrewFirst = false
): Promise<CallsheetExtraction | CrewFirstCallsheet> {
  const res = await fetchWithRateLimit('/api/proxy?path=ai/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'direct', text, useCrewFirst }),
  });
  return await parseJsonResponse(res, 'gemini', useCrewFirst);
}

export async function parseWithOpenRouter(
  text: string,
  apiKeyOverride?: string | null,
  modelOverride?: string | null,
  useCrewFirst = false
): Promise<CallsheetExtraction | CrewFirstCallsheet> {
  const res = await fetchWithRateLimit('/api/proxy?path=ai/openrouter/structured', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      apiKey: apiKeyOverride ?? undefined,
      model: modelOverride ?? undefined,
      useCrewFirst,
    }),
  });
  return await parseJsonResponse(res, 'openrouter', useCrewFirst);
}
