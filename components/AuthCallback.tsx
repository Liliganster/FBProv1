import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

/**
 * Componente que maneja el callback de autenticación OAuth
 * Procesa la URL manualmente para evitar bucles infinitos
 */
const AuthCallback: React.FC = () => {
  const { isLoading, user } = useAuth();
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    // Prevenir procesamiento múltiple
    if (processed) return;
    
    // Procesar el callback OAuth manualmente
    const processOAuthCallback = async () => {
      try {
        const hash = window.location.hash;
        const query = window.location.search;
        
        console.log('AuthCallback: Processing OAuth callback', { hash, query });
        
        if (hash || query) {
          // Marcar como procesado antes de hacer la petición
          setProcessed(true);
          
          // Notificar a Supabase del callback
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('AuthCallback: Error getting session', error);
          } else {
            console.log('AuthCallback: Session obtained successfully', data);
          }
          
          // Esperar un momento para que el contexto de Auth se actualice
          setTimeout(() => {
            // Limpiar la URL y redirigir a la página principal
            window.location.href = '/';
          }, 500);
        } else if (!isLoading) {
          // Si no hay hash ni query, redirigir inmediatamente
          console.log('AuthCallback: No OAuth data, redirecting to home');
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Error processing OAuth callback:', error);
        // En caso de error, redirigir de todas formas
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      }
    };

    if (!isLoading) {
      processOAuthCallback();
    }
  }, [isLoading, processed]);

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