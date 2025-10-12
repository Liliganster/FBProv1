/**
 * Centralized Timeout Handler
 *
 * Provides utilities to prevent operations from hanging indefinitely
 * by wrapping promises with configurable timeouts.
 */

export class TimeoutError extends Error {
  constructor(message: string, public readonly operation?: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

interface TimeoutOptions {
  timeout?: number; // milliseconds
  operation?: string; // operation name for better error messages
  signal?: AbortSignal; // optional abort signal
}

/**
 * Wrap a promise with a timeout
 * @param promise The promise to wrap
 * @param options Timeout configuration
 * @returns The promise result or throws TimeoutError
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  options: TimeoutOptions = {}
): Promise<T> {
  const {
    timeout = 30000, // default 30 seconds
    operation = 'Operation',
    signal
  } = options;

  // If signal is already aborted, reject immediately
  if (signal?.aborted) {
    throw new Error(`${operation} was aborted`);
  }

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new TimeoutError(
        `${operation} timed out after ${timeout}ms`,
        operation
      ));
    }, timeout);

    // Handle abort signal
    const abortHandler = () => {
      clearTimeout(timeoutId);
      reject(new Error(`${operation} was aborted`));
    };

    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        if (signal) {
          signal.removeEventListener('abort', abortHandler);
        }
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        if (signal) {
          signal.removeEventListener('abort', abortHandler);
        }
        reject(error);
      });
  });
}

/**
 * Retry a function with exponential backoff
 * @param fn The function to retry
 * @param options Retry configuration
 * @returns The function result
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    timeout?: number;
    operation?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    timeout = 30000,
    operation = 'Operation'
  } = options;

  let lastError: Error | null = null;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withTimeout(fn(), {
        timeout,
        operation: `${operation} (attempt ${attempt + 1}/${maxRetries + 1})`
      });
    } catch (error) {
      lastError = error as Error;

      // Don't retry on timeout errors - they're likely systemic issues
      if (error instanceof TimeoutError) {
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw new Error(
    `${operation} failed after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Common timeout configurations for different operation types
 */
export const TIMEOUT_CONFIGS = {
  // Database operations
  DB_READ: 10000,          // 10 seconds
  DB_WRITE: 15000,         // 15 seconds
  DB_BULK: 30000,          // 30 seconds

  // API calls
  API_FAST: 5000,          // 5 seconds
  API_NORMAL: 15000,       // 15 seconds
  API_SLOW: 30000,         // 30 seconds
  API_UPLOAD: 60000,       // 60 seconds

  // File operations
  FILE_READ: 10000,        // 10 seconds
  FILE_UPLOAD: 60000,      // 60 seconds
  FILE_PROCESS: 30000,     // 30 seconds

  // AI operations
  AI_QUICK: 15000,         // 15 seconds
  AI_STANDARD: 30000,      // 30 seconds
  AI_LONG: 60000,          // 60 seconds

  // Authentication
  AUTH_LOGIN: 15000,       // 15 seconds
  AUTH_CALLBACK: 20000,    // 20 seconds
  AUTH_REFRESH: 10000,     // 10 seconds
} as const;

/**
 * Wrap a Supabase query with timeout handling
 */
export async function withSupabaseTimeout<T>(
  query: Promise<{ data: T | null; error: any }>,
  options: TimeoutOptions = {}
): Promise<{ data: T | null; error: any }> {
  try {
    const result = await withTimeout(query, {
      timeout: options.timeout || TIMEOUT_CONFIGS.DB_READ,
      operation: options.operation || 'Database query'
    });
    return result;
  } catch (error) {
    if (error instanceof TimeoutError) {
      return {
        data: null,
        error: {
          message: error.message,
          code: 'TIMEOUT',
          details: error.operation
        }
      };
    }
    throw error;
  }
}

/**
 * Create a debounced version of a function
 * Useful for preventing timeout issues from rapid repeated calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Create a throttled version of a function
 * Ensures function is not called more than once per specified time period
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
