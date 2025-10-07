import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

// Bandera global para prevenir múltiples procesamientos en toda la aplicación
const CALLBACK_PROCESSED_KEY = 'oauth_callback_processed';

/**
 * Componente que maneja el callback de autenticación OAuth
 * Simplificado para evitar bucles infinitos - deja que Supabase maneje todo automáticamente
 */
const AuthCallback: React.FC = () => {
  const { isLoading, user } = useAuth();
  const hasRedirected = useRef(false);
  const [processingStartTime] = useState(Date.now());
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Ejecutar solo una vez al montar
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Marcar que estamos procesando este callback
    const callbackProcessed = sessionStorage.getItem(CALLBACK_PROCESSED_KEY);

    // Si ya fue procesado en esta sesión, redirigir inmediatamente
    if (callbackProcessed === 'true') {
      console.log('AuthCallback: Already processed, redirecting immediately');
      window.location.replace('/');
      return;
    }

    // Marcar como procesado para evitar loops en refresh
    sessionStorage.setItem(CALLBACK_PROCESSED_KEY, 'true');

    // Limpiar el hash inmediatamente para que no se reprocese
    if (window.location.hash) {
      const cleanUrl = window.location.pathname + window.location.search;
      window.history.replaceState(null, '', cleanUrl);
    }
  }, []);

  useEffect(() => {
    // Prevenir múltiples redirecciones
    if (hasRedirected.current) return;

    // Solo redirigir cuando termine de cargar
    if (!isLoading) {
      // Si el usuario ya está autenticado, redirigir a home
      if (user) {
        console.log('AuthCallback: User authenticated, redirecting to home');
        hasRedirected.current = true;

        // Limpiar la marca antes de redirigir para permitir futuros logins
        setTimeout(() => {
          sessionStorage.removeItem(CALLBACK_PROCESSED_KEY);
          window.location.replace('/');
        }, 100);
      } else {
        // Esperar hasta 5 segundos para que Supabase procese
        const elapsedTime = Date.now() - processingStartTime;
        if (elapsedTime < 5000) {
          console.log('AuthCallback: Waiting for authentication to complete...');
          return;
        }

        // Si después de 5 segundos no hay usuario, redirigir a login
        console.log('AuthCallback: No user found after auth, redirecting to login');
        hasRedirected.current = true;

        sessionStorage.removeItem(CALLBACK_PROCESSED_KEY);
        setTimeout(() => {
          window.location.replace('/');
        }, 100);
      }
    }
  }, [isLoading, user, processingStartTime]);

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