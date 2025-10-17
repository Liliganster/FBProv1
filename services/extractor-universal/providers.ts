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
    // CRITICAL FIX: Handle multiple legacy format issues
    if (payload && typeof payload === 'object') {
      // Fix 1: productionCompany (string) → productionCompanies (array)
      if (typeof payload.productionCompany === 'string' && !payload.productionCompanies) {
        console.log(`[${provider}] Converting productionCompany (string) to productionCompanies (array)`);
        payload.productionCompanies = [payload.productionCompany];
        delete payload.productionCompany;
      }
      
      // Fix 2: Ensure productionCompanies is always an array
      if (!Array.isArray(payload.productionCompanies)) {
        console.warn(`[${provider}] productionCompanies is not an array, converting...`);
        if (typeof payload.productionCompanies === 'string') {
          payload.productionCompanies = [payload.productionCompanies];
        } else if (payload.productionCompanies === null || payload.productionCompanies === undefined) {
          payload.productionCompanies = ['Unknown'];
        } else {
          payload.productionCompanies = [String(payload.productionCompanies)];
        }
      }
      
      // Fix 3: Ensure required fields exist
      if (!payload.date) payload.date = '';
      if (!payload.projectName) payload.projectName = '';
      if (!Array.isArray(payload.locations)) payload.locations = [];
    }
    
    if (!isCallsheetExtraction(payload)) {
      console.error(`[${provider}] Invalid payload after normalization:`, JSON.stringify(payload, null, 2));
      throw new Error(`${provider} returned an unexpected JSON payload. Expected: {date: string, projectName: string, productionCompanies: string[], locations: string[]}`);
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
