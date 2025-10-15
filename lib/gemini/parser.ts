import { isCrewFirstCallsheet } from '../guards';
import type { CallsheetExtraction, CrewFirstCallsheet } from '../../services/extractor-universal/config/schema';
import type { ProviderCredentials } from '../../services/extractor-universal/index';
import { parseWithGemini, parseWithOpenRouter } from '../../services/extractor-universal/providers';

type ToolMap = Record<string, (args: any) => Promise<any>>;

export async function directParse(
  text: string,
  provider: 'gemini' | 'openrouter' = 'gemini',
  creds?: ProviderCredentials,
  useCrewFirst = false
): Promise<CallsheetExtraction | CrewFirstCallsheet> {
  if (provider === 'openrouter') {
    return await parseWithOpenRouter(
      text,
      creds?.openRouterApiKey || undefined,
      creds?.openRouterModel || undefined,
      useCrewFirst
    );
  }
  return await parseWithGemini(text, useCrewFirst);
}

export async function agenticParse(
  text: string,
  tools: ToolMap,
  provider: 'gemini' | 'openrouter' = 'gemini',
  creds?: ProviderCredentials,
  useCrewFirst = false
): Promise<CallsheetExtraction | CrewFirstCallsheet> {
  if (provider === 'openrouter') {
    // Run via OpenRouter structured endpoint. If useCrewFirst is true, the server uses
    // the function-calling orchestrator; otherwise it returns structured JSON directly.
    return await parseWithOpenRouter(
      text,
      creds?.openRouterApiKey || undefined,
      creds?.openRouterModel || undefined,
      useCrewFirst,
      'agent'
    );
  }

  // Tool map retained for backwards compatibility; tooling executed server-side.
  void tools;

  const res = await fetch('/api/ai/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'agent', text, useCrewFirst }),
  });

  if (!res.ok) {
    throw new Error(`Gemini agent request failed: ${res.status} ${await res.text()}`);
  }

  const payload = await res.json();
  if (!isCrewFirstCallsheet(payload)) {
    throw new Error('Gemini agent request returned an unexpected payload');
  }

  return payload;
}
