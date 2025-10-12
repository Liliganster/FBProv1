// Ejecutor de herramientas - Implementaciones reales de las funciones del agente

type AddressNormalizeArgs = {
  raw: string;
};

type GeocodeAddressArgs = {
  address: string;
};

/**
 * Normaliza una dirección para prepararla para geocodificación
 */
export async function executeAddressNormalize(args: AddressNormalizeArgs) {
  const { raw } = args;

  // Limpieza básica
  let normalized = raw.trim();

  // Reemplazar múltiples espacios por uno solo
  normalized = normalized.replace(/\s+/g, ' ');

  // Eliminar caracteres especiales problemáticos
  normalized = normalized.replace(/[\\n\\r\\t]/g, ' ');

  return {
    normalized
  };
}

/**
 * Geocodifica una dirección usando Google Maps Geocoding API
 */
export async function executeGeocodeAddress(args: GeocodeAddressArgs) {
  const { address } = args;

  // Intentar obtener la API key de diferentes fuentes
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.warn('[geocode_address] ⚠️  Google Maps API key NOT configured');
    console.warn('[geocode_address] Checked: GOOGLE_MAPS_API_KEY, VITE_GOOGLE_MAPS_API_KEY');
    console.warn('[geocode_address] Please set GOOGLE_MAPS_API_KEY in Vercel environment variables');

    // Fallback: devolver null pero conservar la dirección original
    return {
      latitude: null,
      longitude: null,
      formatted_address: address, // Mantener dirección original
      confidence: 0
    };
  }

  console.log(`[geocode_address] ✓ API Key found: ${apiKey.substring(0, 15)}...`);

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.append('address', address);
    url.searchParams.append('key', apiKey);

    console.log(`[geocode_address] Calling Google Maps API for: "${address}"`);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[geocode_address] ❌ API Error ${response.status}:`, errorText);
      throw new Error(`Geocoding API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    console.log(`[geocode_address] API Response status: ${data.status}`);

    if (data.status === 'REQUEST_DENIED') {
      console.error('[geocode_address] ❌ REQUEST_DENIED - Check API key validity and restrictions');
      console.error('[geocode_address] Error message:', data.error_message);
      return {
        latitude: null,
        longitude: null,
        formatted_address: address,
        confidence: 0
      };
    }

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.warn(`[geocode_address] ⚠️  No results for: "${address}" (status: ${data.status})`);
      return {
        latitude: null,
        longitude: null,
        formatted_address: address,
        confidence: 0
      };
    }

    const result = data.results[0];
    const location = result.geometry.location;

    // Calcular confidence basado en el tipo de resultado
    let confidence = 0.5;
    if (result.geometry.location_type === 'ROOFTOP') {
      confidence = 1.0;
    } else if (result.geometry.location_type === 'RANGE_INTERPOLATED') {
      confidence = 0.8;
    } else if (result.geometry.location_type === 'GEOMETRIC_CENTER') {
      confidence = 0.6;
    } else if (result.geometry.location_type === 'APPROXIMATE') {
      confidence = 0.4;
    }

    console.log(`[geocode_address] ✓ Success: ${result.formatted_address} (${location.lat}, ${location.lng}) [confidence: ${confidence}]`);

    return {
      latitude: location.lat,
      longitude: location.lng,
      formatted_address: result.formatted_address,
      confidence
    };

  } catch (error) {
    console.error('[geocode_address] ❌ Exception:', error);
    return {
      latitude: null,
      longitude: null,
      formatted_address: address,
      confidence: 0
    };
  }
}

/**
 * Ejecuta una herramienta por nombre
 */
export async function executeTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'address_normalize':
      return await executeAddressNormalize(args);

    case 'geocode_address':
      return await executeGeocodeAddress(args);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
