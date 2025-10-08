import { buildDirectPrompt, SYSTEM_INSTRUCTION_AGENT } from './prompt';
import { responseSchema } from './schema';
import { isCrewFirstCallsheet } from '../guards';
import type { CallsheetExtraction } from '../../services/extractor-universal/config/schema';
import type { ProviderCredentials } from '../../services/extractor-universal/index';
import { parseWithGemini, parseWithOpenRouter } from '../../services/extractor-universal/providers';

export async function directParse(text: string, provider: 'gemini'|'openrouter'='gemini', creds?: ProviderCredentials): Promise<CallsheetExtraction> {
  // Delegate to universal providers to avoid duplication
  if (provider === 'openrouter') {
    return await parseWithOpenRouter(text, creds?.openRouterApiKey || undefined, creds?.openRouterModel || undefined);
  }
  // Gemini path – try with structured output conceptually via prompt+validation
  return await parseWithGemini(text, creds?.geminiApiKey || undefined);
}

type ToolMap = Record<string, (args: any) => Promise<any>>;

export async function agenticParse(text: string, tools: ToolMap, provider: 'gemini'|'openrouter'='gemini', creds?: ProviderCredentials): Promise<CallsheetExtraction> {
  // For OpenRouter (varios modelos), la disponibilidad de tool-calls varía. Fallback a directo.
  if (provider === 'openrouter') {
    return await directParse(text, 'openrouter', creds);
  }

  // Gemini simple tool-call loop
  const apiKey = creds?.geminiApiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any)?.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key missing');
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  // Build function declarations from tools
  const fns = Object.keys(tools).map((name) => ({ name, description: `Tool ${name}`, parameters: { type: 'object' } }));

  // Initialize conversation
  const messages: any[] = [
    { role: 'system', content: SYSTEM_INSTRUCTION_AGENT },
    { role: 'user', content: buildDirectPrompt(text) }
  ];

  for (let i = 0; i < 4; i++) {
    const res: any = await ai.models.generateContent({
      model: 'gemini-2.0-flash-001',
      messages,
      tools: [{ functionDeclarations: fns }],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
      temperature: 0,
    } as any);

    const parts = res?.response?.candidates?.[0]?.content?.parts || [];
    const fnCall = parts.find((p: any) => p.functionCall);
    if (fnCall && fnCall.functionCall) {
      const { name, args } = fnCall.functionCall;
      if (tools[name]) {
        const toolRes = await tools[name](args || {});
        messages.push({ role: 'tool', content: JSON.stringify(toolRes), name });
        continue;
      }
    }

    // If no function call, expect final JSON
    const outText: string = typeof res.text === 'function' ? res.text() : (res?.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
    try {
      const data = JSON.parse(outText);
      if (!isCrewFirstCallsheet(data)) throw new Error('invalid');
      return data as CallsheetExtraction;
    } catch {
      // fallthrough to next iteration or break
    }
  }
  // Fallback: direct
  return await directParse(text, 'gemini', creds);
}
