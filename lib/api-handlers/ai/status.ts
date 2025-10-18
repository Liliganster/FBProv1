import { aiRateLimiter } from '../../rate-limiter.js';

function toJsonResponse(res: any, status: number, payload: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    toJsonResponse(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  // Extract user identifier (same logic as rate limiter)
  let userId: string;
  
  if (req.headers.authorization) {
    userId = req.headers.authorization.replace('Bearer ', '');
  } else if (req.headers['x-user-id']) {
    userId = req.headers['x-user-id'] as string;
  } else if (req.query?.userId) {
    userId = req.query.userId as string;
  } else {
    userId = req.headers['x-forwarded-for'] || 
             req.headers['x-real-ip'] || 
             req.connection?.remoteAddress || 
             req.socket?.remoteAddress ||
             'unknown';
    
    if (typeof userId === 'string' && userId.includes(',')) {
      userId = userId.split(',')[0].trim();
    }
  }

  // Get rate limit status without consuming a request
  const status = aiRateLimiter.getStatus(userId);
  const storeSize = aiRateLimiter.getStoreSize();

  toJsonResponse(res, 200, {
    userId: userId.substring(0, 10) + '...', // Partial user ID for privacy
    rateLimit: {
      allowed: status.allowed,
      remaining: status.remaining,
      resetTime: status.resetTime,
      resetTimeFormatted: new Date(status.resetTime).toISOString(),
      retryAfter: status.retryAfter
    },
    system: {
      activeUsers: storeSize,
      limits: {
        maxRequests: 10,
        windowMinutes: 1
      }
    }
  });
}