import React from 'react';
import useGoogleMapsScript from '../hooks/useGoogleMapsScript';

const GoogleMapsTest: React.FC = () => {
  const { isLoaded, error, google } = useGoogleMapsScript({
    libraries: ['places', 'marker'],
    language: 'es',
    region: 'ES'
  });

  const testGeocode = () => {
    if (!google || !isLoaded) {
      alert('Google Maps no está cargado aún');
      return;
    }

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: 'Calle Mayor, Madrid, España' }, (results, status) => {
      if (status === 'OK') {
        console.log('✅ Geocoding exitoso:', results);
        alert(`✅ Geocoding exitoso: ${results[0].formatted_address}`);
      } else {
        console.error('❌ Error en geocoding:', status);
        alert(`❌ Error en geocoding: ${status}`);
      }
    });
  };

  const createSimpleMap = () => {
    if (!google || !isLoaded) {
      alert('Google Maps no está cargado aún');
      return;
    }

    const mapElement = document.getElementById('test-map');
    if (!mapElement) return;

    try {
      const map = new google.maps.Map(mapElement, {
        center: { lat: 40.4168, lng: -3.7038 },
        zoom: 10
      });

      new google.maps.Marker({
        position: { lat: 40.4168, lng: -3.7038 },
        map: map,
        title: 'Madrid, España'
      });

      alert('✅ Mapa creado exitosamente');
    } catch (error) {
      console.error('❌ Error creando mapa:', error);
      alert(`❌ Error creando mapa: ${error.message}`);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🗺️ Prueba de Google Maps React</h1>
      
      {/* Estado */}
      <div className="mb-6 p-4 rounded-lg border">
        <h2 className="text-xl font-semibold mb-2">Estado de Google Maps API</h2>
        {!isLoaded && !error && (
          <div className="text-blue-600">⏳ Cargando Google Maps API...</div>
        )}
        {error && (
          <div className="text-red-600">❌ Error: {error.message}</div>
        )}
        {isLoaded && !error && (
          <div className="text-green-600">✅ Google Maps API cargada correctamente</div>
        )}
      </div>

      {/* Información de debug */}
      <div className="mb-6 p-4 bg-gray-100 rounded-lg">
        <h3 className="font-semibold mb-2">Información de debug:</h3>
        <ul className="space-y-1 text-sm">
          <li><strong>isLoaded:</strong> {isLoaded ? 'true' : 'false'}</li>
          <li><strong>error:</strong> {error ? error.message : 'null'}</li>
          <li><strong>google disponible:</strong> {google ? 'true' : 'false'}</li>
          <li><strong>window.google:</strong> {typeof window !== 'undefined' && window.google ? 'true' : 'false'}</li>
          <li><strong>VITE_GOOGLE_MAPS_API_KEY:</strong> {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? 'configurada' : 'NO configurada'}</li>
        </ul>
      </div>

      {/* Botones de prueba */}
      <div className="mb-6 space-x-4">
        <button 
          onClick={testGeocode}
          disabled={!isLoaded || !!error}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
        >
          Probar Geocoding
        </button>
        <button 
          onClick={createSimpleMap}
          disabled={!isLoaded || !!error}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-400"
        >
          Crear Mapa
        </button>
      </div>

      {/* Contenedor del mapa */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Mapa de prueba:</h3>
        <div 
          id="test-map" 
          className="w-full h-96 bg-gray-200 border rounded-lg"
        ></div>
      </div>
    </div>
  );
};

export default GoogleMapsTest;