import { callsheetSchema, type CallsheetExtraction } from './config/schema';
import {
  detectKind,
  getTextFromTextFile,
  getTextFromCsvFile,
  extractTextFromPdfFile,
  extractTextWithOCRFromPdfFile,
  extractTextWithOCRFromImageFile,
} from './miner';
import { cleanOcrText, normalizeCsvForModel } from './normalize';
import { isCallsheetExtraction } from './verify';
import { postProcessCrewFirstData } from './postProcess';
import { agenticParse, directParse } from '../../lib/gemini/parser';
import { parseWithGemini, parseWithOpenRouter } from './providers';

export type ExtractMode = 'direct' | 'agent';
export type ExtractProvider = 'auto' | 'gemini' | 'openrouter';

export type ExtractInput = {
  text?: string; // pasted text
  file?: File;   // pdf/csv/image/txt
};

class ExtractorError extends Error {
  code:
    | 'no_input'
    | 'requires_ocr'
    | 'pdf_parse_error'
    | 'ai_invalid_json'
    | 'ai_extraction_failed';
  constructor(code: ExtractorError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

export type ProviderCredentials = {
  openRouterApiKey?: string | null;
  openRouterModel?: string | null;
};

async function normalizeDirect(input: ExtractInput): Promise<{ text: string; source: string }> {
  if (input.text && input.text.trim()) {
    return { text: input.text.trim(), source: 'text' };
  }
  const file = input.file;
  if (!file) throw new ExtractorError('no_input', 'Provide text or upload a file.');
  const kind = detectKind(file);
  if (kind === 'text') return { text: await getTextFromTextFile(file), source: 'text' };
  if (kind === 'csv') return { text: normalizeCsvForModel(await getTextFromCsvFile(file)), source: 'csv' };
  if (kind === 'pdf') {
    try {
      const text = await extractTextFromPdfFile(file);
      return { text, source: 'pdf' };
    } catch (e: any) {
      if (e?.code === 'requires_ocr') {
        throw new ExtractorError('requires_ocr', 'This PDF has no text layer. Use Agent Mode (OCR) or paste text.');
      }
      throw new ExtractorError('pdf_parse_error', 'Could not read the PDF. Try another file or paste the content.');
    }
  }
  if (kind === 'image') {
    throw new ExtractorError('requires_ocr', 'Images require OCR. Use Agent Mode.');
  }
  throw new ExtractorError('no_input', 'Unsupported file type. Provide text, CSV, PDF or image.');
}

async function normalizeAgent(input: ExtractInput): Promise<{ text: string; source: string }> {
  if (input.text && input.text.trim()) {
    return { text: cleanOcrText(input.text), source: 'text' };
  }
  const file = input.file;
  if (!file) throw new ExtractorError('no_input', 'Provide text or upload a file.');
  const kind = detectKind(file);
  if (kind === 'text') return { text: cleanOcrText(await getTextFromTextFile(file)), source: 'text' };
  if (kind === 'csv') return { text: normalizeCsvForModel(await getTextFromCsvFile(file)), source: 'csv' };
  if (kind === 'pdf') {
    try {
      const text = await extractTextFromPdfFile(file);
      return { text, source: 'pdf' };
    } catch (e: any) {
      // Fallback to OCR
      const ocrText = await extractTextWithOCRFromPdfFile(file);
      return { text: cleanOcrText(ocrText), source: 'pdf' };
    }
  }
  if (kind === 'image') {
    const text = await extractTextWithOCRFromImageFile(file);
    return { text: cleanOcrText(text), source: 'image' };
  }
  throw new ExtractorError('no_input', 'Unsupported file type. Provide text, CSV, PDF or image.');
}

// Gemini client wrapper
// Providers moved to ./providers to avoid circular imports from parser

function resolveProvider(
  provider: ExtractProvider,
  creds?: ProviderCredentials
): { provider: 'gemini' | 'openrouter'; creds: ProviderCredentials } {
  const c: ProviderCredentials = {
    openRouterApiKey: creds?.openRouterApiKey ?? null,
    openRouterModel: creds?.openRouterModel ?? null,
  };
  if (provider === 'gemini') return { provider: 'gemini', creds: c };
  if (provider === 'openrouter') return { provider: 'openrouter', creds: c };
  // auto: prefer OpenRouter if OpenRouter key is present; otherwise use Gemini
  if (c.openRouterApiKey && (c.openRouterModel || true)) {
    return { provider: 'openrouter', creds: c };
  }
  return { provider: 'gemini', creds: c };
}

export async function extractUniversalStructured({
  mode,
  input,
  provider = 'auto',
  credentials,
  useCrewFirst = false, // Use simple schema by default
}: {
  mode: ExtractMode;
  input: ExtractInput;
  provider?: ExtractProvider;
  credentials?: ProviderCredentials;
  useCrewFirst?: boolean; // Optional parameter to use CrewFirst schema
}): Promise<CallsheetExtraction> {
  console.log('[ExtractorUniversal] Starting extraction:', { mode, provider, useCrewFirst, hasFile: !!input.file, hasText: !!input.text });
  
  try {
    const normalized = mode === 'direct' ? await normalizeDirect(input) : await normalizeAgent(input);
    console.log('[ExtractorUniversal] Normalized text length:', normalized.text.length, 'source:', normalized.source);
    
    const { provider: chosen, creds } = resolveProvider(provider, credentials);
    console.log('[ExtractorUniversal] Using provider:', chosen);
    
    const tools = {
      geocode_address: async ({ address }: { address: string }) => ({ lat: 40.4168, lng: -3.7038, confidence: 0.4, address }),
      address_normalize: async ({ address }: { address: string }) => ({ normalized: (address || '').trim() }),
    };
    
    // Mode controls OCR behavior, useCrewFirst controls schema
    // direct mode = fast, no OCR | agent mode = with OCR and optional function calling
    let parsed: any;
    try {
      parsed = mode === 'agent'
        ? await agenticParse(normalized.text, tools, chosen, creds, useCrewFirst)
        : await directParse(normalized.text, chosen, creds, useCrewFirst);
    } catch (err) {
      // Do NOT fallback to Gemini when OpenRouter is selected or configured.
      // Surface the OpenRouter error to the UI so the user can fix API key/model/network issues.
      console.error('[ExtractorUniversal] OpenRouter (or chosen provider) failed:', (err as Error)?.message || err);
      throw err;
    }
    
    console.log('[ExtractorUniversal] Parsed result:', parsed);
    
    if (!isCallsheetExtraction(parsed)) {
      console.error('[ExtractorUniversal] Invalid extraction format:', parsed);
      throw new ExtractorError('ai_invalid_json', 'The AI did not return a valid JSON.');
    }
    
    const processed = postProcessCrewFirstData(parsed, normalized.text);
    console.log('[ExtractorUniversal] Post-processed result:', processed);
    
    return processed;
  } catch (error) {
    console.error('[ExtractorUniversal] Extraction failed:', error);
    throw error;
  }
}

export { ExtractorError };
