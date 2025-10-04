
import React from 'react';
import App from './App';
import LoginView from './components/LoginView';
import { useAuth } from './hooks/useAuth';
import { LedgerTripsProvider } from './context/LedgerTripsContext';
import { UserProfileProvider } from './context/UserProfileContext';
import { GoogleCalendarProvider } from './context/GoogleCalendarContext';
import { LoaderIcon } from './components/Icons';

const Auth: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-dark">
        <div className="text-center">
          <LoaderIcon className="w-12 h-12 text-brand-primary animate-spin mx-auto mb-4" />
          <p className="text-on-surface-dark">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  // Providers that depend on a logged-in user are wrapped here
  return (
    <UserProfileProvider>
      <GoogleCalendarProvider>
        <LedgerTripsProvider>
          <App />
        </LedgerTripsProvider>
      </GoogleCalendarProvider>
    </UserProfileProvider>
  );
};

export default Auth;