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
  console.log('[DirectParse] Starting parse with provider:', provider, 'useCrewFirst:', useCrewFirst);

  try {
    if (provider === 'openrouter') {
      const result = await parseWithOpenRouter(
        text,
        creds?.openRouterApiKey || undefined,
        creds?.openRouterModel || undefined,
        useCrewFirst
      );
      console.log('[DirectParse] OpenRouter result:', result);
      return result;
    }
    const result = await parseWithGemini(text, useCrewFirst);
    console.log('[DirectParse] Gemini result:', result);
    return result;
  } catch (error) {
    console.error('[DirectParse] Parse failed:', error);
    throw error;
  }
}

export async function agenticParse(
  text: string,
  tools: ToolMap,
  provider: 'gemini' | 'openrouter' = 'gemini',
  creds?: ProviderCredentials,
  useCrewFirst = false
): Promise<CallsheetExtraction | CrewFirstCallsheet> {
  console.log('[AgenticParse] Starting parse with provider:', provider, 'useCrewFirst:', useCrewFirst);

  try {
    if (provider === 'openrouter') {
      // Run via OpenRouter structured endpoint. If useCrewFirst is true, the server uses
      // the function-calling orchestrator; otherwise it returns structured JSON directly.
      const result = await parseWithOpenRouter(
        text,
        creds?.openRouterApiKey || undefined,
        creds?.openRouterModel || undefined,
        useCrewFirst,
        'agent'
      );
      console.log('[AgenticParse] OpenRouter result:', result);
      return result;
    }

    // Tool map retained for backwards compatibility; tooling executed server-side.
    void tools;

    console.log('[AgenticParse] Calling /api/ai/gemini endpoint');
    const res = await fetch('/api/ai/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'agent', text, useCrewFirst }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[AgenticParse] Gemini API request failed:', res.status, errorText);
      throw new Error(`Gemini agent request failed: ${res.status} ${errorText}`);
    }

    const payload = await res.json();
    console.log('[AgenticParse] Gemini API response:', payload);

    if (!isCrewFirstCallsheet(payload)) {
      console.error('[AgenticParse] Invalid payload format:', payload);
      throw new Error('Gemini agent request returned an unexpected payload');
    }

    return payload;
    return payload;
  } catch (error) {
    console.error('[AgenticParse] Parse failed:', error);
    throw error;
  }
}

export async function visionParse(
  text: string,
  image: string,
  useCrewFirst = false
): Promise<CallsheetExtraction | CrewFirstCallsheet> {
  console.log('[VisionParse] Starting with useCrewFirst:', useCrewFirst);

  try {
    const res = await fetch('/api/ai/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'vision', text, image, useCrewFirst }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[VisionParse] Gemini API request failed:', res.status, errorText);
      throw new Error(`Gemini vision request failed: ${res.status} ${errorText}`);
    }

    const payload = await res.json();
    return payload;
  } catch (error) {
    console.error('[VisionParse] Parse failed:', error);
    throw error;
  }
}

