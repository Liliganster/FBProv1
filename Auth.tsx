
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
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <LoadingDiagnostics 
        stage="Verificando autenticación" 
        details="Conectando con Supabase y validando sesión de usuario"
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