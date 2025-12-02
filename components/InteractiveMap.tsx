import React, { useEffect, useRef, useState } from 'react';
import { LoaderIcon } from './Icons';

// FIX: Add global declaration for window.google to fix TypeScript errors when accessing the Google Maps API.
declare global {
  interface Window {
    google: any;
  }
}

interface InteractiveMapProps {
  locations: string[];
  region?: string;
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({ locations, region }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [isReady, setIsReady] = useState(false);

  // Verificar disponibilidad de Google Maps
  useEffect(() => {
    const checkGoogleMaps = () => {
      if (window.google && window.google.maps && window.google.maps.importLibrary) {
        setIsReady(true);
      } else {
        // Reintentar después de un breve delay
        setTimeout(checkGoogleMaps, 100);
      }
    };
    
    checkGoogleMaps();
  }, []);

  useEffect(() => {
    if (!isReady || !mapRef.current) return;
    
    const validLocations = locations.filter(loc => loc.trim() !== '');
    if (validLocations.length < 2) {
      setStatus('error');
      setErrorMessage('Se necesitan al menos 2 localizaciones para trazar una ruta.');
      return;
    }

    const initMap = async () => {
      try {
        const { Map } = await window.google.maps.importLibrary("maps") as any;
        const { DirectionsService, DirectionsRenderer } = await window.google.maps.importLibrary("routes") as any;
        const { AdvancedMarkerElement } = await window.google.maps.importLibrary("marker") as any;

        const map = new Map(mapRef.current as HTMLElement, {
          center: { lat: 48.2082, lng: 16.3738 }, // Default to Vienna
          zoom: 6,
          disableDefaultUI: true,
          zoomControl: true,
          mapId: 'FAHRTENBUCH_MAP_ID'
        });

        const directionsService = new DirectionsService();
        const directionsRenderer = new DirectionsRenderer({
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#007aff',
            strokeWeight: 5,
            strokeOpacity: 0.8,
          }
        });
        directionsRenderer.setMap(map);

        const origin = validLocations[0];
        const destination = validLocations[validLocations.length - 1];
        const waypoints = validLocations.slice(1, -1).map(location => ({
          location,
          stopover: true,
        }));

        directionsService.route(
          {
            origin: origin,
            destination: destination,
            waypoints: waypoints,
            travelMode: window.google.maps.TravelMode.DRIVING,
            region: region || undefined,
          },
          (result, status) => {
            if (status === window.google.maps.DirectionsStatus.OK && result) {
              directionsRenderer.setDirections(result);
              setStatus('success');

              const route = result.routes[0];
              // Add custom markers
              route.legs.forEach((leg, index) => {
                // Add start marker for the first leg
                if (index === 0 && leg.start_location) {
                  new AdvancedMarkerElement({
                    map,
                    position: leg.start_location,
                    title: `A: ${leg.start_address}`,
                  });
                }
                // Add end marker for each leg (which is a waypoint or the final destination)
                if (leg.end_location) {
                  const isFinalDestination = index === route.legs.length - 1;
                  new AdvancedMarkerElement({
                    map,
                    position: leg.end_location,
                    title: `${isFinalDestination ? 'B:' : 'Parada:'} ${leg.end_address}`,
                  });
                }
              });
            } else {
              setStatus('error');
              setErrorMessage(`No se pudo trazar la ruta: ${status}`);
              console.error(`Directions request failed due to ${status}`);
            }
          }
        );
      } catch (error) {
        console.error("Error initializing map:", error);
        setStatus('error');
        setErrorMessage('Error initializing map libraries.');
      }
    };

    initMap();
  }, [isReady, locations, region]);

  return (
    <div className="relative w-full h-full bg-gray-800 rounded-lg">
      {status !== 'success' && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-surface-dark/80">
          {status === 'loading' && <LoaderIcon className="w-8 h-8 animate-spin text-brand-primary" />}
          {status === 'error' && <p className="text-red-400 p-4 text-center">{errorMessage}</p>}
        </div>
      )}
      <div ref={mapRef} className="w-full h-full rounded-lg" />
    </div>
  );
};

export default InteractiveMap;
