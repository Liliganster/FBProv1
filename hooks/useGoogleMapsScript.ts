import { useEffect, useMemo, useRef, useState } from 'react';

// FIX: Replace `typeof google` with `any` to resolve TypeScript errors and align with other files.
declare global {
  interface Window {
    google: any;
    __gmapsLoaderPromise?: Promise<any>;
  }
}

type GoogleMapsOptions = {
  apiKey?: string;
  libraries?: Array<'places' | 'marker' | 'routes'>; // extiéndelo si necesitas más
  language?: string;  // ej. 'es'
  region?: string;    // ej. 'AT'
  version?: string;   // ej. 'weekly' | 'beta' | 'quarterly'
  timeoutMs?: number; // ej. 15000
};

export function useGoogleMapsScript({
  apiKey,
  libraries = ['places', 'marker', 'routes'],
  language = 'es',
  region = 'AT',
  version = 'weekly',
  timeoutMs = 15000,
}: GoogleMapsOptions) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const src = useMemo(() => {
    if (!apiKey) return '';
    const params = new URLSearchParams();
    params.set('key', apiKey);
    if (libraries.length) params.set('libraries', libraries.join(','));
    if (language) params.set('language', language);
    if (region) params.set('region', region);
    if (version) params.set('v', version);
    // no usamos callback para simplificar
    return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
  }, [apiKey, libraries, language, region, version]);

  useEffect(() => {
    // SSR-guard
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!apiKey) return;

    // Ya cargado
    if (window.google && window.google.maps) {
      setIsLoaded(true);
      return;
    }

    // Usa un singleton para evitar duplicados/race conditions
    if (!window.__gmapsLoaderPromise) {
      // FIX: Replace `typeof google` with `any` to resolve TypeScript error.
      window.__gmapsLoaderPromise = new Promise<any>((resolve, reject) => {
        const existing = document.getElementById('google-maps-script') as HTMLScriptElement | null;
        if (existing) {
          // Ya existe etiqueta; espera a que termine.
          existing.addEventListener('load', () => window.google ? resolve(window.google) : reject(new Error('Google Maps no disponible tras load')));
          existing.addEventListener('error', () => reject(new Error('Fallo al cargar Google Maps (script existente).')));
          return;
        }

        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.src = src;
        script.async = true;
        script.defer = true;

        script.onload = () => window.google ? resolve(window.google) : reject(new Error('Google Maps no disponible tras onload'));
        script.onerror = () => reject(new Error('Fallo al cargar Google Maps.'));
        document.head.appendChild(script);
      });
    }

    // Control de timeout opcional
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
      .catch((e) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setError(e instanceof Error ? e : new Error(String(e)));
      });

    // Limpieza: no removemos el script (puede usarlo otro componente)
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [apiKey, src, timeoutMs]);

  return { isLoaded, error, google: (typeof window !== 'undefined' ? window.google : undefined) };
}

export default useGoogleMapsScript;
