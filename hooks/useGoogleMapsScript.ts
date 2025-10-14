import { useEffect, useMemo, useRef, useState } from 'react';

declare global {
  interface Window {
    google: any;
    __gmapsLoaderPromise?: Promise<any>;
  }
}

type GoogleMapsOptions = {
  libraries?: Array<'marker' | 'geometry' | 'places'>;
  language?: string;
  region?: string;
  version?: string;
  timeoutMs?: number;
};

export function useGoogleMapsScript({
  libraries = ['marker', 'places'],
  language = 'es',
  region = 'AT',
  version = 'weekly',
  timeoutMs = 15000,
}: GoogleMapsOptions = {}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const src = useMemo(() => {
    const params = new URLSearchParams();
    if (libraries.length) params.set('libraries', libraries.join(','));
    if (language) params.set('language', language);
    if (region) params.set('region', region);
    if (version) params.set('v', version);
    // Best practice: explicit async loader flag to silence Google warning
    params.set('loading', 'async');
    
    // Siempre usar directamente Google Maps API si tenemos la key
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (apiKey) {
      params.set('key', apiKey);
      return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    }
    
    // Fallback al proxy (para producción sin VITE_GOOGLE_MAPS_API_KEY)
    const query = params.toString();
    return `/api/google/maps/script${query ? `?${query}` : ''}`;
  }, [libraries, language, region, version]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    if (window.google && window.google.maps) {
      setIsLoaded(true);
      return;
    }

    if (!window.__gmapsLoaderPromise) {
      window.__gmapsLoaderPromise = new Promise<any>((resolve, reject) => {
        const existing = document.getElementById('google-maps-proxy-script') as HTMLScriptElement | null;
        if (existing) {
          existing.addEventListener('load', () =>
            window.google ? resolve(window.google) : reject(new Error('Google Maps no disponible tras load'))
          );
          existing.addEventListener('error', () => reject(new Error('Fallo al cargar Google Maps (script existente).')));
          return;
        }

        const script = document.createElement('script');
        script.id = 'google-maps-proxy-script';
        script.src = src;
        script.async = true;
        script.defer = true;

        script.onload = () =>
          window.google ? resolve(window.google) : reject(new Error('Google Maps no disponible tras onload'));
        script.onerror = () => reject(new Error('Fallo al cargar Google Maps.'));
        document.head.appendChild(script);
      });
    }

    if (timeoutMs > 0) {
      timeoutRef.current = window.setTimeout(() => {
        setError(new Error('Timeout cargando Google Maps.'));
      }, timeoutMs);
    }

    window.__gmapsLoaderPromise
      .then(() => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setIsLoaded(true);
      })
      .catch((err) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setError(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [src, timeoutMs]);

  return { isLoaded, error, google: typeof window !== 'undefined' ? window.google : undefined };
}

export default useGoogleMapsScript;
