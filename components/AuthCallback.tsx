import React, { useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';

/**
 * Componente que maneja el callback de autenticacion OAuth
 * Simplificado para evitar bucles infinitos - deja que Supabase maneje todo automaticamente
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
      hasRedirected.current = true;
      redirectTimer.current = window.setTimeout(() => {
        window.location.replace('/');
      }, 500);
    }

    // Cleanup del timer al desmontar
    return () => {
      if (redirectTimer.current !== null) {
        clearTimeout(redirectTimer.current);
      }
    };
  }, [isLoading, user]);

  return (
    <div className="flex items-center justify-center min-h-screen relative overflow-hidden">
      {/* Background image to keep consistency with LoginView */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage:
            'url(/images/urbanbuzz_image_of_a_tv_camera_setup_in_a_white_background_the__188e8b3b-4b30-41b8-bb2a-927e4cb4d0ef.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      {/* Dark overlay only on background */}
      <div className="absolute inset-0 z-10 bg-gradient-to-br from-black/60 via-black/40 to-black/60" />

      <div className="relative z-20 text-center text-white">
        <h1 className="text-2xl font-bold mb-4">Completando autenticación...</h1>
        <p className="text-gray-300 mb-6">
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

