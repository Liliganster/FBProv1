/**
 * Simple in-memory rate limiter for AI API endpoints.
 * Tracks requests per user with sliding window approach.
 */

interface RateLimitEntry {
  timestamps: number[];
  resetTime: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests = 10, windowMs = 60 * 1000) { // 10 requests per minute by default
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    
    // Cleanup old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Check if user is within rate limits and record the request
   */
  checkLimit(userId: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    let entry = this.store.get(userId);
    if (!entry) {
      entry = { timestamps: [], resetTime: now + this.windowMs };
      this.store.set(userId, entry);
    }

    // Remove timestamps outside the current window
    entry.timestamps = entry.timestamps.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    if (entry.timestamps.length >= this.maxRequests) {
      const oldestTimestamp = entry.timestamps[0];
      const retryAfter = Math.ceil((oldestTimestamp + this.windowMs - now) / 1000);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: oldestTimestamp + this.windowMs,
        retryAfter
      };
    }

    // Add current request timestamp
    entry.timestamps.push(now);
    entry.resetTime = Math.max(entry.resetTime, now + this.windowMs);

    return {
      allowed: true,
      remaining: this.maxRequests - entry.timestamps.length,
      resetTime: entry.resetTime
    };
  }

  /**
   * Get current status without recording a request
   */
  getStatus(userId: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    const entry = this.store.get(userId);
    if (!entry) {
      return {
        allowed: true,
        remaining: this.maxRequests,
        resetTime: now + this.windowMs
      };
    }

    // Count requests in current window
    const validTimestamps = entry.timestamps.filter(timestamp => timestamp > windowStart);
    const remaining = Math.max(0, this.maxRequests - validTimestamps.length);

    if (remaining === 0 && validTimestamps.length > 0) {
      const oldestTimestamp = validTimestamps[0];
      const retryAfter = Math.ceil((oldestTimestamp + this.windowMs - now) / 1000);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: oldestTimestamp + this.windowMs,
        retryAfter
      };
    }

    return {
      allowed: remaining > 0,
      remaining,
      resetTime: entry.resetTime
    };
  }

  /**
   * Remove expired entries to prevent memory leaks
   */
  private cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    for (const [userId, entry] of this.store.entries()) {
      entry.timestamps = entry.timestamps.filter(timestamp => timestamp > windowStart);
      
      // Remove entries with no recent activity
      if (entry.timestamps.length === 0 && entry.resetTime < now) {
        this.store.delete(userId);
      }
    }
  }

  /**
   * Reset rate limits for a specific user (admin function)
   */
  reset(userId: string) {
    this.store.delete(userId);
  }

  /**
   * Get current store size (for monitoring)
   */
  getStoreSize(): number {
    return this.store.size;
  }
}

// Singleton instance for AI endpoints
export const aiRateLimiter = new RateLimiter(10, 60 * 1000); // 10 requests per minute

/**
 * Middleware function for rate limiting AI endpoints
 */
export function withRateLimit(handler: (req: any, res: any) => Promise<void>) {
  return async (req: any, res: any) => {
    // Extract user identifier
    let userId: string;
    
    // Try to get user ID from various sources
    if (req.headers.authorization) {
      // If using JWT or session tokens
      userId = req.headers.authorization.replace('Bearer ', '');
    } else if (req.headers['x-user-id']) {
      // If user ID is passed in header
      userId = req.headers['x-user-id'] as string;
    } else if (req.query?.userId) {
      // If user ID is in query params
      userId = req.query.userId as string;
    } else {
      // Fallback to IP address for anonymous users
      userId = req.headers['x-forwarded-for'] || 
               req.headers['x-real-ip'] || 
               req.connection?.remoteAddress || 
               req.socket?.remoteAddress ||
               'unknown';
      
      // Handle multiple IPs in x-forwarded-for
      if (typeof userId === 'string' && userId.includes(',')) {
        userId = userId.split(',')[0].trim();
      }
    }

    // Check rate limit
    const result = aiRateLimiter.checkLimit(userId);
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', '10');
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());
    
    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter?.toString() || '60');
      res.status(429).setHeader('Content-Type', 'application/json').send(JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Maximum 10 requests per minute allowed.',
        retryAfter: result.retryAfter
      }));
      return;
    }

    // Proceed with the original handler
    try {
      await handler(req, res);
    } catch (error) {
      console.error('[rate-limiter] Handler error:', error);
      res.status(500).setHeader('Content-Type', 'application/json').send(JSON.stringify({
        error: 'Internal Server Error'
      }));
    }
  };
}