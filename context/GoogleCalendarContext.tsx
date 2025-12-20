
import React, { createContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import useToast from '../hooks/useToast';
import useUserProfile from '../hooks/useUserProfile';
import { Trip } from '../types';
import useTranslation from '../hooks/useTranslation';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

interface GoogleApiContextType {
  isInitialized: boolean;
  isSignedIn: boolean;
  calendarProxyReady: boolean;
  calendarProxyChecked: boolean;
  signIn: () => void;
  signOut: () => void;
  calendars: any[];
  fetchEvents: (calendarIds: string[], timeMin: string, timeMax: string) => Promise<any[]>;
  createCalendarEvent: (trip: Trip, projectName: string) => Promise<any>;
  showPicker: (callback: (data: any) => void) => void;
  gapiClient: any;
  refreshCalendars: () => Promise<void>;
}

export const GoogleCalendarContext = createContext<GoogleApiContextType | undefined>(undefined);

// We need Calendar scopes plus Drive read‑only to allow
// Google Picker + Drive file downloads for bulk import.
const SCOPES =
  'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.readonly';
const DISCOVERY_DOCS = [
    'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
];

const GOOGLE_CALENDAR_CLIENT_ID = import.meta.env.VITE_GOOGLE_CALENDAR_CLIENT_ID;
// Dedicated key for Google Picker / Drive.
// No fallback to MAPS key to avoid "developer key not recognized" errors.
const GOOGLE_PICKER_DEVELOPER_KEY = import.meta.env.VITE_GOOGLE_PICKER_API_KEY || '';

export const GoogleCalendarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { userProfile } = useUserProfile();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [calendarProxyReady, setCalendarProxyReady] = useState<boolean>(false);
  const [calendarProxyChecked, setCalendarProxyChecked] = useState<boolean>(false);
  const [calendars, setCalendars] = useState<any[]>([]);
  const [gapiClient, setGapiClient] = useState<any>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const { showToast } = useToast();
  const { t } = useTranslation();
  const manualSignOut = useRef(false);
  const initialAuthCheckPerformed = useRef(false);
  const hasStartedInit = useRef(false); // Prevent double initialization
  
  const GOOGLE_AUTH_STATE_KEY = userProfile ? `fahrtenbuch_google_auth_state_${userProfile.id}` : null;

  useEffect(() => {
    let cancelled = false;
    const checkProxy = async () => {
      try {
        // Health check to ensure the backend proxy is ready for calendar operations.
        // This is crucial because the frontend will delegate API calls (e.g., creating events)
        // to this backend proxy to protect the API key.
        const res = await fetch('/api/google/calendar/events?health=1');
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setCalendarProxyReady(Boolean(data?.ready));
          setCalendarProxyChecked(true);
        }
      } catch (e) {
        // Silently handle API key not configured - only log in dev mode
        if (import.meta.env.DEV) {
          console.warn('[Google Calendar] Backend proxy not available (API key not configured)');
        }
        if (!cancelled) {
          setCalendarProxyReady(false);
          setCalendarProxyChecked(true);
        }
      }
    };
    checkProxy();
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(() => {
    if (!gapiClient) return;
    const token = gapiClient.getToken();
    if (token !== null) {
      manualSignOut.current = true;
      window.google.accounts.oauth2.revoke(token.access_token, () => {});
      gapiClient.setToken(null);
      setIsSignedIn(false);
      setCalendars([]);
      if (GOOGLE_AUTH_STATE_KEY) {
        localStorage.setItem(GOOGLE_AUTH_STATE_KEY, 'signed_out');
      }
    }
  }, [gapiClient, GOOGLE_AUTH_STATE_KEY]);

  useEffect(() => {
    let cancelled = false;
    let timeoutIds: NodeJS.Timeout[] = [];

    // Skip initialization if Google Calendar credentials are not configured or gapi not available
    if (!GOOGLE_CALENDAR_CLIENT_ID || !userProfile || typeof window === 'undefined' || !window.gapi) {
      if (import.meta.env.DEV) {
        console.log('[Google Calendar] Skipping init (server-side only mode):', {
          hasClientId: !!GOOGLE_CALENDAR_CLIENT_ID,
          hasUserProfile: !!userProfile,
          hasGapi: !!(typeof window !== 'undefined' && window.gapi)
        });
      }
      setIsInitialized(false);
      hasStartedInit.current = false;
      return;
    }

    if (!calendarProxyReady) {
      console.log('[Google Calendar] Waiting for backend proxy to be ready...');
      setIsInitialized(false);
      hasStartedInit.current = false;
      return;
    }

    // Prevent double initialization (React StrictMode triggers useEffect twice)
    if (hasStartedInit.current) {
      console.log('[Google Calendar] Already initializing, skipping...');
      return;
    }
    
    hasStartedInit.current = true;
    console.log('[Google Calendar] Starting initialization...');
    const GOOGLE_AUTH_STATE_KEY_INIT = `fahrtenbuch_google_auth_state_${userProfile.id}`;

    const initClients = async () => {
      if (cancelled) return;
      
      try {
        console.log('[Google Calendar] Loading gapi client...');
        await new Promise<void>((resolve, reject) => {
          if (cancelled) {
            reject(new Error('Cancelled'));
            return;
          }
          
          const timeoutId = setTimeout(() => {
            if (!cancelled) reject(new Error('Timeout'));
          }, 5000);
          timeoutIds.push(timeoutId);
          
          window.gapi.load('client:picker', {
            callback: () => {
              clearTimeout(timeoutId);
              if (!cancelled) resolve();
            },
            onerror: (error: any) => {
              clearTimeout(timeoutId);
              if (!cancelled) reject(error);
            },
            timeout: 5000,
            ontimeout: () => {
              clearTimeout(timeoutId);
              if (!cancelled) reject(new Error('Timeout'));
            },
          });
        });

        if (cancelled) return;

        console.log('[Google Calendar] Initializing gapi client...');
        await window.gapi.client.init({
          discoveryDocs: DISCOVERY_DOCS,
        });

        if (cancelled) return;

        await Promise.all([
          window.gapi.client.load('calendar', 'v3'),
          window.gapi.client.load('drive', 'v3'),
        ]);

        if (cancelled) return;
        setGapiClient(window.gapi.client);

        const newtokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CALENDAR_CLIENT_ID,
          scope: SCOPES,
          ux_mode: 'popup', // Force popup mode to avoid redirect_uri issues
          callback: (tokenResponse: any) => {
            if (cancelled) return;
            
            if (tokenResponse.error) {
              const expectedErrors = ['access_denied', 'user_logged_out', 'consent_required', 'interaction_required', 'login_required'];
              if (!expectedErrors.includes(tokenResponse.error)) {
                 showToast(t('toast_gcal_auth_error', { error: tokenResponse.error_description || tokenResponse.error }), 'error');
                 console.error('Google Sign-In Error:', tokenResponse);
              }
              setIsSignedIn(false);
              localStorage.setItem(GOOGLE_AUTH_STATE_KEY_INIT, 'signed_out');
              return;
            }
            if (!tokenResponse.access_token) {
                setIsSignedIn(false);
                localStorage.setItem(GOOGLE_AUTH_STATE_KEY_INIT, 'signed_out');
                return;
            }
            window.gapi.client.setToken(tokenResponse);
            setIsSignedIn(true);
            manualSignOut.current = false; // Reset flag on successful sign-in
            localStorage.setItem(GOOGLE_AUTH_STATE_KEY_INIT, 'signed_in');
          },
          error_callback: (error: any) => {
            if (cancelled) return;
            
            console.error('Google Token Client Error:', error);
            if (error?.type === 'popup_closed') {
                showToast(t('toast_gcal_signin_cancelled'), 'info');
            } else if (error?.type === 'popup_failed_to_open') {
                showToast(t('toast_gcal_popup_failed'), 'error');
            } else {
                showToast(t('toast_gcal_auth_error', { error: error?.type || 'Unknown' }), 'error');
            }
          }
        });
        
        if (cancelled) return;
        setTokenClient(newtokenClient);
        setIsInitialized(true);
        console.log('[Google Calendar] ✅ Initialization complete!');

      } catch (error) {
        if (cancelled) return;
        console.error('[Google Calendar] ❌ Error during initialization:', error);
        showToast('Failed to initialize Google API integration.', 'error');
      }
    };
    
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total (50 * 100ms)
    
    const checkScriptsAndInit = () => {
      if (cancelled) return;
      
      attempts++;
      
      if (window.gapi && window.google?.accounts?.oauth2) {
        console.log('[Google Calendar] Scripts loaded, initializing...');
        initClients();
      } else if (attempts >= maxAttempts) {
        if (!cancelled) {
          console.error('[Google Calendar] ❌ Timeout waiting for Google scripts to load');
          showToast('Google Calendar scripts failed to load. Check your internet connection.', 'error');
        }
      } else {
        console.log(`[Google Calendar] Waiting for scripts... (${attempts}/${maxAttempts})`);
        const timeoutId = setTimeout(checkScriptsAndInit, 100);
        timeoutIds.push(timeoutId);
      }
    };
    
    checkScriptsAndInit();

    // Cleanup function
    return () => {
      cancelled = true;
      timeoutIds.forEach(id => clearTimeout(id));
      hasStartedInit.current = false;
    };

  }, [userProfile, showToast, t, calendarProxyReady]);

  useEffect(() => {
    // Before: this effect tried to restore the previous Google session
    // automatically by calling requestAccessToken({ prompt: 'none' }).
    // Now: we only log the previous state and wait for an explicit user action
    // (click on "Connect Google Calendar" or similar) before requesting access.
    if (isInitialized && tokenClient && !initialAuthCheckPerformed.current && GOOGLE_AUTH_STATE_KEY) {
      initialAuthCheckPerformed.current = true;

      const previousAuthState = localStorage.getItem(GOOGLE_AUTH_STATE_KEY);

      if (!manualSignOut.current && previousAuthState === 'signed_in') {
        console.log('[Google Auth] Previous Google session detected. Waiting for explicit user action to reconnect (no automatic sign-in).');
      } else {
        console.log('[Google Auth] No previous Google session or user signed out. Google Calendar will connect only on user request.');
      }
    }
  }, [isInitialized, tokenClient, GOOGLE_AUTH_STATE_KEY]);
  
  const listCalendars = useCallback(async () => {
    if (!gapiClient || !isSignedIn) return;
    const token = gapiClient.getToken()?.access_token;
    if (!token) return;
    try {
        const res = await fetch('/api/google/calendar/calendars', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                showToast('Permission denied to list calendars. Please sign in again to grant access.', 'error');
                signOut();
                return;
            }
            throw new Error(`status ${res.status}`);
        }
        const data = await res.json();
        if (Array.isArray(data?.calendars)) {
            setCalendars(data.calendars);
        } else {
            setCalendars([]);
        }
    } catch (err: any) {
        console.error('Error fetching calendars:', err);
        showToast('Could not fetch calendar list. You may need to sign in again.', 'error');
    }
  }, [gapiClient, isSignedIn, showToast, signOut]);
  
  useEffect(() => {
    if(isSignedIn) {
        listCalendars();
    }
  }, [isSignedIn, listCalendars]);

  const signIn = useCallback(() => {
    if (!tokenClient) {
      showToast('Google Calendar is still initializing. Please try again in a moment.', 'warning');
      return;
    }

    try {
      tokenClient.requestAccessToken({
        prompt: manualSignOut.current ? 'consent' : undefined,
      });
    } catch (error) {
      console.error('Error launching Google sign-in:', error);
      showToast('Failed to start Google sign-in. Please try again.', 'error');
    }
  }, [tokenClient, showToast]);
  
  const fetchEvents = async (calendarIds: string[], timeMin: string, timeMax: string): Promise<any[]> => {
    if (!gapiClient || !isSignedIn || calendarIds.length === 0) return [];
    const token = gapiClient.getToken()?.access_token;
    if (!token) return [];

    try {
      const res = await fetch('/api/google/calendar/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'list',
          calendarIds,
          timeMin,
          timeMax,
        }),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          showToast('Permission denied to fetch calendar events. Please sign in again.', 'error');
          signOut();
          return [];
        }
        throw new Error(`status ${res.status}`);
      }

      const data = await res.json();
      return Array.isArray(data?.events) ? data.events : [];
    } catch (err: any) {
        console.error('Error fetching events:', err);
        showToast('Could not fetch calendar events.', 'error');
        return [];
    }
  };
  
  const showPicker = useCallback((callback: (data: any) => void) => {
    if (!gapiClient || !isSignedIn) {
      showToast('Google Picker requires a valid Google session.', 'error');
      return;
    }

    if (!window.google?.picker) {
      showToast('Google Picker script is still loading. Please try again shortly.', 'warning');
      return;
    }

    if (!GOOGLE_PICKER_DEVELOPER_KEY) {
      showToast('Configure VITE_GOOGLE_PICKER_API_KEY to enable Google Drive imports.', 'warning');
      return;
    }

    const token = gapiClient.getToken()?.access_token;
    if (!token) {
      showToast('Your Google session has expired. Please sign in again.', 'error');
      return;
    }

    const appId = GOOGLE_CALENDAR_CLIENT_ID?.split('-')[0];

    const docsView = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true);

    const pickerBuilder = new window.google.picker.PickerBuilder()
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_PICKER_DEVELOPER_KEY)
      .setCallback(callback)
      .addView(docsView)
      .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED);

    if (appId) {
      pickerBuilder.setAppId(appId);
    }

    pickerBuilder.build().setVisible(true);
  }, [gapiClient, isSignedIn, showToast, GOOGLE_PICKER_DEVELOPER_KEY, GOOGLE_CALENDAR_CLIENT_ID]);
  
  const createCalendarEvent = useCallback(async (trip: Trip, projectName: string) => {
    if (!gapiClient || !isSignedIn) {
      throw new Error('Not signed into Google');
    }

    const event = {
      'summary': `${projectName}: ${trip.reason}`,
      'description': `Route: ${trip.locations.join(' -> ')}\nDistance: ${trip.distance} km\nProject: ${projectName}`,
      'start': {
        'date': trip.date,
        'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      'end': {
        'date': trip.date,
        'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
      },
    };

    const token = gapiClient.getToken()?.access_token;
    if (!token) {
      throw new Error('Missing Google access token');
    }

    try {
        const res = await fetch('/api/google/calendar/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'create',
            calendarId: 'primary',
            event,
          }),
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            showToast('Permission denied to create calendar events. Please sign in again.', 'error');
            signOut();
            throw new Error('Unauthorized');
          }
          throw new Error(`status ${res.status}`);
        }

        const data = await res.json();
        return data?.event;
    } catch (err) {
        console.error('Error creating calendar event:', err);
        throw new Error('Failed to create event. Check console for details.');
    }
  }, [gapiClient, isSignedIn, showToast, signOut]);

  const value = {
    isInitialized,
    isSignedIn,
    calendarProxyReady,
    calendarProxyChecked,
    signIn,
    signOut,
    calendars,
    fetchEvents,
    createCalendarEvent,
    showPicker,
    gapiClient,
    refreshCalendars: listCalendars,
  };

  return (
    <GoogleCalendarContext.Provider value={value}>
      {children}
    </GoogleCalendarContext.Provider>
  );
};
