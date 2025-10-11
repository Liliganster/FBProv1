import { isCrewFirstCallsheet } from '../guards';
import type { CallsheetExtraction } from '../../services/extractor-universal/config/schema';
import type { ProviderCredentials } from '../../services/extractor-universal/index';
import { parseWithGemini, parseWithOpenRouter } from '../../services/extractor-universal/providers';

type ToolMap = Record<string, (args: any) => Promise<any>>;

export async function directParse(
  text: string,
  provider: 'gemini' | 'openrouter' = 'gemini',
  creds?: ProviderCredentials
): Promise<CallsheetExtraction> {
  if (provider === 'openrouter') {
    return await parseWithOpenRouter(text, creds?.openRouterApiKey || undefined, creds?.openRouterModel || undefined);
  }
  return await parseWithGemini(text);
}

export async function agenticParse(
  text: string,
  tools: ToolMap,
  provider: 'gemini' | 'openrouter' = 'gemini',
  creds?: ProviderCredentials
): Promise<CallsheetExtraction> {
  if (provider === 'openrouter') {
    return await directParse(text, 'openrouter', creds);
  }

  // Tool map retained for backwards compatibility; tooling executed server-side.
  void tools;

  const res = await fetch('/api/ai/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'agent', text }),
  });

  if (!res.ok) {
    throw new Error(`Gemini agent request failed: ${res.status} ${await res.text()}`);
  }

  const payload = await res.json();
  if (!isCrewFirstCallsheet(payload)) {
    throw new Error('Gemini agent request returned an unexpected payload');
  }

  return payload as CallsheetExtraction;
}
