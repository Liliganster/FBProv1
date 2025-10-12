import { useState, useEffect } from 'react';

/**
 * Hook personalizado para ejecutar media queries
 * @param query - La media query a evaluar (ej: '(max-width: 768px)')
 * @returns boolean - true si la media query coincide, false de lo contrario
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState<boolean>(() => {
    // Verificar si estamos en el cliente (evitar errores de SSR)
    if (typeof window === 'undefined') {
      return false;
    }
    
    try {
      return window.matchMedia(query).matches;
    } catch (error) {
      console.warn('Error evaluating media query:', error);
      return false;
    }
  });

  useEffect(() => {
    // Verificar si estamos en el cliente
    if (typeof window === 'undefined') {
      return;
    }

    let mediaQuery: MediaQueryList;
    
    try {
      mediaQuery = window.matchMedia(query);
    } catch (error) {
      console.warn('Error creating media query:', error);
      return;
    }

    // Función para manejar cambios en la media query
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Establecer el estado inicial
    setMatches(mediaQuery.matches);

    // Agregar el listener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback para navegadores más antiguos
      mediaQuery.addListener(handleChange);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        // Fallback para navegadores más antiguos
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [query]);

  return matches;
};

/**
 * Hook especializado para detectar dispositivos móviles
 * @returns boolean - true si es un dispositivo móvil (pantalla <= 768px)
 */
export const useMobile = (): boolean => {
  return useMediaQuery('(max-width: 768px)');
};

export default useMediaQuery;