# Rate Limiting Implementation for AI APIs 🛡️

## Overview
Implemented comprehensive rate limiting for all AI API endpoints to prevent abuse and ensure fair usage across users.

## ✅ Implementation Details

### Rate Limit Configuration
- **Limit**: 10 requests per minute per user
- **Window**: Sliding 60-second window
- **Identification**: Uses Authorization header, X-User-ID header, query params, or IP address as fallback
- **Storage**: In-memory with automatic cleanup to prevent memory leaks

### Protected Endpoints
All AI endpoints now have rate limiting:

1. **`/api/ai/gemini.ts`** - Gemini AI processing
2. **`/api/ai/openrouter/chat.ts`** - OpenRouter chat completions  
3. **`/api/ai/openrouter/structured.ts`** - OpenRouter structured output
4. **`/api/ai/openrouter/models.ts`** - OpenRouter model listing

### Response Headers
Rate limited responses include:
- `X-RateLimit-Limit`: Maximum requests allowed (10)
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when window resets
- `Retry-After`: Seconds to wait before retry (on 429 responses)

### Error Handling
- **Status 429**: "Too Many Requests" with descriptive error message
- **Frontend Integration**: Graceful handling with user-friendly messages
- **Automatic Retry**: Clients can use `Retry-After` header for intelligent backoff

## 📁 Files Created/Modified

### New Files
- `lib/rate-limiter.ts` - Core rate limiting middleware and logic
- `lib/rate-limit-client.ts` - Client-side helpers for handling rate limits
- `api/ai/status.ts` - Rate limit status endpoint for monitoring
- `public/test-rate-limit.js` - Testing script for verification

### Modified Files
- `api/ai/gemini.ts` - Added rate limiting wrapper
- `api/ai/openrouter/chat.ts` - Added rate limiting wrapper  
- `api/ai/openrouter/structured.ts` - Added rate limiting wrapper
- `api/ai/openrouter/models.ts` - Added rate limiting wrapper
- `services/aiService.ts` - Added rate limit error handling
- `services/extractor-universal/providers.ts` - Added rate limit error handling
- `.env.example` - Added rate limiting documentation

## 🧪 Testing

### Manual Testing
Use the test script at `/public/test-rate-limit.js`:

```javascript
// In browser console:
fetch('/test-rate-limit.js').then(r => r.text()).then(eval);
testRateLimit(); // Run the test
```

### Status Monitoring
Check rate limit status:
```javascript
fetch('/api/ai/status').then(r => r.json()).then(console.log);
```

### Expected Behavior
1. First 10 requests succeed normally
2. Requests 11+ return 429 status
3. Client shows user-friendly error messages
4. Rate limits reset after 60 seconds

## 🔧 Configuration

### Environment Variables
No additional environment variables needed. Rate limiting is enabled by default for all AI endpoints.

### Customization
To modify rate limits, edit `lib/rate-limiter.ts`:
```typescript
// Change limits here:
export const aiRateLimiter = new RateLimiter(
  15,        // maxRequests (default: 10)
  90 * 1000  // windowMs (default: 60000)
);
```

## 🚀 Production Considerations

### Memory Usage
- In-memory storage scales with active users
- Automatic cleanup prevents memory leaks
- Consider Redis for high-traffic deployments

### User Identification
Current priority order:
1. `Authorization` header (JWT/session tokens)
2. `X-User-ID` header  
3. `userId` query parameter
4. IP address (fallback for anonymous users)

### Monitoring
- Use `/api/ai/status` endpoint for real-time monitoring
- Monitor response times for rate limit checks
- Set up alerts for excessive 429 responses

## 🛠️ Maintenance

### Memory Cleanup
- Automatic cleanup runs every 5 minutes
- Removes expired entries to prevent memory leaks
- No manual intervention required

### Rate Limit Reset
To reset rate limits for a specific user:
```typescript
import { aiRateLimiter } from './lib/rate-limiter';
aiRateLimiter.reset('user-id-here');
```

## 📊 Benefits Achieved

✅ **Abuse Prevention**: Prevents users from making unlimited AI requests  
✅ **Fair Usage**: Ensures equitable access to AI resources  
✅ **Cost Control**: Limits API usage costs for external AI services  
✅ **Performance**: Prevents system overload from excessive requests  
✅ **User Experience**: Provides clear feedback when limits are reached  
✅ **Monitoring**: Real-time visibility into usage patterns  

The rate limiting system is now production-ready and will automatically protect all AI endpoints from abuse while maintaining a good user experience for legitimate usage.