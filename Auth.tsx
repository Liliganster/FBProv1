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
      <div className="min-h-screen w-full flex items-center justify-center bg-background-dark text-on-surface-dark px-4">
        <div className="max-w-md w-full bg-black/30 border border-white/10 rounded-xl p-8 shadow-xl text-center space-y-4">
          <LoaderIcon className="mx-auto h-10 w-10 animate-spin text-blue-400" />
          <h1 className="text-xl font-semibold">Configuracion requerida</h1>
          <p className="text-sm text-on-surface-dark-secondary">
            {configError}
          </p>
          <p className="text-xs text-on-surface-dark-secondary">
            Define las variables <code className="font-mono">VITE_SUPABASE_URL</code> y <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> en tu <code className="font-mono">.env.local</code> o en las variables de entorno de Vercel y vuelve a recargar.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <LoadingDiagnostics 
        stage="Verificando autenticacion" 
        details="Conectando con Supabase y validando sesion de usuario"
      />
    );
  }

  if (!user) {
    return <LoginView />;
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
