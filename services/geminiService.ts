/**
 * Gemini AI Service
 * Client-side utilities for interacting with Gemini AI backend endpoints
 */

import { Trip } from '../types';

export interface GeminiExtractionRequest {
  text: string;
  mode?: 'direct' | 'agent';
  useCrewFirst?: boolean;
}

export interface GeminiExtractionResponse {
  date?: string;
  locations?: string[];
  projectName?: string;
  reason?: string;
  distance?: number;
  callNumber?: string;
  productionName?: string;
  shootLocation?: string;
  crewMember?: string;
}

/**
 * Extracts trip data from text using Gemini AI backend
 * @param request - The extraction request parameters
 * @returns Extracted trip data
 */
export async function extractTripDataWithGemini(
  request: GeminiExtractionRequest
): Promise<GeminiExtractionResponse> {
  const response = await fetch('/api/ai/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Gemini API error: ${response.status}`);
  }

  return await response.json();
}

/**
 * Checks if Gemini API is configured and available
 * @returns true if Gemini is available
 */
export async function isGeminiAvailable(): Promise<boolean> {
  try {
    const response = await fetch('/api/ai/status');
    if (!response.ok) return false;
    
    const data = await response.json();
    return data?.gemini === true;
  } catch {
    return false;
  }
}

/**
 * Validates extracted trip data
 * @param data - The extracted data to validate
 * @returns true if data is valid
 */
export function isValidExtractedTripData(data: any): data is GeminiExtractionResponse {
  if (!data || typeof data !== 'object') return false;
  
  // At minimum, we need either locations or a production name
  const hasLocations = Array.isArray(data.locations) && data.locations.length > 0;
  const hasProductionInfo = typeof data.productionName === 'string' || typeof data.shootLocation === 'string';
  
  return hasLocations || hasProductionInfo;
}

/**
 * Converts Gemini extraction response to Trip format
 * @param extraction - The Gemini extraction response
 * @param defaultValues - Default values to use if extraction is incomplete
 * @returns Partial trip object
 */
export function geminiExtractionToTrip(
  extraction: GeminiExtractionResponse,
  defaultValues?: Partial<Trip>
): Partial<Trip> {
  const trip: Partial<Trip> = {
    ...defaultValues,
  };

  // Set date if available
  if (extraction.date) {
    trip.date = extraction.date;
  }

  // Set locations if available
  if (extraction.locations && extraction.locations.length > 0) {
    trip.locations = extraction.locations;
  }

  // Set reason - combine production info if it's a crew first extraction
  if (extraction.reason) {
    trip.reason = extraction.reason;
  } else if (extraction.productionName || extraction.callNumber) {
    const parts = [];
    if (extraction.productionName) parts.push(extraction.productionName);
    if (extraction.callNumber) parts.push(`Call ${extraction.callNumber}`);
    trip.reason = parts.join(' - ');
  }

  // Set distance if available
  if (extraction.distance) {
    trip.distance = extraction.distance;
  }

  return trip;
}

/**
 * Sanitizes text before sending to Gemini
 * @param text - The text to sanitize
 * @returns Sanitized text
 */
export function sanitizeTextForGemini(text: string): string {
  if (!text) return '';
  
  // Remove excessive whitespace
  let sanitized = text.trim().replace(/\s+/g, ' ');
  
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  
  // Limit length to avoid token limits
  const MAX_LENGTH = 10000;
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH) + '...';
  }
  
  return sanitized;
}

/**
 * Extracts text from different file types for Gemini processing
 * @param file - The file to extract text from
 * @returns Extracted text
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const fileType = file.type;
  
  // Handle text files
  if (fileType.startsWith('text/')) {
    return await file.text();
  }
  
  // Handle image files - would need OCR integration
  if (fileType.startsWith('image/')) {
    // This would need Tesseract.js or similar OCR library
    throw new Error('Image OCR extraction not yet implemented in geminiService');
  }
  
  // Handle PDF files
  if (fileType === 'application/pdf') {
    // This would need PDF.js integration
    throw new Error('PDF text extraction not yet implemented in geminiService');
  }
  
  throw new Error(`Unsupported file type: ${fileType}`);
}

/**
 * Formats Gemini error messages for user display
 * @param error - The error object
 * @returns User-friendly error message
 */
export function formatGeminiError(error: any): string {
  if (error?.message) {
    // Check for common error patterns
    if (error.message.includes('API key')) {
      return 'Gemini API is not configured. Please contact your administrator.';
    }
    if (error.message.includes('quota')) {
      return 'AI extraction quota exceeded. Please try again later.';
    }
    if (error.message.includes('rate limit')) {
      return 'Too many AI requests. Please wait a moment and try again.';
    }
    return error.message;
  }
  
  return 'An unexpected error occurred with AI extraction.';
}

/**
 * Retries a Gemini extraction request with exponential backoff
 * @param request - The extraction request
 * @param maxRetries - Maximum number of retries
 * @returns Extracted data
 */
export async function extractWithRetry(
  request: GeminiExtractionRequest,
  maxRetries: number = 3
): Promise<GeminiExtractionResponse> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await extractTripDataWithGemini(request);
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (error instanceof Error) {
        if (error.message.includes('API key') || error.message.includes('quota')) {
          throw error;
        }
      }
      
      // Wait before retrying with exponential backoff
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Extraction failed after retries');
}
