import React, { useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';

/**
 * Componente que maneja el callback de autenticación OAuth
 * Simplificado para evitar bucles infinitos - deja que Supabase maneje todo automáticamente
 */
const AuthCallback: React.FC = () => {
  const { isLoading, user } = useAuth();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Prevenir múltiples redirecciones
    if (hasRedirected.current) return;

    // Solo redirigir cuando termine de cargar
    if (!isLoading) {
      // Si el usuario ya está autenticado, redirigir a home
      if (user) {
        console.log('AuthCallback: User authenticated, redirecting to home');
        hasRedirected.current = true;

        // Limpiar la URL completamente (hash, search params) y navegar sin recarga
        const cleanUrl = new URL('/', window.location.origin);
        window.history.replaceState({ view: 'dashboard' }, document.title, cleanUrl.pathname);

        // Forzar la navegación pero usando replace para no causar bucle
        window.location.replace('/');
      } else {
        // Si después de procesar el callback no hay usuario, algo salió mal
        console.log('AuthCallback: No user found after auth, redirecting to login');
        hasRedirected.current = true;

        // Esperar un poco más para dar tiempo a que Supabase procese
        setTimeout(() => {
          const cleanUrl = new URL('/', window.location.origin);
          window.history.replaceState({ view: 'dashboard' }, document.title, cleanUrl.pathname);
          window.location.replace('/');
        }, 3000);
      }
    }
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