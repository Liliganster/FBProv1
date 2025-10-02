
import React, { createContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { User, UserCredentials, UserProfile } from '../types';
import { getRateForCountry } from '../services/taxService';
import { migrateLegacyDrivers } from '../services/legacyDriverMigration';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  loginWithGoogle?: (credential: string) => Promise<void>;
  googleClientId: string | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USERS_STORAGE_KEY = 'fahrtenbuch_users';
const SESSION_STORAGE_KEY = 'fahrtenbuch_session_userid';

// Data keys for migration
const ANONYMOUS_DATA_KEYS = [
    'fahrtenbuch_trips',
    'fahrtenbuch_projects',
    'fahrtenbuch_reports',
    'fahrtenbuch_admin_settings'
];

const decodeJwt = (token: string) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Failed to decode JWT", e);
        return null;
    }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    // Check for active session on initial load
    const loggedInUserId = localStorage.getItem(SESSION_STORAGE_KEY);
    if (loggedInUserId) {
        const users = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '{}');
        const userData = Object.values(users).find((u: any) => u.id === loggedInUserId) as User | undefined;
        if (userData) {
            setUser(userData);
        }
    }

    // Find a client ID from any user to enable Google Sign-In for everyone
    const users: Record<string, UserCredentials> = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '{}');
    let foundClientId = null;
    for (const email in users) {
        const userId = users[email].id;
        const profileKey = `fahrtenbuch_user_profile_${userId}`;
        const profileJson = localStorage.getItem(profileKey);
        if (profileJson) {
            try {
              const profile: UserProfile = JSON.parse(profileJson);
              if (profile.googleCalendarClientId) {
                  foundClientId = profile.googleCalendarClientId;
                  break;
              }
            } catch(e) {
              console.error("Error parsing user profile for client ID search:", e);
            }
        }
    }
    setGoogleClientId(foundClientId);
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, pass: string): Promise<void> => {
    const users: Record<string, UserCredentials> = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '{}');
    const userCredentials = users[email.toLowerCase()];
    if (userCredentials && userCredentials.password === pass) {
        const loggedInUser: User = { id: userCredentials.id, email: email.toLowerCase() };
        setUser(loggedInUser);
        localStorage.setItem(SESSION_STORAGE_KEY, loggedInUser.id);
    } else {
        throw new Error('Invalid email or password.');
    }
  }, []);
  
  const migrateAnonymousData = (newUserId: string, fallbackName: string) => {
      console.log("Migrating anonymous data to new user:", newUserId);
      ANONYMOUS_DATA_KEYS.forEach(oldKey => {
          const data = localStorage.getItem(oldKey);
          if (data) {
              const newKey = `${oldKey}_${newUserId}`;
              localStorage.setItem(newKey, data);
              localStorage.removeItem(oldKey);
              console.log(`Migrated ${oldKey} to ${newKey}`);
          }
      });

      migrateLegacyDrivers(
        newUserId,
        fallbackName,
        `fahrtenbuch_user_profile_${newUserId}`,
        ['fahrtenbuch_drivers']
      );
  };

  const register = useCallback(async (email: string, pass: string): Promise<void> => {
    const users: Record<string, UserCredentials> = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '{}');
    const lowerCaseEmail = email.toLowerCase();
    
    if (users[lowerCaseEmail]) {
        throw new Error('An account with this email already exists.');
    }

    const isFirstUser = Object.keys(users).length === 0;

    const newUserId = `user-${Date.now()}`;
    users[lowerCaseEmail] = { password: pass, id: newUserId };
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

    if (isFirstUser) {
        migrateAnonymousData(newUserId, lowerCaseEmail.split('@')[0]);
    }

    const newUser: User = { id: newUserId, email: lowerCaseEmail };
    setUser(newUser);
    localStorage.setItem(SESSION_STORAGE_KEY, newUser.id);
  }, []);

  const loginWithGoogle = useCallback(async (credential: string): Promise<void> => {
    const decoded: { email: string; name: string; picture: string; } | null = decodeJwt(credential);
    if (!decoded) {
        throw new Error("Invalid Google credential.");
    }
    const { email, name, picture } = decoded;
    const lowerCaseEmail = email.toLowerCase();
    
    const users: Record<string, UserCredentials> = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '{}');
    let userCredentials = users[lowerCaseEmail];
    let loggedInUserId: string;

    if (userCredentials) {
        // User exists, just log them in
        loggedInUserId = userCredentials.id;
    } else {
        // New user, register them and create a profile
        const isFirstUser = Object.keys(users).length === 0;
        const newUserId = `user-${Date.now()}`;
        loggedInUserId = newUserId;
        users[lowerCaseEmail] = { id: newUserId }; // No password stored for Google users
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

        // Create and save their profile
        const newUserProfile: UserProfile = {
            id: `profile-${newUserId}`,
            name,
            profilePicture: picture,
            country: 'AT',
            ratePerKm: getRateForCountry('AT'),
            color: '#374151',
        };
        const profileKey = `fahrtenbuch_user_profile_${newUserId}`;
        localStorage.setItem(profileKey, JSON.stringify(newUserProfile));
        
        if (isFirstUser) {
            migrateAnonymousData(newUserId, name || lowerCaseEmail.split('@')[0]);
        }
    }
    
    const loggedInUser: User = { id: loggedInUserId, email: lowerCaseEmail };
    setUser(loggedInUser);
    localStorage.setItem(SESSION_STORAGE_KEY, loggedInUser.id);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    // Optionally, clear session-related data from memory/state here if needed
  }, []);

  const value = { user, isLoading, login, register, logout, loginWithGoogle, googleClientId };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};