import { GoogleGenAI } from '@google/genai';
import type { CallsheetExtraction, CrewFirstCallsheet } from '../../../services/extractor-universal/config/schema';
import { callsheetSchema, crewFirstCallsheetSchema } from '../../../services/extractor-universal/config/schema';
import {
  buildDirectPrompt as buildCallsheetPrompt,
  buildCrewFirstDirectPrompt,
  sanitizeModelText
} from '../../../services/extractor-universal/prompts/callsheet';
import { isCallsheetExtraction, isCrewFirstCallsheet as isCrewFirstCallsheetVerify } from '../../../services/extractor-universal/verify';
import {
  SYSTEM_INSTRUCTION_AGENT,
  SYSTEM_INSTRUCTION_CREW_FIRST_AGENT,
  buildDirectPrompt as buildAgentPrompt
} from '../../gemini/prompt';
import { withRateLimit } from '../../rate-limiter';
import { tools as toolDeclarations } from '../../agent/tools';
import { executeTool } from '../../agent/executor';

type Mode = 'direct' | 'agent';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-001';

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

async function runDirect(text: string, ai: GoogleGenAI, useCrewFirst = false): Promise<CallsheetExtraction | CrewFirstCallsheet> {
  const prompt = useCrewFirst
    ? buildCrewFirstDirectPrompt(sanitizeModelText(text))
    : buildCallsheetPrompt(sanitizeModelText(text));

  const result: any = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    responseMimeType: 'application/json',
    responseSchema: useCrewFirst ? (crewFirstCallsheetSchema as any) : (callsheetSchema as any),
  } as any);

  const output =
    typeof result.text === 'function'
      ? result.text()
      : result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (!output) {
    throw new Error('Empty response from Gemini');
  }

  const parsed = JSON.parse(output);

  if (useCrewFirst) {
    if (!isCrewFirstCallsheetVerify(parsed)) {
      throw new Error('Invalid CrewFirst JSON schema returned by Gemini');
    }
    return parsed;
  } else {
    if (!isCallsheetExtraction(parsed)) {
      throw new Error('Invalid JSON schema returned by Gemini');
    }
    return normalizeExtraction(parsed);
  }
}

type ToolFn = (args: Record<string, unknown>) => Promise<Record<string, unknown>>;

async function runAgent(text: string, ai: GoogleGenAI, useCrewFirst = false): Promise<CallsheetExtraction | CrewFirstCallsheet> {
  // Real tool execution is implemented server-side via executor
  const tools: Record<string, ToolFn> = {
    geocode_address: async ({ address }) => {
      const res = await executeTool('geocode_address', { address });
      return res as any;
    },
    address_normalize: async ({ raw, address }) => {
      // Support both { raw } and legacy { address }
      const value = typeof raw === 'string' ? raw : (typeof address === 'string' ? address : '');
      const res = await executeTool('address_normalize', { raw: value });
      return res as any;
    },
  };

  const systemInstruction = useCrewFirst ? SYSTEM_INSTRUCTION_CREW_FIRST_AGENT : SYSTEM_INSTRUCTION_AGENT;

  const messages: any[] = [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: buildAgentPrompt(text) },
  ];

  for (let attempt = 0; attempt < 4; attempt++) {
    const response: any = await ai.models.generateContent({
      model: GEMINI_MODEL,
      messages,
      // Use our tool declarations (Gemini-compatible)
      tools: [{ functionDeclarations: toolDeclarations.map((t: any) => t.function) }],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: useCrewFirst ? (crewFirstCallsheetSchema as any) : (callsheetSchema as any),
    } as any);

    const parts = response?.response?.candidates?.[0]?.content?.parts || [];
    const fnCall = parts.find((p: any) => p?.functionCall);

    if (fnCall?.functionCall) {
      const { name, args } = fnCall.functionCall;
      const tool = tools[name];
      if (!tool) continue;
      try {
        const result = await tool(args || {});
        messages.push({ role: 'tool', name, content: JSON.stringify(result) });
      } catch (error) {
        messages.push({ role: 'tool', name, content: JSON.stringify({ error: (error as Error).message }) });
      }
      continue;
    }

    const output =
      typeof response.text === 'function'
        ? response.text()
        : response?.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!output) continue;

    try {
      const data = JSON.parse(output);

      if (useCrewFirst) {
        if (isCrewFirstCallsheetVerify(data)) {
          return data;
        }
      } else {
        if (isCallsheetExtraction(data)) {
          return normalizeExtraction(data);
        }
      }
    } catch {
      // ignore parse errors and continue loop
    }
  }

  // Fallback to direct mode if agent loop fails
  return await runDirect(text, ai, useCrewFirst);
}

async function geminiHandler(req: any, res: any) {
  if (req.method !== 'POST') {
    toJsonResponse(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    toJsonResponse(res, 500, { error: 'Gemini API key is not configured' });
    return;
  }

  let body: any;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    toJsonResponse(res, 400, { error: 'Invalid JSON body', details: (error as Error).message });
    return;
  }

  const mode: Mode = body?.mode === 'agent' ? 'agent' : 'direct';
  const text = body?.text;
  const useCrewFirst = body?.useCrewFirst === true; // Enable crew-first mode if explicitly set

  if (typeof text !== 'string' || !text.trim()) {
    toJsonResponse(res, 400, { error: 'Request body must include a non-empty text field' });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const extraction = mode === 'agent'
      ? await runAgent(text, ai, useCrewFirst)
      : await runDirect(text, ai, useCrewFirst);
    toJsonResponse(res, 200, extraction);
  } catch (error) {
    console.error('[api/ai/gemini] Error:', error);
    toJsonResponse(res, 500, { error: 'Gemini request failed', details: (error as Error).message });
  }
}

export default withRateLimit(geminiHandler);
