import React, { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

/**
 * Componente que maneja el callback de autenticación OAuth
 * Procesa la URL manualmente para evitar bucles infinitos
 */
const AuthCallback: React.FC = () => {
  const { isLoading } = useAuth();

  useEffect(() => {
    // Procesar el callback OAuth manualmente
    const processOAuthCallback = async () => {
      try {
        // Obtener el hash o la URL completa
        const hash = window.location.hash;
        const query = window.location.search;
        
        if (hash || query) {
          // Notificar a Supabase del callback sin actualizar la URL para evitar bucles
          await supabase.auth.getSession();
          
          // Redirigir a la página principal después de procesar
          window.history.replaceState({}, document.title, '/');
        }
      } catch (error) {
        console.error('Error processing OAuth callback:', error);
      }
    };

    if (!isLoading) {
      processOAuthCallback();
    }
  }, [isLoading]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Completando autenticación...</h1>
        <p className="text-gray-500">Serás redirigido en un momento.</p>
        <div className="mt-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary mx-auto"></div>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;