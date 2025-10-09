import React from 'react';
import App from './App';
import LoginView from './components/LoginView';
import { useAuth } from './hooks/useAuth';
import { LedgerTripsProvider } from './context/SupabaseLedgerTripsContext';
import { UserProfileProvider } from './context/SupabaseUserProfileContext';
import { GoogleCalendarProvider } from './context/GoogleCalendarContext';
import { ProjectsProvider } from './context/ProjectsContext';
import { RouteTemplatesProvider } from './context/SupabaseRouteTemplatesContext';
import { LoaderIcon } from './components/Icons';
import LoadingDiagnostics from './components/LoadingDiagnostics';

const Auth: React.FC = () => {
  const { user, isLoading, configError } = useAuth();

  if (configError) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-dark text-on-surface-dark px-4">
        <div className="max-w-md w-full bg-gradient-glass border-glass rounded-organic p-8 shadow-glass text-center space-y-4 backdrop-blur-glass">
          <LoaderIcon className="mx-auto h-10 w-10 animate-spin text-brand-primary" />
          <h1 className="text-xl font-semibold text-white">Configuración requerida</h1>
          <p className="text-sm text-on-surface-secondary">
            {configError}
          </p>
          <p className="text-xs text-on-surface-tertiary">
            Define las variables <code className="font-mono bg-surface-dark px-2 py-1 rounded-subtle">VITE_SUPABASE_URL</code> y <code className="font-mono bg-surface-dark px-2 py-1 rounded-subtle">VITE_SUPABASE_ANON_KEY</code> en tu <code className="font-mono bg-surface-dark px-2 py-1 rounded-subtle">.env.local</code> o en las variables de entorno de Vercel y vuelve a recargar.
          </p>
        </div>
      </div>
    );
  }

  // Mostrar siempre la pantalla de login (con foto) cuando no hay usuario,
  // incluso durante la carga inicial, para evitar el "doble" de pantallas.
  if (!user) {
    // Force a clean render of LoginView
    return <LoginView key="main-login" />;
  }

  // En caso de que haya un usuario pero el contexto aún esté cargando,
  // mostramos un loader. Esto no afecta al flujo de login sin usuario.
  if (isLoading) {
    return (
      <LoadingDiagnostics 
        stage="Verificando autenticacion" 
        details="Conectando con Supabase y validando sesion de usuario"
      />
    );
  }

  // Providers that depend on a logged-in user are wrapped here
  // All providers now use Supabase for cloud storage and sync
  return (
    <UserProfileProvider>
      <GoogleCalendarProvider>
        <ProjectsProvider>
          <RouteTemplatesProvider>
            <LedgerTripsProvider>
              <App />
            </LedgerTripsProvider>
          </RouteTemplatesProvider>
        </ProjectsProvider>
      </GoogleCalendarProvider>
    </UserProfileProvider>
  );
};

export default Auth;
