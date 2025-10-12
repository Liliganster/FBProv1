import React, { createContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { User } from '../types';
import { DbProfile } from '../types/database';
import { authService } from '../services/authService';
import { SUPABASE_CONFIG_ERROR, isSupabaseConfigured } from '../lib/supabase';
import { authQueueService } from '../services/authQueueService';
import { useMemoryLeakPrevention } from '../hooks/useAbortController';

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  profile: DbProfile | null;
  isLoading: boolean;
  configError: string | null;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  signInWithOAuth: (provider: 'google' | 'github' | 'apple') => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  
  // Use memory leak prevention hooks
  const { addCleanup, createController } = useMemoryLeakPrevention('AuthContext');
  
  // Use ref instead of state to avoid triggering re-renders
  const isProcessingAuth = useRef(false);
  const lastProcessedUserId = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const controller = createController('authInit');

    if (!isSupabaseConfigured) {
      setConfigError(SUPABASE_CONFIG_ERROR);
      setIsLoading(false);
      setUser(null);
      setSupabaseUser(null);
      setProfile(null);
      return () => {
        mounted = false;
      };
    }

    setConfigError(null);

    const updateAuthState = async (currentUser: SupabaseUser | null) => {
      // Use queue service to prevent race conditions in state updates
      return authQueueService.executeStateUpdate(async () => {
        // Prevent concurrent updates and duplicate processing
        if (!mounted || isProcessingAuth.current || controller.signal.aborted) return;
        
        // Skip if we already processed this user
        const userId = currentUser?.id || null;
        if (userId === lastProcessedUserId.current) return;
        
        try {
          isProcessingAuth.current = true;
          lastProcessedUserId.current = userId;
          
          if (currentUser) {
            setSupabaseUser(currentUser);
            const legacyUser: User = { id: currentUser.id, email: currentUser.email || '' };
            setUser(legacyUser);
            const userProfile = await authService.getUserProfile(currentUser.id);
            setProfile(userProfile);
          } else {
            setSupabaseUser(null);
            setUser(null);
            setProfile(null);
          }
        } catch (e) {
          console.error('Error updating auth state:', e);
        } finally {
          if (mounted && !controller.signal.aborted) {
            isProcessingAuth.current = false;
          }
        }
      }, `updateAuthState_${currentUser?.id || 'null'}`);
    };

    const initAuth = async () => {
      try {
        const { user: currentUser, session } = await authService.getSession();
        if (!mounted || controller.signal.aborted) return;

        await updateAuthState(currentUser);
      } catch (e) {
        console.error('Error initializing auth:', e);
      } finally {
        if (mounted && !controller.signal.aborted) setIsLoading(false);
      }
    };

    initAuth();

    // Subscribe to auth state changes with debouncing and deduplication
    const { data: { subscription } } = authService.onAuthStateChange(async (session) => {
      if (!mounted || isProcessingAuth.current || controller.signal.aborted) return;
      await updateAuthState(session?.user || null);
    });
    
    // Register cleanup function for subscription
    addCleanup(() => {
      if (subscription) {
        subscription.unsubscribe();
      }
    });

    return () => {
      mounted = false;
      controller.abort('AuthContext unmounted');
    };
  }, [createController, addCleanup]);

  const ensureConfigured = useCallback(() => {
    if (!isSupabaseConfigured) {
      throw new Error(SUPABASE_CONFIG_ERROR);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    ensureConfigured();
    return authQueueService.executeAuthOperation(async () => {
      const { user: authUser, error } = await authService.signIn(email, password);
      if (error || !authUser) throw new Error(error?.message || 'Login failed');
    }, `login_${email}`);
  }, [ensureConfigured]);

  const register = useCallback(async (email: string, password: string) => {
    ensureConfigured();
    return authQueueService.executeAuthOperation(async () => {
      const { user: authUser, error } = await authService.signUp(email, password, { full_name: email.split('@')[0] });
      if (error || !authUser) throw new Error(error?.message || 'Registration failed');
    }, `register_${email}`);
  }, [ensureConfigured]);

  const logout = useCallback(async () => {
    ensureConfigured();

    return authQueueService.executeAuthOperation(async () => {
      // Immediately clear state before sign-out to prevent UI delays
      setUser(null);
      setSupabaseUser(null);
      setProfile(null);
      isProcessingAuth.current = false;
      lastProcessedUserId.current = null;

      // Sign out from Supabase (don't block on this)
      authService.signOut().catch(err => {
        console.error('Error signing out:', err);
      });

      // Clear user-specific localStorage asynchronously
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          try {
            Object.keys(localStorage)
              .filter(key => key.startsWith('fahrtenbuch_'))
              .forEach(key => localStorage.removeItem(key));
          } catch (err) {
            console.error('Error clearing localStorage:', err);
          }
        }, 0);
      }
    }, 'logout');
  }, [ensureConfigured]);

  const signInWithOAuth = useCallback(async (provider: 'google' | 'github' | 'apple') => {
    ensureConfigured();
    return authQueueService.executeAuthOperation(async () => {
      const { error } = await authService.signInWithOAuth(provider);
      if (error) throw new Error(error.message || `${provider} sign-in failed`);
    }, `oauth_${provider}`);
  }, [ensureConfigured]);

  const resetPassword = useCallback(async (email: string) => {
    ensureConfigured();
    return authQueueService.executeAuthOperation(async () => {
      const { error } = await authService.resetPassword(email);
      if (error) throw new Error(error.message || 'Password reset failed');
    }, `reset_password_${email}`);
  }, [ensureConfigured]);

  const updatePassword = useCallback(async (password: string) => {
    ensureConfigured();
    return authQueueService.executeAuthOperation(async () => {
      const { error } = await authService.updatePassword(password);
      if (error) throw new Error(error.message || 'Password update failed');
    }, 'update_password');
  }, [ensureConfigured]);

  const value: AuthContextType = {
    user,
    supabaseUser,
    profile,
    isLoading,
    configError,
    login,
    register,
    logout,
    signInWithOAuth,
    resetPassword,
    updatePassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
