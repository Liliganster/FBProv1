// Endpoint de prueba para verificar que Google Maps API funciona

import { withRateLimit } from '../../rate-limiter';

async function testGeocodeHandler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const testAddress = 'Calle Mayor, Madrid, España';

  // 1. Verificar que la API key esté configurada
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      hasGoogleMapsApiKey: !!apiKey,
      apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : null,
      allEnvKeys: Object.keys(process.env).filter(k => k.includes('GOOGLE') || k.includes('MAP')),
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV
    },
    test: {
      address: testAddress,
      result: null as any,
      error: null as any
    }
  };

  if (!apiKey) {
    return res.status(200).json({
      ...diagnostics,
      message: '❌ Google Maps API key NOT configured',
      solution: 'Add GOOGLE_MAPS_API_KEY to Vercel environment variables'
    });
  }

  // 2. Intentar hacer una llamada real a Google Maps
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.append('address', testAddress);
    url.searchParams.append('key', apiKey);

    console.log('[test-geocode] Calling Google Maps API...');
    const response = await fetch(url.toString());

    console.log('[test-geocode] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      diagnostics.test.error = {
        status: response.status,
        body: errorText
      };

      return res.status(200).json({
        ...diagnostics,
        message: `❌ Google Maps API Error: ${response.status}`,
        solution: 'Check API key validity and ensure Geocoding API is enabled'
      });
    }

    const data = await response.json();
    console.log('[test-geocode] API Response:', JSON.stringify(data, null, 2));

    diagnostics.test.result = {
      status: data.status,
      resultsCount: data.results?.length || 0,
      firstResult: data.results?.[0] ? {
        formatted_address: data.results[0].formatted_address,
        location: data.results[0].geometry.location,
        location_type: data.results[0].geometry.location_type
      } : null,
      error_message: data.error_message
    };

    if (data.status === 'REQUEST_DENIED') {
      return res.status(200).json({
        ...diagnostics,
        message: '❌ REQUEST_DENIED - API key is invalid or has restrictions',
        solution: 'Check API key restrictions in Google Cloud Console',
        googleErrorMessage: data.error_message
      });
    }

    if (data.status === 'OK') {
      return res.status(200).json({
        ...diagnostics,
        message: '✅ Google Maps API is working correctly!',
        solution: null
      });
    }

    return res.status(200).json({
      ...diagnostics,
      message: `⚠️ Unexpected status: ${data.status}`,
      solution: 'Check Google Maps API response'
    });

  } catch (error) {
    console.error('[test-geocode] Exception:', error);
    diagnostics.test.error = {
      message: (error as Error).message,
      stack: (error as Error).stack
    };

    return res.status(200).json({
      ...diagnostics,
      message: '❌ Exception when calling Google Maps API',
      solution: 'Check network connectivity and API endpoint'
    });
  }
}

export default withRateLimit(testGeocodeHandler);
