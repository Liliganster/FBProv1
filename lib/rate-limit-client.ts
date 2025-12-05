/**
 * Helper functions for handling rate limiting and API errors
 */

export interface RateLimitError extends Error {
  isRateLimit: true;
  retryAfter?: number;
}

/**
 * Wraps fetch calls to handle rate limiting gracefully
 */
export async function fetchWithRateLimit(
  url: string,
  options?: RequestInit
): Promise<Response> {
  // Add device fingerprint header if running in browser
  if (typeof window !== 'undefined') {
    try {
      const { getDeviceFingerprint } = await import('./fingerprint');
      const fingerprint = await getDeviceFingerprint();

      options = options || {};
      options.headers = {
        ...options.headers,
        'X-Device-Fingerprint': fingerprint
      };
    } catch (e) {
      // Ignore fingerprint errors to avoid blocking requests
      console.warn('Failed to attach fingerprint:', e);
    }
  }

  const response = await fetch(url, options);

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : 60;

    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: 'Rate limit exceeded' };
    }

    const error = new Error(
      errorData.message ||
      `Rate limit exceeded. Please wait ${retrySeconds} seconds before trying again.`
    ) as RateLimitError;
    error.isRateLimit = true;
    error.retryAfter = retrySeconds;

    throw error;
  }

  return response;
}

/**
 * Checks if an error is a rate limit error
 */
export function isRateLimitError(error: any): error is RateLimitError {
  return error && error.isRateLimit === true;
}

/**
 * Formats a rate limit error message for display to users
 */
export function formatRateLimitError(error: RateLimitError): string {
  const waitTime = error.retryAfter || 60;
  const minutes = Math.ceil(waitTime / 60);

  if (waitTime < 60) {
    return `Too many AI requests. Please wait ${waitTime} seconds before trying again.`;
  } else {
    return `Too many AI requests. Please wait ${minutes} minute${minutes > 1 ? 's' : ''} before trying again.`;
  }
}

/**
 * Wrapper for AI service functions that handles rate limiting
 */
export async function withRateLimitHandling<T>(
  operation: () => Promise<T>,
  context: string = 'AI operation'
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isRateLimitError(error)) {
      const userMessage = formatRateLimitError(error);
      console.warn(`[${context}] Rate limited:`, userMessage);
      throw new Error(userMessage);
    }

    // Re-throw other errors as-is
    throw error;
  }
}