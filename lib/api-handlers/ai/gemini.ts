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
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-1.5-flash-002';

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
  console.log(`[Gemini runDirect] Starting with useCrewFirst: ${useCrewFirst}, text length: ${text.length}`);
  
  const prompt = useCrewFirst
    ? buildCrewFirstDirectPrompt(sanitizeModelText(text))
    : buildCallsheetPrompt(sanitizeModelText(text));

  console.log('[Gemini runDirect] Calling Gemini API...');
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

  const pickFirstTextPart = (payload: any): string => {
    if (!payload) return '';
    if (typeof payload.text === 'function') {
      const val = payload.text();
      if (typeof val === 'string' && val.trim()) return val;
    }
    const parts = payload?.response?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part && typeof part.text === 'string' && part.text.trim()) {
        return part.text;
      }
    }
    return '';
  };

  // Primer intento: modo JSON estructurado con responseSchema
  const result: any = await ai.models.generateContent({
    ...baseRequest,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: useCrewFirst ? (crewFirstCallsheetSchema as any) : (callsheetSchema as any),
    },
  } as any);

  // Log full result for debugging
  console.log('[Gemini runDirect] Full Result (schema):', JSON.stringify(result, null, 2));

  let output = pickFirstTextPart(result);
  console.log('[Gemini runDirect] Raw output length (schema):', output?.length || 0);

  // Algunos modelos (como ciertas versiones de 2.5) pueden devolver 200 pero sin contenido cuando se usa responseSchema.
  // En ese caso, reintentamos sin responseSchema para evitar el error "Empty response from Gemini".
  if (!output) {
    console.warn('[Gemini runDirect] Empty response with schema, retrying without responseSchema');

    const fallbackResult: any = await ai.models.generateContent({
      ...baseRequest,
      generationConfig: {
        // Sin responseSchema ni responseMimeType forzado: el prompt ya exige JSON.
        temperature: 0,
      },
    } as any);

    console.log('[Gemini runDirect] Full Result (fallback same model):', JSON.stringify(fallbackResult, null, 2));

    output = pickFirstTextPart(fallbackResult);
    console.log('[Gemini runDirect] Raw output length (fallback same model):', output?.length || 0);
  }

  // Si seguimos sin contenido, intentamos con modelo de respaldo (si está configurado y es distinto)
  if (!output && GEMINI_FALLBACK_MODEL && GEMINI_FALLBACK_MODEL !== GEMINI_MODEL) {
    console.warn(`[Gemini runDirect] Empty response from model "${GEMINI_MODEL}", retrying with fallback model "${GEMINI_FALLBACK_MODEL}"`);

    const fallbackBaseRequest: any = {
      ...baseRequest,
      model: GEMINI_FALLBACK_MODEL,
    };

    const fbResult: any = await ai.models.generateContent({
      ...fallbackBaseRequest,
      generationConfig: {
        temperature: 0,
      },
    } as any);

    console.log('[Gemini runDirect] Full Result (fallback model):', JSON.stringify(fbResult, null, 2));

    output = pickFirstTextPart(fbResult);
    console.log('[Gemini runDirect] Raw output length (fallback model):', output?.length || 0);
  }

  if (!output) {
    console.error('[Gemini runDirect] Empty response from Gemini after all fallbacks');
    throw new Error('Empty response from Gemini');
  }

  const parsed = JSON.parse(output);
  console.log('[Gemini runDirect] Parsed JSON:', parsed);

  if (useCrewFirst) {
    if (!isCrewFirstCallsheetVerify(parsed)) {
      console.error('[Gemini runDirect] Invalid CrewFirst schema:', parsed);
      throw new Error('Invalid CrewFirst JSON schema returned by Gemini');
    }
    return parsed;
  } else {
    if (!isCallsheetExtraction(parsed)) {
      console.error('[Gemini runDirect] Invalid callsheet schema:', parsed);
      throw new Error('Invalid JSON schema returned by Gemini');
    }
    return normalizeExtraction(parsed);
  }
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

    let parts = response?.response?.candidates?.[0]?.content?.parts || [];
    
    // Fallback for models that fail with responseSchema
    if (parts.length === 0) {
      console.warn('[Gemini runAgent] Empty response with schema, retrying without it.');
      const fallbackResponse = await ai.models.generateContent({
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
      parts = fallbackResponse?.response?.candidates?.[0]?.content?.parts || [];
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

    const output =
      typeof response.text === 'function'
        ? response.text()
        : response?.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    console.log('[Gemini runAgent] Output length:', output?.length || 0);

    if (!output) continue;

    try {
      const data = JSON.parse(output);
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
