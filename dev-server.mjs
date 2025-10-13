import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Handler para Google Maps script
app.get('/api/google/maps/script', async (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'Google Maps API key not configured' });
  }

  // Construir URL con parámetros
  const params = new URLSearchParams();
  params.set('key', apiKey);
  
  // Agregar parámetros de la query
  if (req.query.libraries) params.set('libraries', req.query.libraries);
  if (req.query.language) params.set('language', req.query.language);
  if (req.query.region) params.set('region', req.query.region);
  if (req.query.v) params.set('v', req.query.v);

  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/js?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Google Maps API error: ${response.status}`);
    }
    
    const script = await response.text();
    
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(script);
  } catch (error) {
    console.error('Error loading Google Maps script:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handler para test-geocode
app.get('/api/ai/test-geocode', async (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const testAddress = 'Calle Mayor, Madrid, España';

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      hasGoogleMapsApiKey: !!apiKey,
      apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : null,
      nodeEnv: process.env.NODE_ENV,
    },
    test: {
      address: testAddress,
      result: null,
      error: null
    }
  };

  if (!apiKey) {
    return res.json({
      ...diagnostics,
      message: '❌ Google Maps API key NOT configured',
      solution: 'Add GOOGLE_MAPS_API_KEY to environment variables'
    });
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.append('address', testAddress);
    url.searchParams.append('key', apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

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

    if (data.status === 'OK') {
      return res.json({
        ...diagnostics,
        message: '✅ Google Maps API is working correctly!',
        solution: null
      });
    } else {
      return res.json({
        ...diagnostics,
        message: `❌ Error: ${data.status}`,
        solution: 'Check Google Maps API configuration'
      });
    }
  } catch (error) {
    diagnostics.test.error = error.message;
    return res.json({
      ...diagnostics,
      message: '❌ Failed to test Google Maps API',
      solution: 'Check network connection and API key'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Dev API server running on http://localhost:${PORT}`);
  console.log(`📍 Google Maps script: http://localhost:${PORT}/api/google/maps/script`);
  console.log(`🧪 Test geocode: http://localhost:${PORT}/api/ai/test-geocode`);
});