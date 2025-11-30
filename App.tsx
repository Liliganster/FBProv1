import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { AppErrorBoundary } from './components/GranularErrorBoundary';
import {
  LuLayoutDashboard as LayoutDashboard,
  LuCar as Car,
  LuFolderOpen as FolderOpen,
  LuFileText as FileText,
  LuStar as Star,
  LuMenu as Menu,
  LuX as X,
  LuCalendarDays as CalendarDays,
  LuRoute as Route,
  LuRocket as Rocket,
  LuSettings as Settings,
  LuLogOut as LogOut,
} from 'react-icons/lu';
const Dashboard = lazy(() => import('./components/Dashboard'));
const TripsView = lazy(() => import('./components/TripsView'));
const ProjectsView = lazy(() => import('./components/ProjectsView'));
const SettingsView = lazy(() => import('./components/Settings'));
const ReportsView = lazy(() => import('./components/ReportsView'));
const CalendarView = lazy(() => import('./components/CalendarView'));
const AdvancedView = lazy(() => import('./components/AdvancedView'));
const PlansView = lazy(() => import('./components/PlansView'));
import useTranslation from './hooks/useTranslation';
import { useMobile } from './hooks/useMediaQuery';
import { View, PersonalizationSettings } from './types';

// Extendemos View para incluir la ruta de autenticación
type ExtendedView = View | 'auth-callback';
import useUserProfile from './hooks/useUserProfile';
import Avatar from './components/Avatar';
const AuthCallback = lazy(() => import('./components/AuthCallback'));
// FIX: Changed to a named import for useAuth, as it's not a default export.
import { useAuth } from './hooks/useAuth';

// Added explicit type for useAuth return to fix "Property 'user' does not exist on type '{}'" error
type AuthHookReturn = {
  user: { id: string } | null;
  logout: () => void;
};

const App: React.FC = () => {
  const { user, logout } = useAuth() as AuthHookReturn;

  // Helper function to get view from URL
  const getViewFromUrl = (): View | 'auth-callback' => {
    let path = window.location.pathname;
    const validViews: View[] = ['dashboard', 'trips', 'projects', 'reports', 'calendar', 'advanced', 'settings', 'plans'];

    // Clean up any repeated /index.html in the path
    path = path.replace(/\/index\.html/g, '');

    if (path === '/' || path === '') return 'dashboard';

    // Check for OAuth callback path (con o sin query params o hash)
    if (path.includes('/auth/callback') || path.startsWith('/auth/callback')) {
      return 'auth-callback';
    }

    // Extract the view name, handling multiple slashes
    const pathParts = path.split('/').filter(part => part !== '' && part !== 'index.html');
    const viewFromPath = pathParts[pathParts.length - 1] as View;

    return validViews.includes(viewFromPath) ? viewFromPath : 'dashboard';
  };

  // Helper function to update URL without page reload
  const updateUrlForView = (view: ExtendedView) => {
    // No actualizar la URL si estamos en la ruta de callback
    if (view === 'auth-callback') return;
    
    const path = view === 'dashboard' ? '/' : `/${view}`;
    if (window.location.pathname !== path) {
      window.history.pushState({ view }, '', path);
    }
  };

  const [currentView, setCurrentView] = useState<ExtendedView>(() => {
    // First try to get view from URL
    const urlView = getViewFromUrl();
    
    // Special case: auth callback
    if (urlView === 'auth-callback') return urlView;
    
    // If there's a specific view in the URL (not dashboard/root), use it
    if (urlView !== 'dashboard' && window.location.pathname !== '/' && window.location.pathname !== '') {
      const validViews: View[] = ['dashboard', 'trips', 'projects', 'reports', 'calendar', 'advanced', 'settings', 'plans'];
      if (validViews.includes(urlView as View)) {
        return urlView as View;
      }
    }
    
    // For root path or invalid paths, always start with dashboard
    // Don't restore from localStorage on initial load to avoid 404s
    return 'dashboard';
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (!user) return false;
    return localStorage.getItem(`fahrtenbuch_sidebarCollapsed_${user.id}`) === 'true';
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  
  // Hook para detectar si es dispositivo móvil
  const isMobile = useMobile();

  // Handle body overflow when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.classList.add('mobile-menu-open');
    } else {
      document.body.classList.remove('mobile-menu-open');
    }
    return () => {
      document.body.classList.remove('mobile-menu-open');
    };
  }, [mobileMenuOpen]);

  const theme: 'dark' = 'dark';
  
  const { t } = useTranslation();
  const { userProfile } = useUserProfile();
  
  const [personalization, setPersonalization] = useState<PersonalizationSettings>({
      backgroundImage: '',
      uiTransparency: 0.2,
      uiBlur: 16,
      backgroundBlur: 0,
  });

  // Load personalization settings on mount/user change
  useEffect(() => {
    if (user) {
        const savedSettings = localStorage.getItem(`fahrtenbuch_personalization_${user.id}`);
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                // Basic validation
                if (typeof parsed.backgroundImage === 'string' && typeof parsed.uiTransparency === 'number' && typeof parsed.uiBlur === 'number') {
                    // Add backgroundBlur if missing for backwards compatibility
                    if (typeof parsed.backgroundBlur !== 'number') {
                        parsed.backgroundBlur = 0;
                    }
                    setPersonalization(parsed);
                } else {
                    throw new Error("Invalid settings format");
                }
            } catch (e) {
                console.error("Failed to parse personalization settings, resetting to default.", e);
                setPersonalization({ backgroundImage: '', uiTransparency: 0.2, uiBlur: 16, backgroundBlur: 0 });
            }
        } else {
            // Reset to default if nothing is saved for this user
            setPersonalization({ backgroundImage: '', uiTransparency: 0.2, uiBlur: 16, backgroundBlur: 0 });
        }
    }
  }, [user]);

  // Save settings when personalization state changes
  useEffect(() => {
      if (user) {
          localStorage.setItem(`fahrtenbuch_personalization_${user.id}`, JSON.stringify(personalization));
      }
  }, [personalization, user]);

  // Clean up malformed URLs on mount and sync view/URL
  useEffect(() => {
    const currentPath = window.location.pathname;

    // No limpiar URLs si estamos en auth-callback, dejar que Supabase procese primero
    if (currentPath.includes('/auth/callback')) {
      return;
    }

    if (currentPath.includes('/index.html') || currentPath.includes('//')) {
      const view = getViewFromUrl();
      const cleanPath = view === 'dashboard' ? '/' : `/${view}`;
      window.history.replaceState({ view }, '', cleanPath);
    }

    // Solo actualizar URL si no estamos en auth-callback
    // Guardar en localStorage solo cuando el usuario navega activamente, no en carga inicial
    if (currentView !== 'auth-callback') {
      updateUrlForView(currentView);
      
      // Solo guardar en localStorage después de la carga inicial
      if (user && currentPath !== '/') {
        localStorage.setItem(`fahrtenbuch_currentView_${user.id}`, currentView);
      }
    }
  }, [currentView, user]);

  // Handle browser navigation (back/forward buttons) without recrear el listener cada cambio de vista
  useEffect(() => {
    // Garantiza que el estado inicial exista una sola vez
    if (!window.history.state) {
      window.history.replaceState({ view: currentView }, '', currentView === 'dashboard' ? '/' : `/${currentView}`);
    }

    const handlePopState = (event: PopStateEvent) => {
      const view = (event.state?.view || getViewFromUrl()) as View;
      // Evita setState redundante que provoca re-renders innecesarios
      setCurrentView(prev => (prev === view ? prev : view));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // Intencionalmente sin dependencia de currentView para no recrear el listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update page title based on current view
  useEffect(() => {
    const getPageTitle = (view: ExtendedView): string => {
      if (view === 'auth-callback') {
        return 'Autenticación - Fahrtenbuch Pro';
      }
      
      const titles = {
        dashboard: t('nav_dashboard'),
        trips: t('nav_trips'),
        projects: t('nav_projects'),
        reports: t('nav_reports'),
        calendar: t('nav_calendar'),
        advanced: t('nav_advanced'),
        settings: t('nav_settings'),
        plans: 'Planes'
      };
      return `${titles[view]} - Fahrtenbuch Pro`;
    };

    document.title = getPageTitle(currentView);
  }, [currentView, t]);
  
  useEffect(() => {
    if (user) {
      localStorage.setItem(`fahrtenbuch_sidebarCollapsed_${user.id}`, String(sidebarCollapsed));
    }
  }, [sidebarCollapsed, user]);

  // Professional dark theme styling
  useEffect(() => {
    const body = document.body;
    body.classList.remove('text-gray-900', 'theme-light');
    body.classList.add('text-on-surface-dark', 'theme-dark');

    body.style.transition = 'all 0.3s ease-in-out';

    if (personalization.backgroundImage && personalization.backgroundBlur === 0) {
      body.style.backgroundImage = `url(${personalization.backgroundImage})`;
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
      body.style.backgroundAttachment = 'fixed';
      body.style.backgroundColor = '#0a0a0a';
    } else {
      body.style.backgroundImage = 'linear-gradient(135deg, #111827 0%, #8fbf99 100%)';
      body.style.backgroundAttachment = 'fixed';
      body.style.backgroundColor = '#0a0a0a';
    }
  }, [personalization.backgroundImage, personalization.backgroundBlur]);


  const renderView = () => {
    // Si estamos en la ruta de callback de OAuth, mostramos el componente AuthCallback
    if (currentView === 'auth-callback') {
      return <AuthCallback />;
    }
    
    const commonProps = { personalization, theme };

    const withErrorBoundary = (component: React.ReactNode, viewName: string) => (
      <AppErrorBoundary onError={(error) => { console.error(`[ErrorBoundary:${viewName}]`, error); }}>
        {component}
      </AppErrorBoundary>
    );

    switch (currentView) {
      case 'dashboard':
        return withErrorBoundary(<Dashboard setCurrentView={setCurrentView} {...commonProps} />, 'Dashboard');
      case 'trips':
        return withErrorBoundary(<TripsView {...commonProps} />, 'Trips');
      case 'projects':
        return withErrorBoundary(<ProjectsView setCurrentView={setCurrentView} {...commonProps} />, 'Projects');
      case 'reports':
        return withErrorBoundary(<ReportsView {...commonProps} />, 'Reports');
      case 'calendar':
        return withErrorBoundary(<CalendarView setCurrentView={setCurrentView} {...commonProps} />, 'Calendar');
      case 'settings':
        return withErrorBoundary(<SettingsView 
            setCurrentView={setCurrentView} 
            personalization={personalization}
            setPersonalization={setPersonalization}
            theme={theme}
        />, 'Settings');
      case 'plans':
        return withErrorBoundary(<PlansView setCurrentView={setCurrentView} {...commonProps} />, 'Plans');
      case 'advanced':
        return withErrorBoundary(<AdvancedView {...commonProps} />, 'Advanced');
      default:
        return withErrorBoundary(<Dashboard setCurrentView={setCurrentView} {...commonProps} />, 'Dashboard');
    }
  };

  const navItems = [
    { view: 'dashboard', label: t('nav_dashboard'), icon: <LayoutDashboard size={20} /> },
    { view: 'trips', label: t('nav_trips'), icon: <Route size={20} /> },
    { view: 'projects', label: t('nav_projects'), icon: <FolderOpen size={20} /> },
    { view: 'reports', label: t('nav_reports'), icon: <FileText size={20} /> },
    { view: 'calendar', label: t('nav_calendar'), icon: <CalendarDays size={20} /> },
    { view: 'advanced', label: t('nav_advanced'), icon: <Rocket size={20} /> },
  ];
  
  const navStyle = {
    backgroundColor: `rgba(0, 0, 0, ${1 - personalization.uiTransparency})`,
    backdropFilter: `blur(${personalization.uiBlur}px)`,
  };

  const renderSidebarContent = () => (
    <>
      <div className={`p-6 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} border-b border-glass`}>
        {!sidebarCollapsed && (
          <h1 className="text-xl font-bold text-white">
            FahrtenBuch Pro
          </h1>
        )}
        <button
          onClick={() => {
            setSidebarCollapsed(!sidebarCollapsed);
            setMobileMenuOpen(false);
          }}
          className="p-2 rounded-smooth transition-all duration-300 transform hover:scale-105 hover:bg-gradient-surface hover:shadow-brand/20 hover:shadow-md"
        >
          {sidebarCollapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
      </div>

      <div className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => {
              setCurrentView(item.view as View);
              setMobileMenuOpen(false);
            }}
            title={sidebarCollapsed ? item.label : undefined}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-smooth transition-all duration-300 transform ${sidebarCollapsed ? 'justify-center' : ''} ${
              currentView === item.view
                ? 'text-white scale-[1.02] shadow-lg'
                : 'hover:bg-gradient-surface text-on-surface-secondary hover:text-on-surface-dark hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/20'
            }`}
            style={currentView === item.view ? { backgroundColor: 'rgba(26, 26, 26, 0.8)' } : undefined}
          >
            {item.icon}
            {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
          </button>
        ))}
        </div>

        <div className="p-4 space-y-2 border-t border-glass">

          <button
            onClick={() => {
              setCurrentView('settings');
              setMobileMenuOpen(false);
            }}
            title={sidebarCollapsed ? t('nav_settings') : undefined}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-smooth transition-all duration-300 transform ${sidebarCollapsed ? 'justify-center' : ''} ${
              currentView === 'settings'
                ? 'text-white scale-[1.02] shadow-lg'
                : 'hover:bg-gradient-surface text-on-surface-secondary hover:text-on-surface-dark hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/20'
            }`}
            style={currentView === 'settings' ? { backgroundColor: 'rgba(26, 26, 26, 0.8)' } : undefined}
          >
            <Settings size={20} />
            {!sidebarCollapsed && <span className="font-medium">{t('nav_settings')}</span>}
          </button>

        <button
          onClick={logout}
          title={sidebarCollapsed ? t('logout_btn') : undefined}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-smooth transition-all duration-300 transform hover:scale-[1.02] ${sidebarCollapsed ? 'justify-center' : ''}
            hover:bg-gradient-to-r hover:from-red-600/80 hover:to-red-700/80 text-on-surface-secondary hover:text-white hover:shadow-md hover:shadow-red-500/30`}
        >
          <LogOut size={20} />
          {!sidebarCollapsed && <span className="font-medium">{t('logout_btn')}</span>}
        </button>

        <div
          className={`w-full flex items-center gap-3 px-4 pt-4 mt-2 ${sidebarCollapsed ? 'justify-center' : ''}`}
        >
          {userProfile && (
            <>
              <Avatar profile={userProfile} className="w-10 h-10 flex-shrink-0" />
              {!sidebarCollapsed && (
                <div className="flex flex-col items-start overflow-hidden">
                  <p className="font-semibold text-sm truncate w-full text-left text-on-surface-dark">{userProfile.name}</p>
                  <p className="text-xs text-on-surface-secondary">{userProfile.licensePlate || 'N/A'}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div
      className="relative flex flex-col md:flex-row h-screen w-screen overflow-hidden font-sans bg-gradient-dark"
      style={{
        background: personalization.backgroundImage
          ? (personalization.backgroundBlur > 0
              ? 'linear-gradient(135deg, #111827 0%, #8fbf99 100%)'
              : `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.7)), url(${personalization.backgroundImage})`)
          : 'linear-gradient(135deg, #111827 0%, #8fbf99 100%)',
        backgroundSize: personalization.backgroundImage && personalization.backgroundBlur === 0 ? 'cover, cover' : 'cover',
        backgroundPosition: personalization.backgroundImage && personalization.backgroundBlur === 0 ? 'center, center' : 'center',
        backgroundAttachment: personalization.backgroundImage && personalization.backgroundBlur === 0 ? 'fixed, fixed' : 'fixed',
        backgroundRepeat: personalization.backgroundImage && personalization.backgroundBlur === 0 ? 'no-repeat, no-repeat' : 'no-repeat',
      }}
    >
      {/* Overlay for blur effect when needed */}
      {personalization.backgroundImage && personalization.backgroundBlur > 0 && (
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: `url(${personalization.backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            backgroundRepeat: 'no-repeat',
            filter: `blur(${personalization.backgroundBlur}px)`,
          }}
        />
      )}

      {/* Mobile Header with Hamburger Menu */}
      {isMobile && (
      <div className="fixed top-0 left-0 right-0 z-30 bg-gradient-to-br from-white/5 via-blue-400/8 to-blue-500/5 backdrop-blur-xl backdrop-saturate-150 border-b border-white/10 shadow-glass">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-lg font-bold text-white">FahrtenBuch Pro</h1>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-smooth transition-all duration-300 transform hover:scale-105 hover:bg-gradient-surface hover:shadow-brand/20 hover:shadow-md text-white"
          >
            <Menu size={24} />
          </button>
        </div>
      </div>
      )}

      {/* Mobile Menu Overlay */}
      {isMobile && mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 animate-fadeIn"
            onClick={() => setMobileMenuOpen(false)}
          />
          <nav className="fixed top-0 left-0 w-4/5 max-w-sm h-screen z-50 text-on-surface-dark flex flex-col shadow-glass bg-gradient-to-br from-white/5 via-blue-400/8 to-blue-500/5 backdrop-blur-xl backdrop-saturate-150 border-white/10 animate-slideInLeft overflow-y-auto">
            {renderSidebarContent()}
          </nav>
        </>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && (
      <nav
        className={`relative z-10 flex
        ${sidebarCollapsed ? 'w-20' : 'w-72'}
        text-on-surface-dark border-r
        transition-all duration-300 flex-col shadow-glass
        bg-gradient-to-br from-white/5 via-blue-400/8 to-blue-500/5
        backdrop-blur-xl backdrop-saturate-150
        border-white/10
      `}>
        {renderSidebarContent()}
      </nav>
      )}
      <main className={`relative z-10 flex-1 overflow-y-auto overflow-x-hidden bg-transparent w-full h-full ${isMobile ? 'pt-20 px-4 pb-4' : 'p-8'}`}>
        <div className="w-full h-full">
          <Suspense fallback={<div className="text-sm text-on-surface-dark-secondary">Loading…</div>}>
            {renderView()}
          </Suspense>
        </div>
      </main>
    </div>
  );
};

export default App;
