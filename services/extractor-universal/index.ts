import { callsheetSchema, type CallsheetExtraction } from './config/schema';
import {
  detectKind,
  getTextFromTextFile,
  getTextFromCsvFile,
  extractTextFromPdfFile,
  extractTextWithOCRFromPdfFile,
  extractTextWithOCRFromImageFile,
  getPdfFirstPageAsImage,
  compressImageFile,
} from './miner';
import { cleanOcrText, normalizeCsvForModel } from './normalize';
import { isCallsheetExtraction } from './verify';
import { postProcessCrewFirstData } from './postProcess';
import { agenticParse, directParse, visionParse } from '../../lib/gemini/parser';
import { parseWithGemini, parseWithOpenRouter } from './providers';
import { geocodeAddressesViaBackend, getCountryCode } from '../googleMapsService';

export type ExtractMode = 'direct' | 'agent' | 'vision';
export type ExtractProvider = 'auto' | 'gemini' | 'openrouter';

export type ExtractInput = {
  text?: string; // pasted text
  file?: File;   // pdf/csv/image/txt
};

export type ExtractGeoBias = {
  city?: string | null;
  country?: string | null;
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

function countryHintFromString(raw: string): string | undefined {
  const map: Record<string, string> = {
    austria: 'AT',
    österreich: 'AT',
    oesterreich: 'AT',
    germany: 'DE',
    deutschland: 'DE',
    spain: 'ES',
    españa: 'ES',
    espana: 'ES',
    france: 'FR',
    italy: 'IT',
    italia: 'IT',
    switzerland: 'CH',
    schweiz: 'CH',
    suisse: 'CH',
    usa: 'US',
    'united states': 'US',
    uk: 'GB',
    'united kingdom': 'GB',
    portugal: 'PT',
    netherlands: 'NL',
    holland: 'NL',
  };
  const lower = raw.toLowerCase();
  for (const [name, code] of Object.entries(map)) {
    if (lower.includes(name)) return code;
  }
  const codeMatch = raw.match(/\b([A-Z]{2})\b/);
  if (codeMatch) return codeMatch[1];
  return undefined;
}

function appendBiasIfIncomplete(address: string, bias?: ExtractGeoBias): string {
  const raw = (address || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  const hasComma = raw.includes(',');
  const hasCity = bias?.city ? lower.includes(String(bias.city).toLowerCase()) : false;
  const hasCountry = bias?.country ? lower.includes(String(bias.country).toLowerCase()) : false;

  const biasCode = bias?.country ? (getCountryCode(bias.country) || bias.country).toUpperCase() : undefined;
  const countryHint = countryHintFromString(raw);
  if (countryHint && biasCode && countryHint !== biasCode) {
    // Already hints another country; do not force bias
    return raw;
  }

  if (bias?.city && bias?.country && (!hasComma || !hasCity || !hasCountry)) {
    return `${raw}, ${bias.city}, ${bias.country}`;
  }
  return raw;
}

async function normalizeExtractedAddresses(
  locations: string[],
  bias?: ExtractGeoBias
): Promise<string[]> {
  const cleaned = (Array.isArray(locations) ? locations : []).map((loc) => (loc || '').trim()).filter(Boolean);
  if (cleaned.length === 0) return [];

  const prepared = cleaned.map((loc) => appendBiasIfIncomplete(loc, bias));
  const region = bias?.country ? (getCountryCode(bias.country) || bias.country) : undefined;

  try {
    const geocoded = await geocodeAddressesViaBackend(prepared, region);
    return geocoded.map((result, idx) => {
      const formatted = result?.formatted_address;
      return formatted && formatted.trim() ? formatted.trim() : prepared[idx];
    });
  } catch (error) {
    console.warn('[ExtractorUniversal] Address normalization failed, using originals:', error);
    return prepared;
  }
}

export type ProviderCredentials = {
  openRouterApiKey?: string | null;
  openRouterModel?: string | null;
};

async function normalizeVision(input: ExtractInput): Promise<{ text: string; image?: string; source: string }> {
  const file = input.file;
  if (!file) throw new ExtractorError('no_input', 'Vision mode requires a file.');

  const kind = detectKind(file);
  let text = '';
  let image = '';

  if (kind === 'pdf') {
    // 1. Get First Page Image (High Quality)
    try {
      image = await getPdfFirstPageAsImage(file);
      // Remove data:image/jpeg;base64, prefix if present
      image = image.split(',')[1] || image;
    } catch (e) {
      console.error('Vision PDF Render failed:', e);
      throw new ExtractorError('pdf_parse_error', 'Could not render PDF for Vision.');
    }

    // 2. Get Text Context (Best Effort with OCR Fallback)
    try {
      text = await extractTextFromPdfFile(file);
    } catch (e) {
      console.warn('Vision PDF Text extraction failed, attempting OCR to improve context:', e);
      try {
        // "Use OCR to see better": If text layer is missing, force OCR so Vision has text context
        text = await extractTextWithOCRFromPdfFile(file);
      } catch (ocrError) {
        console.warn('Vision PDF OCR extraction also failed (using image only):', ocrError);
      }
    }
    return { text, image, source: 'pdf_vision' };
  }

  if (kind === 'image') {
    // Resize & Compress Image to ensure payload is small
    const dataUrl = await compressImageFile(file);
    image = dataUrl.split(',')[1] || dataUrl;
    return { text: '', image, source: 'image_vision' };
  }

  throw new ExtractorError('no_input', 'Vision mode only supports PDF and Images.');
}

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

  // Casos explícitos: el usuario eligió específicamente un proveedor
  if (provider === 'gemini') return { provider: 'gemini', creds: c };
  if (provider === 'openrouter') return { provider: 'openrouter', creds: c };

  // Caso 'auto': Preferir OpenRouter si el usuario lo ha configurado
  if (c.openRouterApiKey && c.openRouterModel) {
    return { provider: 'openrouter', creds: c };
  }

  // Fallback a Gemini si no hay OpenRouter configurado
  // Gemini es gratis para el usuario (usa API key del servidor)
  console.log('[ExtractorUniversal] Auto-selecting Gemini (default/fallback)');
  return { provider: 'gemini', creds: c };
}

export async function extractUniversalStructured({
  mode,
  input,
  provider = 'auto',
  credentials,
  useCrewFirst = false, // Use simple schema by default
  contentType = 'callsheet', // 'callsheet' | 'email'
  geocodeBias,
}: {
  mode: ExtractMode;
  input: ExtractInput;
  provider?: ExtractProvider;
  credentials?: ProviderCredentials;
  useCrewFirst?: boolean; // Optional parameter to use CrewFirst schema
  contentType?: 'callsheet' | 'email';
  geocodeBias?: ExtractGeoBias;
}): Promise<CallsheetExtraction> {
  console.log('[ExtractorUniversal] Starting extraction:', { mode, provider, useCrewFirst, contentType, hasFile: !!input.file, hasText: !!input.text });

  // Get filename if available for fallback inference
  const fileName = input.file?.name || '';
  console.log('[ExtractorUniversal] Filename:', fileName || 'N/A');

  try {
    let normalized: { text: string; image?: string; source: string };

    if (mode === 'vision') {
      normalized = await normalizeVision(input);
    } else {
      normalized = mode === 'direct' ? await normalizeDirect(input) : await normalizeAgent(input);
    }

    console.log('[ExtractorUniversal] Normalized: len=', normalized.text.length, 'src=', normalized.source, 'img=', !!normalized.image);

    const { provider: chosen, creds } = resolveProvider(provider, credentials);
    console.log('[ExtractorUniversal] Using provider:', chosen);

    // Optional hint to the model depending on content type
    const textForModel =
      contentType === 'email'
        ? `[CONTEXT: The following text is an email or short message that may contain filming addresses. Extract date, project name, production companies and ONLY filming locations (not parking/catering).]\n\n${normalized.text}`
        : normalized.text;

    const tools = {
      geocode_address: async ({ address }: { address: string }) => ({ lat: 40.4168, lng: -3.7038, confidence: 0.4, address }),
      address_normalize: async ({ address }: { address: string }) => ({ normalized: (address || '').trim() }),
    };

    // Mode controls OCR behavior, useCrewFirst controls schema
    // direct mode = fast, no OCR | agent mode = with OCR and optional function calling
    let parsed: any;
    try {
      if (mode === 'vision') {
        // HYBRID MODE: Run Text Agent FIRST to get high-accuracy text extraction
        let preliminaryData = null;
        try {
          console.log('[ExtractorUniversal] Running Hybrid Pre-pass (OCR Agent)...');
          // Use directParse (or agenticParse) to get valid candidates
          preliminaryData = await directParse(textForModel, chosen, creds, useCrewFirst);
          console.log('[ExtractorUniversal] Hybrid Pre-pass success:', preliminaryData);
        } catch (e) {
          console.warn('[ExtractorUniversal] Hybrid Pre-pass failed, proceeding with raw vision:', e);
        }

        const visionContext = preliminaryData
          ? `PRELIMINARY_DATA_JSON:\n${JSON.stringify(preliminaryData, null, 2)}\n\nRAW_OCR_TEXT:\n${textForModel}`
          : textForModel;

        // Vision is exclusively Gemini for now
        parsed = await visionParse(visionContext, normalized.image || '', useCrewFirst);
      } else {
        parsed = mode === 'agent'
          ? await agenticParse(textForModel, tools, chosen, creds, useCrewFirst)
          : await directParse(textForModel, chosen, creds, useCrewFirst);
      }
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

    // Add warning if projectName is empty or just whitespace
    if (!parsed.projectName || !parsed.projectName.trim()) {
      console.warn('[ExtractorUniversal] ⚠️ WARNING: AI returned empty projectName!', {
        rawProjectName: parsed.projectName,
        productionCompanies: parsed.productionCompanies,
        date: parsed.date,
        locationsCount: parsed.locations?.length,
        fileName
      });
    } else {
      console.log('[ExtractorUniversal] ✓ Extracted projectName:', parsed.projectName);
    }

    const processed = postProcessCrewFirstData(parsed, normalized.text, fileName);
    console.log('[ExtractorUniversal] Post-processed result:', processed);

    const normalizedLocations = await normalizeExtractedAddresses(processed.locations, geocodeBias);
    const finalResult: CallsheetExtraction = {
      ...processed,
      locations: normalizedLocations,
    };

    return finalResult;
  } catch (error) {
    console.error('[ExtractorUniversal] Extraction failed:', error);
    throw error;
  }
}

export { ExtractorError };
