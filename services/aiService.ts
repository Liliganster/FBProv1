

import { SpecialOrigin, UserProfile, Trip, AiModelInfo, DocumentType } from '../types';
import { formatDateForStorage } from '../i18n/translations';
import { calculateDistance, getCountryCode } from './googleMapsService';
import { extractUniversalStructured, type ExtractMode } from './extractor-universal/index';


declare const pdfjsLib: any;

export interface ExtractedTripData {
  date: string;
  locations: string[];
  projectName: string;
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

const DATE_AGENT_SYSTEM_PROMPT = `You are a specialized multilingual date extraction agent. Your SOLE purpose is to identify and extract the single, primary date of the shooting day from the provided content and return it in a standardized YYYY-MM-DD format.

**Rules:**
1.  **INPUT:** You will receive text or an image from the top part of a film callsheet.
2.  **LANGUAGES:** The text can be in Spanish, English, or German.
3.  **PRIORITY:** Your main goal is to find the single, primary date of the shooting day, often clearly displayed in the header next to keywords like "Drehtag", a day of the week (e.g., "Montag", "Mittwoch"), or "CALL SHEET".
4.  **FORMATS:** Dates can appear in numerous formats.
5.  **RELATIVE:** Use today's date, ${referenceDate}, as a reference if no other date is present (e.g., "yesterday", "tomorrow").
6.  **NORMALIZATION:** The extracted date MUST be converted to the \`YYYY-MM-DD\` format.
7.  **OUTPUT:** Your output MUST be a valid JSON object with a single key "date". The value should be the normalized date string. Example: \`{"date": "2024-05-06"}\`.
8.  **NO DATE:** If no definitive shooting day date is found, you MUST return \`{"date": ""}\`.
9.  **NO EXPLANATIONS:** Do NOT provide any text, explanation, or conversational filler. Your entire response must be ONLY the JSON object.`;

const PROJECT_AGENT_SYSTEM_PROMPT = `You are an expert document analyst specializing in film and television production callsheets. Your primary mission is to accurately identify and extract the main **Project Name** from the top half of the first page of a given document.

**Critical Rules:**
1.  **LOCATION:** You MUST confine your search to the **top 50% of the first page** of the text provided.
2.  **OUTPUT FORMAT:** Your response MUST be a valid JSON object with a single key: \`projectName\`. The value will be the extracted string or \`null\` if no suitable name is found. Example: \`{ "projectName": "Nombre del Proyecto" }\`.
3.  **NO EXPLANATIONS:** Do NOT provide any text or explanation outside of the final JSON object.
4.  **PRIORITIZE:** Look for text that is stylistically emphasized (e.g., large font, bold, centered, all-caps) and near keywords like "Project:", "Production:", "Show:", "Produktion:", "Proyecto:".
5.  **IGNORE Production Company Names:** You MUST distinguish the creative project title from the legal production company. Company names often include legal suffixes or keywords to IGNORE: "GmbH", "LLC", "Ltd.", "Inc.", "Film", "Pictures", "Entertainment", "Produktion", "Producciones". (e.g., If you see "Mega-Film GmbH" and "Alpenkrimi", the project name is "Alpenkrimi").
6.  **IGNORE Episode Titles/Numbers:** If the document is for a TV series, extract the main series name, NOT the episode title.
7.  **IGNORE Generic Document Titles:** The project name is never the document type itself (e.g., "CALLSHEET", "DISPOSICIÓN DIARIA").`;

const LOCATION_AGENT_SYSTEM_PROMPT = `You are a precision data extraction engine for film production call sheets, with expert knowledge of Austrian and Viennese addresses. Your ONLY task is to meticulously analyze the provided content and return a single, valid JSON object containing a list of **clean, formatted, physical shooting locations**.

**Primary Goal:** Create a list of PHYSICAL SHOOTING LOCATIONS ONLY.

**Output Format (Strictly Enforced):**
Your entire response must be ONLY a single JSON object with a "locations" key containing an array of strings.

**Address Cleaning & Filtering Rules (CRITICAL):**
1.  **Identify Shooting Locations:** An address is ONLY valid if it is clearly and directly associated with a high-priority filming keyword: "LOCATION 1", "LOCATION 2", "SET = Location", "Motiv", "Set", "Location", "Locations:", "Loc 1/2/...".
2.  **Exclusion Filter:** You MUST IGNORE any address associated with logistical categories: "Basis & Parken", "Aufenthalt", "Kostüm & Maske", "Lunch", "Catering", "Team", "Technik", "Office", "Meeting point", "Transport", "Pick Up", "Driver / Car".
3.  **Clean & Format Addresses:**
    *   **Vienna District Prefix Rule:** If a location part starts with a number and a dot (e.g., '2.', '13.'), convert this to the correct 4-digit postal code (e.g., '1020', '1130'). Example: '2., Rustenschacherallee 9' MUST become 'Rustenschacherallee 9, 1020 Wien'.
    *   **Association Rule:** If a line contains both a place name (like "WAC Prater") and a full physical address (like "2., Rustenschacherallee 9"), your final output MUST be ONLY the processed physical address.
    *   **Deduplication:** The final "locations" array must NOT contain duplicate addresses.
4. **Self-Correction:** Review your output to ensure it is a single valid JSON object and all rules have been followed.`;

const LOCATION_AGENT_SYSTEM_PROMPT_EMAIL = `You are a data extraction engine specialized in analyzing emails and unstructured text to identify a sequence of physical locations for a trip. Your ONLY task is to return a single, valid JSON object containing a list of **clean, formatted, physical addresses** that represent the main journey.

**Primary Goal:** Extract the main sequence of travel locations from the text.

**Output Format (Strictly Enforced):**
Your entire response must be ONLY a single JSON object with a "locations" key containing an array of strings.

**Address Cleaning & Filtering Rules (CRITICAL):**
1.  **Identify Travel Locations:** Look for sequences of addresses in a list or paragraph describing a route.
2.  **Exclusion Filter:** IGNORE addresses associated with logistics ("Lunch", "Catering", "Office", "Meeting point") or in email signatures.
3.  **Clean & Format Addresses:**
    *   **Vienna District Prefix Rule:** For Vienna, if a location part starts with a number and a dot (e.g., '2.', '13.'), convert this to the correct 4-digit postal code (e.g., '1020', '1130').
    *   **Association Rule:** If a line contains a place name and a physical address for the same location, output ONLY the processed physical address.
    *   **Deduplication:** The final "locations" array must NOT contain duplicate addresses.`;

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

const fileToBase64 = (file: File): Promise<{ mimeType: string; data: string }> => {
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
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    return pageText.substring(0, Math.floor(pageText.length / 2));
};

async function runOpenRouterAgent(c: { mimeType: string; data: string } | string, s: Partial<UserProfile>, systemPrompt: string, userAction: string, parser: (r: string) => any): Promise<any> {
    if (!s.openRouterApiKey || !s.openRouterModel) throw new Error("OpenRouter API Key or Model is not configured.");
    const content = typeof c === 'string' ? [{ type: "text", text: `${userAction}\n\n**Text:**\n"${c}"` }] : [{ type: "text", text: userAction }, { type: "image_url", image_url: { url: `data:${c.mimeType};base64,${c.data}` } }];
    try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.openRouterApiKey}`, "HTTP-Referer": "http://localhost:3000", "X-Title": "Fahrtenbuch Pro" }, body: JSON.stringify({ model: s.openRouterModel, messages: [{ role: "system", content: systemPrompt }, { role: "user", content }], temperature: 0.1, response_format: { type: "json_object" } }) });
        if (!res.ok) throw new Error(`OpenRouter API Error: ${res.status} ${await res.text()}`);
        const data = await res.json();
        return parser(data.choices[0].message.content);
    } catch (error) {
        console.error("OpenRouter request failed:", error);
        throw new Error("Failed to connect to OpenRouter. Please check your network connection, API key, and browser extensions (like ad-blockers).");
    }
}
const runDateAgentOpenRouter = (c: any, s: any) => runOpenRouterAgent(c, s, DATE_AGENT_SYSTEM_PROMPT, "Extract date.", parseDateAgentResponse);
const runProjectAgentOpenRouter = (c: any, s: any) => runOpenRouterAgent(c, s, PROJECT_AGENT_SYSTEM_PROMPT, "Extract project name.", parseProjectAgentResponse);
const runLocationAgentOpenRouter = (c: any, s: any, docType: DocumentType) => runOpenRouterAgent(c, s, docType === DocumentType.EMAIL ? LOCATION_AGENT_SYSTEM_PROMPT_EMAIL : LOCATION_AGENT_SYSTEM_PROMPT, "Extract locations.", parseLocationAgentResponse);


export async function fetchOpenRouterModels(apiKey: string): Promise<AiModelInfo[]> {
    if (!apiKey) throw new Error("OpenRouter API Key is required.");
    try {
        const res = await fetch("https://openrouter.ai/api/v1/models", { headers: { "Authorization": `Bearer ${apiKey}`, "HTTP-Referer": "http://localhost:3000", "X-Title": "Fahrtenbuch Pro" } });
        if (!res.ok) throw new Error(`Failed to fetch models: ${res.status} - ${(await res.json()).error?.message || 'Unknown error'}`);
        const data = await res.json();
        return data.data
            .map((m: any) => ({ id: m.id, name: m.name || m.id }))
            .sort((a: any, b: any) => a.name.localeCompare(b.name));
    } catch (e) {
        console.error("Error fetching OpenRouter models:", e);
        throw new Error("Failed to connect to OpenRouter. Please check your network connection and API key.");
    }
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
    const locationAgentPromise = runLocationAgentOpenRouter(fullContent, userProfile, documentType);
  
    const [dateResult, projectResult, locationResult] = await Promise.all([dateAgentPromise, projectAgentPromise, locationAgentPromise]);

    const cleanedLocations = userProfile.googleMapsApiKey ? await cleanAndVerifyAddresses(locationResult) : locationResult;

    return {
        date: formatDateForStorage(dateResult),
        projectName: projectResult,
        locations: cleanedLocations,
        reason: projectResult || 'Extracted Trip',
        specialOrigin: SpecialOrigin.HOME,
    };
}

export async function processFileForTrip(file: File, userProfile: UserProfile, documentType: DocumentType): Promise<{ tripData: Omit<Trip, 'id' | 'projectId'>; projectName: string }> {
    const userHomeAddress = (userProfile.address && userProfile.city && userProfile.country) ? `${userProfile.address}, ${userProfile.city}, ${userProfile.country}` : null;
    if (!userHomeAddress) throw new Error("Your home address is not set in your profile.");
  
    const extractedData = await _extractRawTripData(file, userProfile, documentType);
  
    const finalLocations = [userHomeAddress, ...extractedData.locations, userHomeAddress];
  
    let distance = 0;
    if (userProfile.googleMapsApiKey && window.google) {
      try {
        const regionCode = getCountryCode(userProfile?.country);
        const calculatedDist = await calculateDistance(finalLocations, userProfile.googleMapsApiKey, regionCode);
        distance = calculatedDist ?? 0;
      } catch (e) {
        console.warn(`Could not calculate distance for trip. Reason:`, e instanceof Error ? e.message : e);
      }
    }
  
    const tripData: Omit<Trip, 'id' | 'projectId'> = {
      date: extractedData.date || new Date().toISOString().split('T')[0],
      locations: finalLocations,
      distance,
      reason: extractedData.reason || extractedData.projectName || 'Extracted Trip',
      specialOrigin: SpecialOrigin.HOME,
    };
  
    return { tripData, projectName: extractedData.projectName };
}

// New: Universal extractor wrapper using Direct/Agent modes (with OCR in Agent)
export async function processFileForTripUniversal(
  input: { file?: File; text?: string },
  userProfile: UserProfile,
  documentType: DocumentType,
  mode: ExtractMode
): Promise<{ tripData: Omit<Trip, 'id' | 'projectId'>; projectName: string }> {
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
      geminiApiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any)?.GEMINI_API_KEY || null,
      openRouterApiKey: userProfile.openRouterApiKey || (import.meta as any).env?.VITE_OPENROUTER_API_KEY || null,
      openRouterModel: userProfile.openRouterModel || (import.meta as any).env?.VITE_OPENROUTER_MODEL || null,
    },
  });
  const locations = [userHomeAddress, ...extraction.locations, userHomeAddress];

  let distance = 0;
  if (userProfile.googleMapsApiKey && (window as any).google) {
    try {
      const regionCode = getCountryCode(userProfile?.country);
      const calculatedDist = await calculateDistance(locations, userProfile.googleMapsApiKey!, regionCode);
      distance = calculatedDist ?? 0;
    } catch (e) {
      console.warn(`Could not calculate distance for trip. Reason:`, e instanceof Error ? e.message : e);
    }
  }

  const date = extraction.date || new Date().toISOString().split('T')[0];
  const reason = extraction.projectName || 'Extracted Trip';

  const tripData: Omit<Trip, 'id' | 'projectId'> = {
    date,
    locations: locations.length >= 2 ? locations : [userHomeAddress, userHomeAddress],
    distance,
    reason,
    specialOrigin: SpecialOrigin.HOME,
  };

  return { tripData, projectName: extraction.projectName };
}
