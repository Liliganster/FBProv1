import React, { useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';

/**
 * Componente que maneja el callback de autenticación OAuth
 * Simplificado para evitar bucles infinitos - deja que Supabase maneje todo automáticamente
 */
const AuthCallback: React.FC = () => {
  const { isLoading, user } = useAuth();
  const hasRedirected = useRef(false);
  const redirectTimer = useRef<number | null>(null);

  useEffect(() => {
    // Limpiar el hash de la URL para que no se reprocese en refresh
    if (window.location.hash && !hasRedirected.current) {
      const cleanUrl = window.location.pathname + window.location.search;
      window.history.replaceState(null, '', cleanUrl);
    }

    // Solo redirigir cuando termine de cargar Y tengamos un usuario autenticado
    if (!isLoading && !hasRedirected.current) {
      if (user) {
        console.log('AuthCallback: User authenticated, redirecting to home');
        hasRedirected.current = true;
        
        // Usar replace en lugar de navigate para no crear entrada en historial
        redirectTimer.current = window.setTimeout(() => {
          window.location.replace('/');
        }, 500);
      } else {
        // Si no hay usuario después de cargar, también redirigir
        // (Supabase no pudo autenticar, probablemente token expirado o inválido)
        console.log('AuthCallback: No user found, redirecting to home');
        hasRedirected.current = true;
        
        redirectTimer.current = window.setTimeout(() => {
          window.location.replace('/');
        }, 500);
      }
    }

    // Cleanup del timer al desmontar
    return () => {
      if (redirectTimer.current !== null) {
        clearTimeout(redirectTimer.current);
      }
    };
  }, [isLoading, user]);

  return (
    <div className="flex items-center justify-center h-screen bg-background-dark text-on-surface-dark">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Completando autenticación...</h1>
        <p className="text-gray-400 mb-6">
          {isLoading ? 'Verificando credenciales...' : 'Redirigiendo...'}
        </p>
        <div className="mt-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;