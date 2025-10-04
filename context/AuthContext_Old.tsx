
import React, { createContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { User, UserCredentials, UserProfile } from '../types';
import { DbProfile } from '../types/database';
import { authService } from '../services/authService';
import { getRateForCountry } from '../services/taxService';
import { migrateLegacyDrivers } from '../services/legacyDriverMigration';

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  profile: DbProfile | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  loginWithGoogle?: (credential: string) => Promise<void>;
  googleClientId: string | null;
  // New Supabase-specific methods
  signInWithOAuth: (provider: 'google' | 'github' | 'apple') => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
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
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state and listen for changes
  useEffect(() => {
    let mounted = true;

    // Get initial session
    const initAuth = async () => {
      try {
        const { user: currentUser, session } = await authService.getSession();
        
        if (mounted) {
          if (currentUser && session) {
            setSupabaseUser(currentUser);
            
            // Convert to legacy User format for compatibility
            const legacyUser: User = {
              id: currentUser.id,
              email: currentUser.email!
            };
            setUser(legacyUser);

            // Fetch user profile
            const userProfile = await authService.getUserProfile(currentUser.id);
            setProfile(userProfile);
            
            // Set Google Client ID from profile if available
            if (userProfile?.googleCalendarClientId) {
              setGoogleClientId(userProfile.googleCalendarClientId);
            }
          }
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = authService.onAuthStateChange(async (session) => {
      if (mounted) {
        if (session?.user) {
          setSupabaseUser(session.user);
          
          const legacyUser: User = {
            id: session.user.id,
            email: session.user.email!
          };
          setUser(legacyUser);

          // Fetch updated profile
          const userProfile = await authService.getUserProfile(session.user.id);
          setProfile(userProfile);
          
          if (userProfile?.googleCalendarClientId) {
            setGoogleClientId(userProfile.googleCalendarClientId);
          }
        } else {
          setSupabaseUser(null);
          setUser(null);
          setProfile(null);
          setGoogleClientId(null);
        }
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const { user: authUser, error } = await authService.signIn(email, password);
    
    if (error) {
      throw new Error(error.message || 'Login failed');
    }
    
    if (!authUser) {
      throw new Error('Login failed');
    }
    
    // State will be updated by the auth state change listener
  }, []);
  
  const register = useCallback(async (email: string, password: string): Promise<void> => {
    const { user: authUser, error } = await authService.signUp(email, password, {
      full_name: email.split('@')[0] // Use email prefix as default name
    });
    
    if (error) {
      throw new Error(error.message || 'Registration failed');
    }
    
    if (!authUser) {
      throw new Error('Registration failed');
    }
    
    // State will be updated by the auth state change listener
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