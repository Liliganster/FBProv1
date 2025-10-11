/**
 * Simple test script to verify rate limiting works correctly.
 * Run this from the browser console to test the rate limiting.
 * 
 * Usage:
 * 1. Open browser dev tools (F12)
 * 2. Go to Console tab
 * 3. Copy and paste this script
 * 4. It will make multiple requests and should be rate limited after 10
 */

async function testRateLimit() {
  console.log('🧪 Starting Rate Limit Test...');
  console.log('This will make 15 requests to /api/ai/gemini to test rate limiting.');
  console.log('Expected: First 10 should succeed, next 5 should fail with 429 status.');
  
  const testPayload = {
    mode: 'direct',
    text: 'Test trip from Vienna to Salzburg on 2023-01-01 for business meeting with client ABC'
  };

  let successCount = 0;
  let rateLimitCount = 0;
  let errors = [];

  for (let i = 1; i <= 15; i++) {
    try {
      console.log(`📤 Request ${i}/15...`);
      
      const startTime = Date.now();
      const response = await fetch('/api/ai/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload)
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (response.status === 429) {
        rateLimitCount++;
        const retryAfter = response.headers.get('Retry-After');
        console.log(`🔴 Request ${i}: Rate limited! Retry after: ${retryAfter} seconds`);
        
        try {
          const errorData = await response.json();
          console.log(`   Error message: ${errorData.message}`);
        } catch {
          console.log('   Could not parse error response');
        }
      } else if (response.ok) {
        successCount++;
        console.log(`✅ Request ${i}: Success (${duration}ms)`);
      } else {
        errors.push(`Request ${i}: ${response.status} ${response.statusText}`);
        console.log(`❌ Request ${i}: ${response.status} ${response.statusText}`);
      }
      
      // Add small delay between requests
      if (i < 15) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      errors.push(`Request ${i}: ${error.message}`);
      console.error(`💥 Request ${i}: Error -`, error.message);
    }
  }
  
  console.log('\n📊 Rate Limit Test Results:');
  console.log(`✅ Successful requests: ${successCount}`);
  console.log(`🔴 Rate limited requests: ${rateLimitCount}`);
  console.log(`❌ Other errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    errors.forEach(error => console.log(`   ${error}`));
  }
  
  console.log('\n🎯 Expected behavior:');
  console.log('   - Around 10 successful requests');
  console.log('   - Around 5 rate limited requests');
  console.log('   - Rate limited requests should have 429 status');
  console.log('   - Rate limited requests should include Retry-After header');
  
  const testPassed = successCount >= 8 && successCount <= 12 && rateLimitCount >= 3;
  console.log(`\n${testPassed ? '🎉 TEST PASSED!' : '⚠️  TEST RESULTS UNEXPECTED'}`);
  
  return {
    successCount,
    rateLimitCount,
    errors,
    testPassed
  };
}

// Auto-run the test
console.log('🚀 Rate limit test ready. Call testRateLimit() to run the test.');
console.log('Note: Make sure the Gemini API key is configured for this to work properly.');

// Uncomment the line below to auto-run the test:
// testRateLimit();