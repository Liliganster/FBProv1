// Script para probar Google Maps API directamente
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testGoogleMapsAPI() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  console.log('🔍 Probando Google Maps API...\n');
  
  if (!apiKey) {
    console.log('❌ No se encontró GOOGLE_MAPS_API_KEY en .env.local');
    return;
  }
  
  console.log(`✅ API Key encontrada: ${apiKey.substring(0, 10)}...`);
  
  // Probar geocoding
  const testAddress = 'Calle Mayor, Madrid, España';
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(testAddress)}&key=${apiKey}`;
  
  try {
    console.log(`🌍 Probando geocoding para: "${testAddress}"`);
    console.log(`📡 URL: ${url.replace(apiKey, 'API_KEY_HIDDEN')}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`\n📊 Respuesta de Google Maps:`);
    console.log(`Status: ${data.status}`);
    
    if (data.status === 'OK') {
      console.log('✅ ¡Google Maps API funciona correctamente!');
      console.log(`📍 Resultados encontrados: ${data.results.length}`);
      if (data.results[0]) {
        console.log(`📍 Dirección formateada: ${data.results[0].formatted_address}`);
        console.log(`📍 Coordenadas: ${data.results[0].geometry.location.lat}, ${data.results[0].geometry.location.lng}`);
      }
    } else if (data.status === 'REQUEST_DENIED') {
      console.log('❌ REQUEST_DENIED - Problemas con la API key');
      console.log(`Error: ${data.error_message || 'Sin mensaje de error'}`);
      console.log('\n🔧 Posibles soluciones:');
      console.log('1. Verificar que la API key sea válida');
      console.log('2. Habilitar Geocoding API en Google Cloud Console');
      console.log('3. Revisar restricciones de la API key');
    } else if (data.status === 'OVER_QUERY_LIMIT') {
      console.log('❌ OVER_QUERY_LIMIT - Se excedió el límite de consultas');
      console.log('💡 Google Maps ofrece $200 de crédito gratis mensual');
    } else {
      console.log(`❌ Status desconocido: ${data.status}`);
      console.log(`Error: ${data.error_message || 'Sin mensaje de error'}`);
    }
    
  } catch (error) {
    console.log('❌ Error al llamar a Google Maps API:');
    console.log(error.message);
  }
}

testGoogleMapsAPI();