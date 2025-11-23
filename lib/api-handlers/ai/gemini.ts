import { GoogleGenAI } from '@google/genai';
import type { CallsheetExtraction, CrewFirstCallsheet } from '../../../services/extractor-universal/config/schema.js';
import { callsheetSchema, crewFirstCallsheetSchema } from '../../../services/extractor-universal/config/schema.js';
import {
  buildDirectPrompt as buildCallsheetPrompt,
  buildCrewFirstDirectPrompt,
  sanitizeModelText
} from '../../../services/extractor-universal/prompts/callsheet.js';
import { isCallsheetExtraction, isCrewFirstCallsheet as isCrewFirstCallsheetVerify } from '../../../services/extractor-universal/verify.js';
import {
  SYSTEM_INSTRUCTION_AGENT,
  SYSTEM_INSTRUCTION_CREW_FIRST_AGENT,
  buildDirectPrompt as buildAgentPrompt
} from '../../gemini/prompt.js';
import { withRateLimit } from '../../rate-limiter.js';
import { tools as toolDeclarations } from '../../agent/tools.js';
import { executeTool } from '../../agent/executor.js';

type Mode = 'direct' | 'agent';

// Modelo por defecto para Google AI Studio. El usuario ha indicado explícitamente usar gemini-2.5-flash.
// Si defines GEMINI_MODEL en las variables de entorno, tendrá prioridad sobre este valor.
const GEMINI_MODEL = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim() || 'gemini-2.5-flash';

function toJsonResponse(res: any, status: number, payload: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));
}

const extractParts = (payload: any) =>
  payload?.response?.candidates?.[0]?.content?.parts
  || payload?.candidates?.[0]?.content?.parts
  || [];

function sanitizeJsonText(raw: string): string {
  let t = (raw || '').trim();
  // strip common fences
  t = t.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  // if still not a JSON object, try to slice first {...}
  if (!(t.startsWith('{') && t.endsWith('}'))) {
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start >= 0 && end > start) {
      t = t.slice(start, end + 1);
    }
  }
  return t;
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

async function runDirect(
  text: string,
  ai: GoogleGenAI,
  useCrewFirst = false
): Promise<CallsheetExtraction | CrewFirstCallsheet> {
  console.log(`[Gemini runDirect] Starting with useCrewFirst: ${useCrewFirst}, text length: ${text.length}`);

  const prompt = useCrewFirst
    ? buildCrewFirstDirectPrompt(sanitizeModelText(text))
    : buildCallsheetPrompt(sanitizeModelText(text));

  const baseRequest: any = {
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };

  console.log('[Gemini runDirect] Calling Gemini API with responseSchema...');
  const result: any = await ai.models.generateContent({
    ...baseRequest,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: useCrewFirst ? (crewFirstCallsheetSchema as any) : (callsheetSchema as any),
    },
  } as any);

  console.log('[Gemini runDirect] Full Result (schema):', JSON.stringify(result, null, 2));

  let output = '';
  const schemaParts = extractParts(result);
  if (schemaParts.length && typeof schemaParts[0]?.text === 'string') {
    output = schemaParts[0].text;
  } else if (typeof (result as any).text === 'function') {
    output = (result as any).text();
  }

  console.log('[Gemini runDirect] Raw output length (schema):', output?.length || 0);

  if (!output) {
    console.warn('[Gemini runDirect] Empty response with schema, retrying same model without responseSchema');

    const fallbackResult: any = await ai.models.generateContent({
      ...baseRequest,
      generationConfig: {
        temperature: 0,
      },
    } as any);

    console.log('[Gemini runDirect] Full Result (fallback same model):', JSON.stringify(fallbackResult, null, 2));

    const fallbackParts = extractParts(fallbackResult);
    if (fallbackParts.length && typeof fallbackParts[0]?.text === 'string') {
      output = fallbackParts[0].text;
    } else if (typeof (fallbackResult as any).text === 'function') {
      output = (fallbackResult as any).text();
    }
    console.log('[Gemini runDirect] Raw output length (fallback same model):', output?.length || 0);
  }

  if (!output) {
    console.error(`[Gemini runDirect] Empty response from Gemini model "${GEMINI_MODEL}" after schema retries`);
    throw new Error(`Empty response from Gemini model "${GEMINI_MODEL}". Verifica que el modelo este habilitado y la clave sea valida.`);
  }

  const parsed = JSON.parse(sanitizeJsonText(output));
  console.log('[Gemini runDirect] Parsed JSON:', parsed);

  if (useCrewFirst) {
    if (!isCrewFirstCallsheetVerify(parsed)) {
      console.error('[Gemini runDirect] Invalid CrewFirst schema:', parsed);
      throw new Error('Invalid CrewFirst JSON schema returned by Gemini');
    }
    return parsed;
  }

  if (!isCallsheetExtraction(parsed)) {
    console.error('[Gemini runDirect] Invalid callsheet schema:', parsed);
    throw new Error('Invalid JSON schema returned by Gemini');
  }
  return normalizeExtraction(parsed);
}

type ToolFn = (args: Record<string, unknown>) => Promise<Record<string, unknown>>;

async function runAgent(text: string, ai: GoogleGenAI, useCrewFirst = false): Promise<CallsheetExtraction | CrewFirstCallsheet> {
  console.log(`[Gemini runAgent] Starting with useCrewFirst: ${useCrewFirst}, text length: ${text.length}`);
  
  // Real tool execution is implemented server-side via executor
  const tools: Record<string, ToolFn> = {
    geocode_address: async ({ address }) => {
      console.log('[Gemini runAgent] Geocoding address:', address);
      const res = await executeTool('geocode_address', { address });
      return res as any;
    },
    address_normalize: async ({ raw, address }) => {
      // Support both { raw } and legacy { address }
      const value = typeof raw === 'string' ? raw : (typeof address === 'string' ? address : '');
      console.log('[Gemini runAgent] Normalizing address:', value);
      const res = await executeTool('address_normalize', { raw: value });
      return res as any;
    },
  };

  const systemInstruction = useCrewFirst ? SYSTEM_INSTRUCTION_CREW_FIRST_AGENT : SYSTEM_INSTRUCTION_AGENT;

  // Formato correcto para Gemini API - usar "contents" con "parts"
  const contents: any[] = [
    { role: 'user', parts: [{ text: systemInstruction + '\n\n' + buildAgentPrompt(text) }] }
  ];

  // Limit to 2 attempts to reduce execution time (important for Vercel Hobby 10s timeout)
  const maxAttempts = 2;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    console.log(`[Gemini runAgent] Attempt ${attempt + 1}/${maxAttempts}`);
    
    // Usar "contents" en lugar de "messages"
    const response: any = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      // Use our tool declarations (Gemini-compatible)
      tools: [{ functionDeclarations: toolDeclarations.map((t: any) => t.function) }],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: useCrewFirst ? (crewFirstCallsheetSchema as any) : (callsheetSchema as any),
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ]
    } as any);

    // Log full response for debugging
    console.log('[Gemini runAgent] Full Response (schema):', JSON.stringify(response, null, 2));

    const extractParts = (payload: any) =>
      payload?.response?.candidates?.[0]?.content?.parts
      || payload?.candidates?.[0]?.content?.parts
      || [];

    let parts = extractParts(response);
    
    // Fallback for models that fail with responseSchema
    if (parts.length === 0) {
      console.warn('[Gemini runAgent] Empty response with schema, retrying without it.');
      const fallbackResponse: any = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        tools: [{ functionDeclarations: toolDeclarations.map((t: any) => t.function) }],
        toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
        generationConfig: {
          temperature: 0,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ]
      } as any);

      console.log('[Gemini runAgent] Full Response (fallback):', JSON.stringify(fallbackResponse, null, 2));
      parts = extractParts(fallbackResponse);
    }

    const fnCall = parts.find((p: any) => p?.functionCall);

    if (fnCall?.functionCall) {
      const { name, args } = fnCall.functionCall;
      console.log('[Gemini runAgent] Function call:', name, 'args:', args);
      const tool = tools[name];
      if (!tool) {
        console.warn('[Gemini runAgent] Unknown tool:', name);
        continue;
      }
      try {
        const result = await tool(args || {});
        console.log('[Gemini runAgent] Tool result:', result);
        // Agregar resultado de la herramienta en formato correcto
        contents.push({ 
          role: 'function',
          parts: [{ 
            functionResponse: {
              name,
              response: result
            }
          }]
        });
      } catch (error) {
        console.error('[Gemini runAgent] Tool error:', error);
        contents.push({ 
          role: 'function',
          parts: [{ 
            functionResponse: {
              name,
              response: { error: (error as Error).message }
            }
          }]
        });
      }
      continue;
    }

    const asAny: any = response;
    const output =
      typeof asAny.text === 'function'
        ? asAny.text()
        : extractParts(asAny)?.[0]?.text ?? '';

    console.log('[Gemini runAgent] Output length:', output?.length || 0);

    if (!output) continue;

    try {
      const data = JSON.parse(sanitizeJsonText(output));
      console.log('[Gemini runAgent] Parsed data:', data);

      if (useCrewFirst) {
        if (isCrewFirstCallsheetVerify(data)) {
          console.log('[Gemini runAgent] Success - valid CrewFirst data');
          return data;
        }
      } else {
        if (isCallsheetExtraction(data)) {
          console.log('[Gemini runAgent] Success - valid callsheet data');
          return normalizeExtraction(data);
        }
      }
      console.warn('[Gemini runAgent] Invalid schema on attempt', attempt + 1);
    } catch (parseError) {
      console.error('[Gemini runAgent] Parse error on attempt', attempt + 1, ':', parseError);
      // ignore parse errors and continue loop
    }
  }

  console.log('[Gemini runAgent] All attempts failed, falling back to direct mode');
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
    console.error('[Gemini Handler] GEMINI_API_KEY not configured');
    toJsonResponse(res, 500, { error: 'Gemini API key is not configured' });
    return;
  }

  let body: any;
  try {
    body = await readJsonBody(req);
    console.log('[Gemini Handler] Request body:', { mode: body?.mode, textLength: body?.text?.length, useCrewFirst: body?.useCrewFirst });
  } catch (error) {
    console.error('[Gemini Handler] Invalid JSON body:', error);
    toJsonResponse(res, 400, { error: 'Invalid JSON body', details: (error as Error).message });
    return;
  }

  const mode: Mode = body?.mode === 'agent' ? 'agent' : 'direct';
  const text = body?.text;
  const useCrewFirst = body?.useCrewFirst === true; // Enable crew-first mode if explicitly set

  if (typeof text !== 'string' || !text.trim()) {
    console.error('[Gemini Handler] Missing or empty text field');
    toJsonResponse(res, 400, { error: 'Request body must include a non-empty text field' });
    return;
  }

  console.log(`[Gemini Handler] Processing in ${mode} mode, useCrewFirst: ${useCrewFirst}, text length: ${text.length}`);
  console.log(`[Gemini Handler] Using API key: ${apiKey.substring(0, 10)}...`);
  console.log(`[Gemini Handler] Using model: ${GEMINI_MODEL}`);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const extraction = mode === 'agent'
      ? await runAgent(text, ai, useCrewFirst)
      : await runDirect(text, ai, useCrewFirst);

    console.log('[Gemini Handler] Extraction successful:', extraction);
    toJsonResponse(res, 200, extraction);
  } catch (error) {
    console.error('[Gemini Handler] Error:', error);
    console.error('[Gemini Handler] Error stack:', (error as Error).stack);
    toJsonResponse(res, 500, { error: 'Gemini request failed', details: (error as Error).message });
  }
}

export default withRateLimit(geminiHandler);
