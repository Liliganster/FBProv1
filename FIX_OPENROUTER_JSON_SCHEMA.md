# Fix: OpenRouter JSON Schema Validation Error

## Problem
The app was failing with error: **"openrouter returned an unexpected JSON payload"**

### Root Cause
Schema mismatch between the API response and the validator:
- **API returned**: `productionCompany` (string)
- **Validator expected**: `productionCompanies` (array of strings)

## Solution Applied

### 1. Updated API Proxy (`api/proxy.ts`)
- Changed the OpenRouter system prompt to explicitly request `productionCompanies` as an array
- Updated the output format documentation in the prompt
- Added explicit instructions that the field MUST be an array, even for single company

**Before:**
```json
{
  "date": "YYYY-MM-DD",
  "productionCompany": "string",  // ❌ Wrong format
  "projectName": "string",
  "locations": ["address1", "address2"]
}
```

**After:**
```json
{
  "date": "YYYY-MM-DD",
  "productionCompanies": ["Company 1"],  // ✅ Correct format (array)
  "projectName": "string",
  "locations": ["address1", "address2"]
}
```

### 2. Added Backward Compatibility (`services/extractor-universal/providers.ts`)
- Added automatic conversion for legacy responses
- If API returns old format (`productionCompany` as string), it's automatically converted to `productionCompanies` array
- This ensures the app works even if the AI returns the old format occasionally

```typescript
// Handle legacy format conversion: productionCompany (string) → productionCompanies (array)
if (payload && typeof payload === 'object' && typeof payload.productionCompany === 'string' && !payload.productionCompanies) {
  console.log(`[${provider}] Converting legacy productionCompany to productionCompanies array`);
  payload.productionCompanies = [payload.productionCompany];
  delete payload.productionCompany;
}
```

### 3. Enhanced Error Logging
- Added detailed console.error logs when validation fails
- This helps debug future schema issues by showing the actual payload received

## Files Modified
1. `api/proxy.ts` - Lines 417-520 (OpenRouter structured extraction prompt)
2. `services/extractor-universal/providers.ts` - Lines 12-36 (parseJsonResponse function)

## Testing
✅ Build successful - No TypeScript errors
✅ Dev server running - Ready for testing with PDF uploads

## Next Steps
1. Test PDF upload with the BulkUpload modal
2. Verify extraction works correctly
3. Check that production companies are properly extracted as arrays
4. Monitor console for any remaining validation errors

## Prevention
- The schema is now enforced both in the AI prompt AND in the validation layer
- Backward compatibility ensures graceful handling of format variations
- Enhanced logging makes future debugging easier
