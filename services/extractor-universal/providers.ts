import { callsheetSchema, type CallsheetExtraction } from './config/schema';
import { buildDirectPrompt, sanitizeModelText } from './prompts/callsheet';
import { isCallsheetExtraction } from './verify';

export async function parseWithGemini(text: string, apiKeyOverride?: string | null): Promise<CallsheetExtraction> {
  const apiKey = apiKeyOverride || (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any)?.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key is missing (VITE_GEMINI_API_KEY).');
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: apiKey as string });
  const prompt = buildDirectPrompt(sanitizeModelText(text));
  const res: any = await ai.models.generateContent({
    model: 'gemini-2.0-flash-001',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  } as any);
  const out: string = typeof res.text === 'function' ? res.text() : (res?.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
  const data = JSON.parse(out);
  if (!isCallsheetExtraction(data)) throw new Error('Invalid JSON shape');
  data.locations = Array.from(new Set(data.locations.map((s: string) => s.trim()).filter(Boolean)));
  return data;
}

export async function parseWithOpenRouter(
  text: string,
  apiKeyOverride?: string | null,
  modelOverride?: string | null
): Promise<CallsheetExtraction> {
  const apiKey = apiKeyOverride || (import.meta as any).env?.VITE_OPENROUTER_API_KEY;
  const model = modelOverride || (import.meta as any).env?.VITE_OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';
  if (!apiKey) throw new Error('OpenRouter API key is missing (VITE_OPENROUTER_API_KEY).');
  const prompt = buildDirectPrompt(sanitizeModelText(text));
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Fahrtenbuch Pro'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You output ONLY valid JSON. No explanations.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    })
  });
  if (!res.ok) throw new Error(`OpenRouter error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  const parsed = typeof content === 'string' ? JSON.parse(content) : content;
  if (!isCallsheetExtraction(parsed)) throw new Error('Invalid JSON shape');
  parsed.locations = Array.from(new Set(parsed.locations.map((s: string) => s.trim()).filter(Boolean)));
  return parsed;
}

