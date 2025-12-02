/**
 * OpenRouter AI Proxy - Serverless Function
 *
 * This endpoint proxies requests to OpenRouter AI API.
 * It supports both:
 * 1. User's own API key (preferred - from encrypted database)
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

// Rate limiting in-memory store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface OpenRouterRequest {
  prompt: string;
  model?: string;
  userApiKey?: string; // User can send their own key (from client-side decryption)
  useUserApiKey?: boolean;
  userId?: string;
  maxTokens?: number;
  temperature?: number;
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
  const key = `openrouter:${userId}`;
  const limit = rateLimitStore.get(key);

  if (!limit || now > limit.resetTime) {
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
    const {
      prompt,
      model = 'meta-llama/llama-3.1-8b-instruct:free',
      userApiKey,
      useUserApiKey,
      userId,
      maxTokens = 2048,
      temperature = 0.7
    }: OpenRouterRequest = req.body;

    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Invalid prompt' });
    }

    if (prompt.length > 10000) {
      return res.status(400).json({ error: 'Prompt too long (max 10000 characters)' });
    }

    // Extract user ID
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

    // Priority 1: User provided their own key (decrypted on client)
    if (userApiKey && typeof userApiKey === 'string' && userApiKey.startsWith('sk-')) {
      apiKey = userApiKey;
    }
    // Priority 2: Server fallback key
    else {
      apiKey = process.env.OPENROUTER_API_KEY || null;

      if (!apiKey) {
        return res.status(503).json({
          error: 'OpenRouter API service unavailable',
          message: 'No API key configured. Please add your own OpenRouter API key in Settings.'
        });
      }
    }

    // Make request to OpenRouter API
    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173',
        'X-Title': 'FahrtenbuchPro'
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature
      })
    });

    if (!openRouterResponse.ok) {
      const errorData = await openRouterResponse.json().catch(() => ({}));
      console.error('OpenRouter API error:', errorData);

      return res.status(openRouterResponse.status).json({
        error: 'OpenRouter API request failed',
        details: errorData
      });
    }

    const data = await openRouterResponse.json();

    // Log usage (optional - for monitoring)
    console.log(`[OpenRouter Proxy] User: ${actualUserId}, Model: ${model}, Prompt length: ${prompt.length}`);

    return res.status(200).json(data);

  } catch (error) {
    console.error('OpenRouter proxy error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
