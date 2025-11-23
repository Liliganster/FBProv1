

import { SpecialOrigin, UserProfile, Trip, AiModelInfo, DocumentType } from '../types';
import { formatDateForStorage } from '../i18n/translations';
import { calculateDistanceViaBackend, getCountryCode } from './googleMapsService';
import { extractUniversalStructured, type ExtractMode } from './extractor-universal/index';
import { fetchWithRateLimit, withRateLimitHandling } from '../lib/rate-limit-client';


declare const pdfjsLib: any;

export interface ExtractedTripData {
  date: string;
  locations: string[];
  projectName: string;
  productionCompany: string;
  reason: string;
  specialOrigin: SpecialOrigin;
}

export interface AiModel {
  id: string;
  name: string;
}

async function cleanAndVerifyAddresses(locations: string[]): Promise<string[]> {
  if (locations.length === 0) {
    return locations;
  }
  if (!window.google || !window.google.maps || !window.google.maps.places) {
    console.warn("Google Maps Places library is not loaded. Returning original addresses.");
    return locations;
  }

  const placesService = new window.google.maps.places.PlacesService(document.createElement('div'));

  const cleanedLocationsPromises = locations.map((location) => {
    return new Promise<string | null>((resolve) => {
      if (!location || !location.trim()) {
        resolve(null);
        return;
      }
      placesService.findPlaceFromQuery({ query: location, fields: ['formatted_address', 'name'] }, (results: any, status: any) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0 && results[0].formatted_address) {
          resolve(results[0].formatted_address);
        } else {
          if (status !== window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
             console.warn(`Could not verify address "${location}". Reason: ${status}`);
          }
          resolve(location);
        }
      });
    });
  });

  const resolvedLocations = await Promise.all(cleanedLocationsPromises);
  return resolvedLocations.filter((loc): loc is string => loc !== null);
}

const today = new Date();
const referenceDate = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

import { DATE_AGENT_SYSTEM_PROMPT, PROJECT_AGENT_SYSTEM_PROMPT, LOCATION_AGENT_SYSTEM_PROMPT, LOCATION_AGENT_SYSTEM_PROMPT_EMAIL, PRODUCTION_COMPANY_AGENT_SYSTEM_PROMPT } from './extractor-universal/prompts/prompts';

const robustJsonParse = (jsonString: string, agentName: string): any | null => {
    let text = jsonString.trim();
    const jsonStartIndex = text.indexOf('{');
    const jsonEndIndex = text.lastIndexOf('}');
    if (jsonStartIndex === -1 || jsonEndIndex === -1 || jsonEndIndex < jsonStartIndex) return null;
    const potentialJson = text.substring(jsonStartIndex, jsonEndIndex + 1);
    try {
        return JSON.parse(potentialJson);
    } catch (error) {
        console.error(`Failed to parse extracted JSON from ${agentName}:`, { original: jsonString, extracted: potentialJson }, error);
        return null;
    }
}

const parseDateAgentResponse = (jsonString: string): string => {
    const data = robustJsonParse(jsonString, 'Date Agent');
    return (data && typeof data.date === 'string') ? data.date : '';
};

const parseProjectAgentResponse = (jsonString: string): string => {
    const data = robustJsonParse(jsonString, 'Project Agent');
    return (data && typeof data.projectName === 'string') ? data.projectName : '';
};

const parseLocationAgentResponse = (jsonString: string): string[] => {
    const data = robustJsonParse(jsonString, 'Location Agent');
    return (data && Array.isArray(data.locations)) ? data.locations.filter((loc: any) => typeof loc === 'string' && loc.trim() !== '') : [];
};

const parseProductionCompanyAgentResponse = (jsonString: string): string => {
    const data = robustJsonParse(jsonString, 'Production Company Agent');
    return (data && typeof data.productionCompany === 'string') ? data.productionCompany : '';
};const fileToBase64 = (file: File): Promise<{ mimeType: string; data: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const [header, data] = result.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || file.type;
      resolve({ mimeType, data });
    };
    reader.onerror = (error) => reject(error);
  });
};

const cropImageAndGetBase64 = (file: File): Promise<{ mimeType: string; data: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height / 2;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Could not get canvas context'));
                ctx.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL(file.type);
                const [, data] = dataUrl.split(',');
                resolve({ mimeType: file.type, data });
            };
            img.onerror = reject;
            img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const extractTextFromPdf = async (file: File): Promise<string> => {
    const { pdfjsLib } = (window as any);
    if (!pdfjsLib) throw new Error("pdf.js library is not loaded.");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n\n';
    }
    return fullText;
};

const extractFirstPageHalfTextFromPdf = async (file: File): Promise<string> => {
    const { pdfjsLib } = (window as any);
    if (!pdfjsLib) throw new Error("pdf.js library is not loaded.");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    if (pdf.numPages === 0) return '';
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: any[] = Array.isArray((content as any)?.items) ? (content as any).items : [];

    // Prefer true top-half by y-coordinate when available; otherwise fall back to length split
    const halfY = viewport?.height ? viewport.height / 2 : null;
    let topText = '';
    if (halfY != null && items.length > 0 && items.every(it => Array.isArray(it.transform))) {
        const topItems = items.filter(it => {
            try {
                const y = Array.isArray(it.transform) && it.transform.length >= 6 ? it.transform[5] : null;
                return typeof y === 'number' ? y >= halfY : true;
            } catch { return true; }
        });
        topText = topItems.map(it => String(it.str || '').trim()).filter(Boolean).join(' ');
    }
    if (!topText) {
        const pageText = items.map((item: any) => item.str).join(' ');
        topText = pageText.substring(0, Math.floor(pageText.length / 2));
    }
    return topText.trim();
};

async function runOpenRouterAgent(
    contentSource: { mimeType: string; data: string } | string,
    profile: Partial<UserProfile>,
    systemPrompt: string,
    userAction: string,
    parser: (response: string) => any
): Promise<any> {
    // Build messages for OpenRouter chat API
    const userMessage = typeof contentSource === 'string'
        ? `${userAction}\n\n**Text:**\n"${contentSource}"`
        : userAction; // For images, we'll handle differently

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
    ];

    const model = profile.openRouterModel;
    if (!model) throw new Error("OpenRouter model is not configured. Please select a model in Settings.");

    try {
        // Use unified proxy route, always passing the user's apiKey when present
        const res = await fetchWithRateLimit("/api/ai/openrouter/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                apiKey: profile.openRouterApiKey || undefined,
                model,
                messages,
                temperature: 0.1,
                max_tokens: 2048,
            }),
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`OpenRouter Proxy Error: ${res.status} ${errorText}`);
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw new Error("OpenRouter response is missing content.");
        return parser(content);
    } catch (error) {
        console.error("OpenRouter request failed:", error);
        if (error instanceof Error && error.message.includes('rate limit')) throw error;
        throw new Error("Failed to connect to OpenRouter. Please check your network connection, API key, and browser extensions (like ad-blockers).");
    }
}
const runDateAgentOpenRouter = (c: any, s: any) => runOpenRouterAgent(c, s, DATE_AGENT_SYSTEM_PROMPT, "Extract date.", parseDateAgentResponse);
const runProjectAgentOpenRouter = (c: any, s: any) => runOpenRouterAgent(c, s, PROJECT_AGENT_SYSTEM_PROMPT, "Extract project name.", parseProjectAgentResponse);
const runLocationAgentOpenRouter = (c: any, s: any, docType: DocumentType) => runOpenRouterAgent(c, s, docType === DocumentType.EMAIL ? LOCATION_AGENT_SYSTEM_PROMPT_EMAIL : LOCATION_AGENT_SYSTEM_PROMPT, "Extract locations.", parseLocationAgentResponse);
const runProductionCompanyAgentOpenRouter = (c: any, s: any) => runOpenRouterAgent(c, s, PRODUCTION_COMPANY_AGENT_SYSTEM_PROMPT, "Extract production company.", parseProductionCompanyAgentResponse);


export async function fetchOpenRouterModels(apiKey?: string | null): Promise<AiModelInfo[]> {
    return withRateLimitHandling(async () => {
        try {
            // Unified proxy route: use GET with optional apiKey
            const qs = apiKey ? `?apiKey=${encodeURIComponent(apiKey)}` : '';
            const res = await fetchWithRateLimit(`/api/ai/openrouter/models${qs}`, { method: 'GET' });

            if (!res.ok) {
                throw new Error(`Failed to fetch models: ${res.status} ${await res.text()}`);
            }

            const data = await res.json();
            const models = Array.isArray(data?.models)
                ? data.models
                : Array.isArray(data?.data)
                    ? data.data
                    : [];
            return models
                .map((m: any) => ({ id: m.id, name: m.name || m.id }))
                .sort((a: AiModelInfo, b: AiModelInfo) => (a.name || '').localeCompare(b.name || ''));
        } catch (e) {
            console.error("Error fetching OpenRouter models:", e);
            throw new Error("Failed to connect to OpenRouter. Please check your network connection and API key.");
        }
    }, 'fetchOpenRouterModels');
}

async function _extractRawTripData(file: File, userProfile: UserProfile, documentType: DocumentType): Promise<ExtractedTripData> {
    if (!userProfile.openRouterApiKey || !userProfile.openRouterModel) {
        throw new Error("OpenRouter has not been configured. Please add your API key and select a model in the Settings page.");
    }
    
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isTextFile = file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.eml');

    if (!isImage && !isPdf && !isTextFile) {
        throw new Error("Only image, PDF, TXT or EML files can be processed.");
    }
  
    let fullContentPromise, croppedContentPromise;
    if (isImage) {
        fullContentPromise = fileToBase64(file);
        croppedContentPromise = cropImageAndGetBase64(file);
    } else if (isPdf) {
        fullContentPromise = extractTextFromPdf(file);
        croppedContentPromise = extractFirstPageHalfTextFromPdf(file);
    } else {
        const textPromise = file.text();
        fullContentPromise = textPromise;
        croppedContentPromise = textPromise.then(text => text.substring(0, Math.floor(text.length / 2)));
    }
  
    const [fullContent, croppedContent] = await Promise.all([fullContentPromise, croppedContentPromise]);

    const dateAgentPromise = runDateAgentOpenRouter(croppedContent, userProfile);
    const projectAgentPromise = runProjectAgentOpenRouter(croppedContent, userProfile);
    const productionCompanyAgentPromise = runProductionCompanyAgentOpenRouter(croppedContent, userProfile);
    const locationAgentPromise = runLocationAgentOpenRouter(fullContent, userProfile, documentType);
  
    const [dateResult, projectResult, productionCompanyResult, locationResult] = await Promise.all([dateAgentPromise, projectAgentPromise, productionCompanyAgentPromise, locationAgentPromise]);

    const cleanedLocations = await cleanAndVerifyAddresses(locationResult);

    return {
        date: formatDateForStorage(dateResult),
        projectName: projectResult,
        productionCompany: productionCompanyResult,
        locations: cleanedLocations,
        reason: projectResult || 'Extracted Trip',
        specialOrigin: SpecialOrigin.HOME,
    };
}

export async function processFileForTrip(file: File, userProfile: UserProfile, documentType: DocumentType): Promise<{ tripData: Omit<Trip, 'id' | 'projectId'>; projectName: string, productionCompany: string }> {
  // Use the new universal extraction system with auto provider selection
  return processFileForTripUniversal(
    { file },
    userProfile,
    documentType,
    'direct' // Use direct mode for file uploads from projects
  );
}

export async function processFileForTripUniversal(
  input: { file?: File; text?: string },
  userProfile: UserProfile,
  documentType: DocumentType,
  mode: ExtractMode
): Promise<{ tripData: Omit<Trip, 'id' | 'projectId'>; projectName: string, productionCompany: string }> {
  const userHomeAddress = (userProfile.address && userProfile.city && userProfile.country)
    ? `${userProfile.address}, ${userProfile.city}, ${userProfile.country}`
    : null;
  if (!userHomeAddress) throw new Error("Your home address is not set in your profile.");

  // Extract using the new universal pipeline (Gemini + optional OCR)
  const extraction = await extractUniversalStructured({
    mode,
    input: { file: input.file, text: input.text },
    provider: 'auto',
    credentials: {
      openRouterApiKey: userProfile.openRouterApiKey || null,
      openRouterModel: userProfile.openRouterModel || null,
    },
  });
  const locations = [userHomeAddress, ...extraction.locations, userHomeAddress];

  let distance = 0;
  try {
    const regionCode = getCountryCode(userProfile?.country);
    const calculatedDist = await calculateDistanceViaBackend(locations, regionCode);
    distance = calculatedDist ?? 0;
  } catch (e) {
    console.warn(`Could not calculate distance for trip. Reason:`, e instanceof Error ? e.message : e);
  }

  const date = extraction.date || new Date().toISOString().split('T')[0];
  const reason = 'Trabajo';

  const tripData: Omit<Trip, 'id' | 'projectId'> = {
    date,
    locations: locations.length >= 2 ? locations : [userHomeAddress, userHomeAddress],
    distance,
    reason,
    specialOrigin: SpecialOrigin.HOME,
  };

  // Join multiple production companies with comma separator
  // Examples: "Netflix" or "Netflix, Studio Babelsberg, ARD Degeto"
  const productionCompany = Array.isArray(extraction.productionCompanies) 
    ? extraction.productionCompanies.filter(Boolean).join(', ')
    : 'Unknown';
  
  // Derive a project name without using a generic "Untitled" fallback.
  const cleanGenericTokens = (s: string) => s
    .replace(/[_-]+/g, ' ')
    .replace(/\b(call\s*sheet|callsheet|tagesdisposition|disposici[oó]n\s*diaria|drehtag|shooting\s*day|version|versi[oó]n|final|rev(ision)?|v\d+)\b/gi, ' ')
    .replace(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const looksLikeCompany = (s: string) => /\b(gmbh|llc|ltd\.?|inc\.?|kg|og|s\.l\.|s\.a\.|film(produktion)?|pictures|entertainment|studios?)\b/i.test(s);

  const getNameFromFile = (file?: File): string => {
    if (!file?.name) return '';
    const base = file.name.replace(/\.[^.]+$/, '');
    const cleaned = cleanGenericTokens(base);
    // Prefer the first tokenized chunk that doesn't look like a company name
    const candidates = cleaned.split(/\s{2,}|\s-\s|\s\|\s|\s{1}/).filter(Boolean);
    const picked = candidates.find(c => !looksLikeCompany(c) && /[A-Za-zÁÉÍÓÚÜÑäöüÄÖÜß]/.test(c)) || cleaned;
    return picked.trim();
  };

  const getNameFromText = (text?: string): string => {
    if (!text) return '';
    const head = text.split(/\r?\n/).slice(0, 40);
    const blacklist = /(call\s*sheet|callsheet|tagesdisposition|disposici[oó]n\s*diaria|drehtag|shooting\s*day|production\s*company|produktion|productora|producci[oó]n)/i;
    let best = '';
    for (const line of head) {
      const cleaned = cleanGenericTokens(line);
      if (!cleaned) continue;
      if (blacklist.test(cleaned)) continue;
      if (looksLikeCompany(cleaned)) continue;
      if (cleaned.length >= 2 && cleaned.length <= 60) {
        // Prefer lines with multiple words or Title/ALLCAPS patterns
        const score = (cleaned.split(/\s+/).length >= 2 ? 2 : 1) + (/[A-Z]{3,}/.test(cleaned) ? 1 : 0);
        if (score >= 2) {
          best = cleaned;
          break;
        }
        if (!best) best = cleaned;
      }
    }
    return best;
  };

  let projectName = (extraction.projectName || '').trim();
  const containsProducerKeyword = /\b(produktion|production|productora|producer|producers)\b/i.test(projectName);
  if (!projectName || looksLikeCompany(projectName) || containsProducerKeyword) {
    // Try stronger derivations, especially for OCR/agent mode
    const derived = getNameFromFile(input.file) || getNameFromText(input.text) || '';
    if (derived && !looksLikeCompany(derived)) {
      projectName = derived;
    }
  }
  // Final guard: if still empty, keep it empty; UI will handle fallback, but we never use "Untitled" here.
  
  return { tripData, projectName, productionCompany };
}
