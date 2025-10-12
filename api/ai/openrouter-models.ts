/**
 * OpenRouter Models List - Serverless Function
 *
 * Fetches available models from OpenRouter API
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userApiKey, useUserApiKey } = req.body;

    // Determine which API key to use
    let apiKey: string | null = null;

    if (useUserApiKey && userApiKey) {
      apiKey = userApiKey;
    } else {
      apiKey = process.env.OPENROUTER_API_KEY || null;
    }

    if (!apiKey) {
      return res.status(400).json({
        error: 'No API key available',
        message: 'Please provide your own OpenRouter API key'
      });
    }

    // Fetch models from OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: 'Failed to fetch models',
        details: errorData
      });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('OpenRouter models fetch error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
