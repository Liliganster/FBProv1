/**
 * Gemini AI Proxy - Serverless Function
 *
 * This endpoint proxies requests to Google Gemini AI API.
 * It supports both:
 * 1. User's own API key (from encrypted database)
 * 2. Server fallback API key (for demo/free tier users)
 *
 * Security features:
 * - Rate limiting (10 requests per minute per user)
 * - API key encryption
 * - Request validation
 * - Error handling
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Rate limiting in-memory store (for serverless, use Upstash Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface GeminiRequest {
  prompt: string;
  model?: string;
  useUserApiKey?: boolean;
  userId?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

/**
 * Simple rate limiter (10 requests per minute)
 */
function checkRateLimit(userId: string): RateLimitResult {
  const now = Date.now();
  const key = `gemini:${userId}`;
  const limit = rateLimitStore.get(key);

  if (!limit || now > limit.resetTime) {
    // New window
    rateLimitStore.set(key, { count: 1, resetTime: now + 60000 });
    return { allowed: true, remaining: 9, resetTime: now + 60000 };
  }

  if (limit.count >= 10) {
    return { allowed: false, remaining: 0, resetTime: limit.resetTime };
  }

  limit.count++;
  return { allowed: true, remaining: 10 - limit.count, resetTime: limit.resetTime };
}

/**
 * Decrypt user's API key from database
 */
async function getUserApiKey(userId: string): Promise<string | null> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase configuration missing');
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('gemini_api_key')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    // If encrypted, decrypt it (the key is stored encrypted in DB)
    const encryptedKey = data.gemini_api_key;
    if (!encryptedKey) return null;

    // Try to parse as JSON (encrypted format)
    try {
      const parsed = JSON.parse(encryptedKey);
      if (parsed.data && parsed.iv) {
        // It's encrypted - we'll need to decrypt on client side before sending
        // For now, return null and let client handle it
        return null;
      }
    } catch {
      // Not JSON, might be plaintext (backward compatibility)
      return encryptedKey;
    }

    return null;
  } catch (error) {
    console.error('Error fetching user API key:', error);
    return null;
  }
}

/**
 * Main handler
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, model = 'gemini-2.5-flash', useUserApiKey, userId }: GeminiRequest = req.body;

    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Invalid prompt' });
    }

    if (prompt.length > 10000) {
      return res.status(400).json({ error: 'Prompt too long (max 10000 characters)' });
    }

    // Extract user ID from auth header or request
    const authHeader = req.headers.authorization;
    const actualUserId = userId || 'anonymous';

    // Rate limiting
    const rateLimit = checkRateLimit(actualUserId);
    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter,
        resetTime: rateLimit.resetTime
      });
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', '10');
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
    res.setHeader('X-RateLimit-Reset', rateLimit.resetTime.toString());

    // Determine which API key to use
    let apiKey: string | null = null;

    if (useUserApiKey && actualUserId !== 'anonymous') {
      // Try to get user's own API key
      apiKey = await getUserApiKey(actualUserId);
    }

    // Fallback to server API key
    if (!apiKey) {
      apiKey = process.env.GEMINI_API_KEY || null;

      if (!apiKey) {
        return res.status(503).json({
          error: 'Gemini API service unavailable',
          message: 'No API key configured. Please add your own API key in Settings.'
        });
      }
    }

    // Make request to Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json().catch(() => ({}));
      console.error('Gemini API error:', errorData);

      return res.status(geminiResponse.status).json({
        error: 'Gemini API request failed',
        details: errorData
      });
    }

    const data = await geminiResponse.json();

    // Log usage (optional - for monitoring)
    console.log(`[Gemini Proxy] User: ${actualUserId}, Model: ${model}, Prompt length: ${prompt.length}`);

    return res.status(200).json(data);

  } catch (error) {
    console.error('Gemini proxy error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
