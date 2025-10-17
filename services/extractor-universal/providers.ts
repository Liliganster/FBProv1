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
      console.error(`[${provider}] Invalid CrewFirst payload:`, payload);
      throw new Error(`${provider} returned an unexpected CrewFirst JSON payload`);
    }
    return payload;
  } else {
    // Handle legacy format conversion: productionCompany (string) → productionCompanies (array)
    if (payload && typeof payload === 'object' && typeof payload.productionCompany === 'string' && !payload.productionCompanies) {
      console.log(`[${provider}] Converting legacy productionCompany to productionCompanies array`);
      payload.productionCompanies = [payload.productionCompany];
      delete payload.productionCompany;
    }
    
    if (!isCallsheetExtraction(payload)) {
      console.error(`[${provider}] Invalid payload:`, payload);
      throw new Error(`${provider} returned an unexpected JSON payload`);
    }
    return normalizeExtraction(payload);
  }
}

export async function parseWithGemini(
  text: string,
  useCrewFirst = false
): Promise<CallsheetExtraction | CrewFirstCallsheet> {
  const res = await fetchWithRateLimit('/api/ai/gemini', {
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
  useCrewFirst = false,
  mode: 'direct' | 'agent' = 'direct'
): Promise<CallsheetExtraction | CrewFirstCallsheet> {
  const res = await fetchWithRateLimit('/api/ai/openrouter/structured', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      apiKey: apiKeyOverride ?? undefined,
      model: modelOverride ?? undefined,
      useCrewFirst,
      mode,
    }),
  });
  return await parseJsonResponse(res, 'openrouter', useCrewFirst);
}
