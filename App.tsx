import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Car,
  FolderOpen,
  FileText,
  Star,
  Sun,
  Moon,
  Menu,
  X,
  CalendarDays,
  Settings,
  LogOut,
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import TripsView from './components/TripsView';
import ProjectsView from './components/ProjectsView';
import SettingsView from './components/Settings';
import ReportsView from './components/ReportsView';
import CalendarView from './components/CalendarView';
import AdvancedView from './components/AdvancedView';
import useTranslation from './hooks/useTranslation';
import { View, PersonalizationSettings } from './types';

// Extendemos View para incluir la ruta de autenticación
type ExtendedView = View | 'auth-callback';
import useUserProfile from './hooks/useUserProfile';
import Avatar from './components/Avatar';
import AuthCallback from './components/AuthCallback';
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
    const validViews: View[] = ['dashboard', 'trips', 'projects', 'reports', 'calendar', 'advanced', 'settings'];
    
    // Clean up any repeated /index.html in the path
    path = path.replace(/\/index\.html/g, '');
    
    if (path === '/' || path === '') return 'dashboard';
    
    // Check for OAuth callback path
    if (path.startsWith('/auth/callback')) {
      return 'auth-callback';
    }
    
    // Extract the view name, handling multiple slashes
    const pathParts = path.split('/').filter(part => part !== '');
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
    if (urlView === 'auth-callback') return urlView;
    if (urlView !== 'dashboard') return urlView as View;
    
    // Fallback to localStorage only if user is available
    if (user) {
      const savedView = localStorage.getItem(`fahrtenbuch_currentView_${user.id}`) as View;
      const validViews: View[] = ['dashboard', 'trips', 'projects', 'reports', 'calendar', 'advanced', 'settings'];
      return savedView && validViews.includes(savedView) ? savedView : 'dashboard';
    }
    
    return 'dashboard';
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (!user) return false;
    return localStorage.getItem(`fahrtenbuch_sidebarCollapsed_${user.id}`) === 'true';
  });
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (!user) return 'dark';
    const savedTheme = localStorage.getItem(`fahrtenbuch_theme_${user.id}`) as 'light' | 'dark';
    return savedTheme || 'dark';
  });
  
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
    if (currentPath.includes('/index.html') || currentPath.includes('//')) {
      const view = getViewFromUrl();
      const cleanPath = view === 'dashboard' ? '/' : `/${view}`;
      window.history.replaceState({ view }, '', cleanPath);
    }
    
    // Solo actualizar localStorage y URL si no estamos en auth-callback
    if (user && currentView !== 'auth-callback') {
      localStorage.setItem(`fahrtenbuch_currentView_${user.id}`, currentView);
      updateUrlForView(currentView);
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
        settings: t('nav_settings')
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

  // Consolidated effect to manage all <body> styling for theme and background
  useEffect(() => {
    const body = document.body;
    if (user) {
      localStorage.setItem(`fahrtenbuch_theme_${user.id}`, theme);
    }

    // 1. Set base theme classes for text color
    if (theme === 'light') {
        body.classList.remove('text-on-surface-dark');
        body.classList.add('text-gray-900');
    } else {
        body.classList.remove('text-gray-900');
        body.classList.add('text-on-surface-dark');
    }

    // 2. Handle the background (image or color)
    body.style.transition = 'background 0.5s ease-in-out';

    if (personalization.backgroundImage) {
        // When there's an image, set it and remove any background color classes
        body.classList.remove('bg-background-dark', 'bg-gray-100');
        body.style.backgroundImage = 'none'; // Remove from body, we'll use a separate element
        body.style.backgroundColor = ''; // Clear inline color
    } else {
        // When there's no image, clear image styles and apply theme background color class
        body.style.backgroundImage = 'none';
        if (theme === 'light') {
            body.classList.remove('bg-background-dark');
            body.classList.add('bg-gray-100');
        } else {
            body.classList.remove('bg-gray-100');
            body.classList.add('bg-background-dark');
        }
    }
  }, [theme, personalization.backgroundImage, personalization.backgroundBlur, user]);


  const renderView = () => {
    // Si estamos en la ruta de callback de OAuth, mostramos el componente AuthCallback
    if (currentView === 'auth-callback') {
      return <AuthCallback />;
    }
    
    const commonProps = { personalization, theme };
    switch (currentView) {
      case 'dashboard':
        return <Dashboard setCurrentView={setCurrentView} {...commonProps} />;
      case 'trips':
        return <TripsView {...commonProps} />;
      case 'projects':
        return <ProjectsView setCurrentView={setCurrentView} {...commonProps} />;
      case 'reports':
        return <ReportsView {...commonProps} />;
      case 'calendar':
        return <CalendarView setCurrentView={setCurrentView} {...commonProps} />;
      case 'settings':
        return <SettingsView 
            setCurrentView={setCurrentView} 
            personalization={personalization}
            setPersonalization={setPersonalization}
            theme={theme}
        />;
      case 'advanced':
        return <AdvancedView {...commonProps} />;
      default:
        return <Dashboard setCurrentView={setCurrentView} {...commonProps} />;
    }
  };

  const navItems = [
    { view: 'dashboard', label: t('nav_dashboard'), icon: <LayoutDashboard size={20} /> },
    { view: 'trips', label: t('nav_trips'), icon: <Car size={20} /> },
    { view: 'projects', label: t('nav_projects'), icon: <FolderOpen size={20} /> },
    { view: 'reports', label: t('nav_reports'), icon: <FileText size={20} /> },
    { view: 'calendar', label: t('nav_calendar'), icon: <CalendarDays size={20} /> },
    { view: 'advanced', label: t('nav_advanced'), icon: <Star size={20} /> },
  ];
  
  const navStyle = {
      backgroundColor: theme === 'dark' 
          ? `rgba(15, 23, 42, ${1 - personalization.uiTransparency})` 
          : `rgba(255, 255, 255, ${1 - personalization.uiTransparency})`,
      backdropFilter: `blur(${personalization.uiBlur}px)`,
  };

  return (
    <div className="relative flex h-screen font-sans bg-transparent">
      {/* Background image with independent blur */}
      {personalization.backgroundImage && (
        <div 
          className="fixed inset-0 -z-10"
          style={{
            backgroundImage: `url(${personalization.backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            filter: personalization.backgroundBlur > 0 ? `blur(${personalization.backgroundBlur}px)` : 'none'
          }}
        />
      )}
      <nav 
        style={navStyle}
        className={`
        ${sidebarCollapsed ? 'w-20' : 'w-72'}
        ${theme === 'dark' 
          ? 'border-slate-800/50 text-white' 
          : 'border-gray-200/50 text-gray-900'
        }
        border-r transition-all duration-300 flex flex-col
      `}>
        <div className={`p-6 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} border-b ${theme === 'dark' ? 'border-slate-800/50' : 'border-gray-200/50'}`}>
          {!sidebarCollapsed && (
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              FahrtenBuch Pro
            </h1>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`p-2 rounded-lg ${
              theme === 'dark' ? 'hover:bg-slate-800/50' : 'hover:bg-gray-100'
            } transition-colors`}
          >
            {sidebarCollapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
        </div>

        <div className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view as View)}
              title={sidebarCollapsed ? item.label : undefined}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                ${sidebarCollapsed ? 'justify-center' : ''}
                ${currentView === item.view
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/20'
                  : theme === 'dark'
                    ? 'hover:bg-slate-800/50 text-gray-400 hover:text-white'
                    : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                }
              `}
            >
              {item.icon}
              {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </div>

        <div className={`p-4 space-y-2 border-t ${theme === 'dark' ? 'border-slate-800/50' : 'border-gray-200/50'}`}>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={sidebarCollapsed ? t(theme === 'dark' ? 'theme_toggle_light' : 'theme_toggle_dark') : undefined}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${sidebarCollapsed ? 'justify-center' : ''} ${
              theme === 'dark' ? 'hover:bg-slate-800/50 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            {!sidebarCollapsed && <span>{t(theme === 'dark' ? 'theme_toggle_light' : 'theme_toggle_dark')}</span>}
          </button>
          
          <button
                onClick={() => setCurrentView('settings')}
                title={sidebarCollapsed ? t('nav_settings') : undefined}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${sidebarCollapsed ? 'justify-center' : ''} ${
                    currentView === 'settings'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/20'
                    : theme === 'dark'
                        ? 'hover:bg-slate-800/50 text-gray-400 hover:text-white'
                        : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                }`}
            >
                <Settings size={20} />
                {!sidebarCollapsed && <span className="font-medium">{t('nav_settings')}</span>}
            </button>
            
            <button
                onClick={logout}
                title={sidebarCollapsed ? t('logout_btn') : undefined}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${sidebarCollapsed ? 'justify-center' : ''} ${
                    theme === 'dark'
                        ? 'hover:bg-slate-800/50 text-gray-400 hover:text-white'
                        : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                }`}
            >
                <LogOut size={20} />
                {!sidebarCollapsed && <span className="font-medium">{t('logout_btn')}</span>}
            </button>

            <div 
                className={`w-full flex items-center gap-3 px-4 pt-4 mt-2 border-t ${theme === 'dark' ? 'border-slate-800/50' : 'border-gray-200/50'} ${sidebarCollapsed ? 'justify-center' : ''}`}
            >
                {userProfile && (
                    <>
                        <Avatar profile={userProfile} className="w-10 h-10 flex-shrink-0" />
                        {!sidebarCollapsed && (
                            <div className="flex flex-col items-start overflow-hidden">
                                <p className="font-semibold text-sm truncate w-full text-left">{userProfile.name}</p>
                                <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{userProfile.licensePlate || 'N/A'}</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
      </nav>
      <main className="flex-1 p-8 overflow-y-auto bg-transparent">
        {renderView()}
      </main>
    </div>
  );
};

export default App;
