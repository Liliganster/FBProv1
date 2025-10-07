
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
  signIn: () => void;
  signOut: () => void;
  calendars: any[];
  fetchEvents: (calendarIds: string[], timeMin: string, timeMax: string) => Promise<any[]>;
  createCalendarEvent: (trip: Trip, projectName: string) => Promise<any>;
  showPicker: (callback: (data: any) => void) => void;
  gapiClient: any;
}

export const GoogleCalendarContext = createContext<GoogleApiContextType | undefined>(undefined);

const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/drive.readonly';
const DISCOVERY_DOCS = [
    'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
];

// Get Google Calendar credentials from environment variables
const GOOGLE_CALENDAR_API_KEY = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY;
const GOOGLE_CALENDAR_CLIENT_ID = import.meta.env.VITE_GOOGLE_CALENDAR_CLIENT_ID;

export const GoogleCalendarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { userProfile } = useUserProfile();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [calendars, setCalendars] = useState<any[]>([]);
  const [gapiClient, setGapiClient] = useState<any>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const { showToast } = useToast();
  const { t } = useTranslation();
  const manualSignOut = useRef(false);
  const initialAuthCheckPerformed = useRef(false);
  
  const GOOGLE_AUTH_STATE_KEY = userProfile ? `fahrtenbuch_google_auth_state_${userProfile.id}` : null;

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
    // Skip initialization if Google Calendar credentials are not configured
    if (!GOOGLE_CALENDAR_API_KEY || !GOOGLE_CALENDAR_CLIENT_ID || !userProfile) {
      console.log('[Google Calendar] Skipping init:', {
        hasApiKey: !!GOOGLE_CALENDAR_API_KEY,
        hasClientId: !!GOOGLE_CALENDAR_CLIENT_ID,
        hasUserProfile: !!userProfile
      });
      setIsInitialized(false);
      return;
    }
    
    console.log('[Google Calendar] Starting initialization...');
    const GOOGLE_AUTH_STATE_KEY_INIT = `fahrtenbuch_google_auth_state_${userProfile.id}`;

    const initClients = async () => {
      try {
        console.log('[Google Calendar] Loading gapi client...');
        await new Promise<void>((resolve, reject) => window.gapi.load('client:picker', {
          callback: resolve,
          onerror: reject,
          timeout: 5000,
          ontimeout: reject,
        }));

        console.log('[Google Calendar] Initializing gapi client...');
        await window.gapi.client.init({
          apiKey: GOOGLE_CALENDAR_API_KEY,
          discoveryDocs: DISCOVERY_DOCS,
        });
        setGapiClient(window.gapi.client);

        console.log('[Google Calendar] Initializing token client...');
        const newtokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CALENDAR_CLIENT_ID,
          scope: SCOPES,
          callback: (tokenResponse: any) => {
            if (tokenResponse.error) {
              const expectedErrors = ['access_denied', 'user_logged_out', 'consent_required', 'interaction_required', 'login_required'];
              if (expectedErrors.includes(tokenResponse.error)) {
                 console.log(`Google silent auth failed as expected: ${tokenResponse.error}`);
              } else {
                 showToast(t('toast_gcal_auth_error', { error: tokenResponse.error_description || tokenResponse.error }), 'error');
                 console.error('Google Sign-In Error:', tokenResponse);
              }
              setIsSignedIn(false);
              localStorage.setItem(GOOGLE_AUTH_STATE_KEY_INIT, 'signed_out');
              return;
            }
            if (!tokenResponse.access_token) {
                console.log('Token response received without an access token.');
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
        setTokenClient(newtokenClient);
        setIsInitialized(true);
        console.log('[Google Calendar] ✅ Initialization complete!');

      } catch (error) {
        console.error('[Google Calendar] ❌ Error during initialization:', error);
        showToast('Failed to initialize Google API integration.', 'error');
      }
    };
    
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total (50 * 100ms)
    
    const checkScriptsAndInit = () => {
      attempts++;
      
      if (window.gapi && window.google?.accounts?.oauth2) {
        console.log('[Google Calendar] Scripts loaded, initializing...');
        initClients();
      } else if (attempts >= maxAttempts) {
        console.error('[Google Calendar] ❌ Timeout waiting for Google scripts to load');
        showToast('Google Calendar scripts failed to load. Check your internet connection.', 'error');
      } else {
        console.log(`[Google Calendar] Waiting for scripts... (${attempts}/${maxAttempts})`);
        setTimeout(checkScriptsAndInit, 100);
      }
    };
    
    checkScriptsAndInit();

  }, [userProfile, showToast, t]);

  useEffect(() => {
    // This effect should run only once when the client is ready to perform the initial check.
    if (isInitialized && tokenClient && !initialAuthCheckPerformed.current && GOOGLE_AUTH_STATE_KEY) {
      initialAuthCheckPerformed.current = true;
      
      const previousAuthState = localStorage.getItem(GOOGLE_AUTH_STATE_KEY);

      // Don't attempt silent sign-in if the user manually signed out in the current session.
      if (!manualSignOut.current && previousAuthState === 'signed_in') {
        console.log("[Google Auth] Attempting to restore previous session.");
        tokenClient.requestAccessToken({ prompt: 'none' });
      } else {
        console.log("[Google Auth] Skipping silent sign-in (user was not previously authenticated or signed out).");
      }
    }
  }, [isInitialized, tokenClient, GOOGLE_AUTH_STATE_KEY]);
  
  const listCalendars = useCallback(async () => {
    if (!gapiClient || !isSignedIn) return;
    try {
        const response = await gapiClient.calendar.calendarList.list();
        setCalendars(response.result.items);
    } catch (err: any) {
        console.error('Error fetching calendars:', err);
        if (err.status === 403 || err.result?.error?.code === 403) {
            showToast('Permission denied to list calendars. Please sign in again to grant access.', 'error');
            signOut();
        } else {
            showToast('Could not fetch calendar list. You may need to sign in again.', 'error');
        }
    }
  }, [gapiClient, isSignedIn, showToast, signOut]);
  
  useEffect(() => {
    if(isSignedIn) {
        listCalendars();
    }
  }, [isSignedIn, listCalendars]);

  const signIn = () => {
    if (tokenClient) {
      // Use a standard prompt. Google will only ask for consent if it's necessary.
      tokenClient.requestAccessToken({});
    }
  };
  
  const fetchEvents = async (calendarIds: string[], timeMin: string, timeMax: string): Promise<any[]> => {
    if (!gapiClient || !isSignedIn || calendarIds.length === 0) return [];
    
    try {
      const batch = gapiClient.newBatch();
      calendarIds.forEach(calId => {
        batch.add(gapiClient.calendar.events.list({
          'calendarId': calId,
          'timeMin': timeMin,
          'timeMax': timeMax,
          'showDeleted': false,
          'singleEvents': true,
          'maxResults': 100,
          'orderBy': 'startTime'
        }));
      });

      const response = await batch;
      let allEvents: any[] = [];
      Object.values(response.result).forEach((res: any) => {
        if (res.result.items) {
          allEvents = [...allEvents, ...res.result.items];
        }
      });
      return allEvents;

    } catch (err: any) {
        console.error('Error fetching events:', err);
        if (err.status === 403 || err.result?.error?.code === 403) {
            showToast('Permission denied to fetch calendar events. Please sign in again.', 'error');
            signOut();
        } else {
            showToast('Could not fetch calendar events.', 'error');
        }
        return [];
    }
  };
  
  const showPicker = (callback: (data: any) => void) => {
    if (!gapiClient || !isSignedIn || !GOOGLE_CALENDAR_API_KEY || !window.google?.picker) {
      showToast('Google Picker API is not ready.', 'error');
      return;
    }
    const token = gapiClient.getToken().access_token;

    const view = new window.google.picker.View(window.google.picker.ViewId.DOCS);
    view.setMimeTypes("image/png,image/jpeg,application/pdf,text/plain,text/csv,application/vnd.ms-excel");
    
    try {
        const picker = new window.google.picker.PickerBuilder()
            .addView(view)
            .setOAuthToken(token)
            .setDeveloperKey(GOOGLE_CALENDAR_API_KEY)
            .setCallback(callback)
            .build();
        picker.setVisible(true);
    } catch (e) {
        console.error("Error creating Google Picker:", e);
        showToast("Error opening Google Drive Picker. Please check your API Key and ensure the 'Google Picker API' is enabled in your Google Cloud project.", 'error');
    }
  };
  
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

    try {
        // Use 'primary' to automatically use the user's primary calendar
        const response = await gapiClient.calendar.events.insert({
          'calendarId': 'primary',
          'resource': event
        });
        return response;
    } catch (err) {
        console.error('Error creating calendar event:', err);
        throw new Error('Failed to create event. Check console for details.');
    }
  }, [gapiClient, isSignedIn]);

  const value = {
    isInitialized,
    isSignedIn,
    signIn,
    signOut,
    calendars,
    fetchEvents,
    createCalendarEvent,
    showPicker,
    gapiClient,
  };

  return (
    <GoogleCalendarContext.Provider value={value}>
      {children}
    </GoogleCalendarContext.Provider>
  );
};