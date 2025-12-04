import { supabase } from '../lib/supabase'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { DbProfile, DbProfileInsert, DbProfileUpdate } from '../types/database'
import { authQueueService } from './authQueueService'

export interface AuthResponse {
  user: User | null
  error: AuthError | null
}

export interface AuthSession {
  user: User | null
  session: Session | null
}

class AuthService {
  /**
   * Sign up new user with email and password
   */
  async signUp(email: string, password: string, metadata: {
    full_name?: string
    country?: string
  } = {}): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      })

      if (error) throw error

      // Try to create profile entry (optional - may fail if DB not configured)
      if (data.user) {
        try {
          await this.createUserProfile(data.user, metadata)
        } catch (profileError) {
          console.warn('Could not create user profile, continuing without:', profileError);
          // Continue without profile - signup should still succeed
        }
      }

      return {
        user: data.user,
        error: null
      }
    } catch (error) {
      return {
        user: null,
        error: error as AuthError
      }
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      return {
        user: data.user,
        error: null
      }
    } catch (error) {
      return {
        user: null,
        error: error as AuthError
      }
    }
  }

  /**
   * Sign in with OAuth provider
   */
  async signInWithOAuth(provider: 'google' | 'github' | 'apple') {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          // Usar una ruta específica para el callback para evitar bucles de redirección
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<{ error: AuthError | null }> {
    return authQueueService.executeAuthOperation(async () => {
      try {
        const { error } = await supabase.auth.signOut()

        // Clear only Supabase-specific storage, not all sessionStorage
        // to avoid breaking other app functionality (like loop prevention)
        if (typeof window !== 'undefined') {
          // Clear localStorage items that might be corrupted
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('supabase') || key.startsWith('sb-'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));

          // Clear only Supabase-related sessionStorage items
          const sessionKeysToRemove = [];
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && (key.startsWith('supabase') || key.startsWith('sb-'))) {
              sessionKeysToRemove.push(key);
            }
          }
          sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
        }

        return { error }
      } catch (error) {
        // Even if signOut fails, try to clear storage
        if (typeof window !== 'undefined') {
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('supabase') || key.startsWith('sb-'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
        }
        return { error: error as AuthError }
      }
    }, 'signOut');
  }

  /**
   * Clear all stored authentication data
   */
  async clearSession(): Promise<void> {
    return authQueueService.executeAuthOperation(async () => {
      try {
        await this.signOut();
      } catch (error) {
        console.warn('Error during session clearing:', error);
        // Still try to clear storage even if signOut fails
        if (typeof window !== 'undefined') {
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('supabase') || key.startsWith('sb-'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
        }
      }
    }, 'clearSession');
  }

  /**
   * Get current session
   */
  async getSession(): Promise<AuthSession> {
    try {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        console.warn('Session error, may need to re-login:', error);
        // Don't throw for session errors, just return null
        return {
          user: null,
          session: null
        };
      }

      return {
        user: data.session?.user || null,
        session: data.session
      }
    } catch (error) {
      console.warn('Error getting session, returning null:', error)
      return {
        user: null,
        session: null
      }
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data, error } = await supabase.auth.getUser()

      if (error) throw error
      return data.user
    } catch (error) {
      console.error('Error getting current user:', error)
      return null
    }
  }

  /**
   * Reset password
   */
  async resetPassword(email: string): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })
      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }

  /**
   * Update user password
   */
  async updatePassword(password: string): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password
      })
      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (session: Session | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(session)
    })
  }

  /**
   * Create user profile in database
   */
  private async createUserProfile(user: User, metadata: {
    full_name?: string
    avatar_url?: string
  } = {}): Promise<DbProfile | null> {
    try {
      const profileData: DbProfileInsert = {
        id: user.id,
        email: user.email || null,
        full_name: metadata.full_name || user.user_metadata?.full_name || null,
        avatar_url: metadata.avatar_url || user.user_metadata?.avatar_url || null,
        plan: (user.user_metadata as any)?.plan || 'free'
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .insert(profileData)
        .select()
        .single()

      if (error) {
        console.error('Error creating user profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error creating user profile:', error)
      return null
    }
  }

  /**
   * Get user profile from database
   */
  async getUserProfile(userId: string): Promise<DbProfile | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.warn('Could not fetch user profile:', error);
        // Return null if RLS blocks access or record doesn't exist
        if (error.code === 'PGRST116' || error.code === '42501' || error.code === 'PGRST204') {
          console.warn('Profile not accessible/found, user can still use app without profile');
          return null;
        }
        return null;
      }

      return data
    } catch (error) {
      console.warn('Error fetching user profile, continuing without:', error)
      return null
    }
  }

  /**
   * Update user profile in database
   */
  async updateUserProfile(userId: string, updates: DbProfileUpdate): Promise<DbProfile | null> {
    return authQueueService.executeStateUpdate(async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
          .select()
          .single()

        if (error) {
          console.error('Error updating user profile:', error)
          return null
        }

        return data
      } catch (error) {
        console.error('Error updating user profile:', error)
        return null
      }
    }, `updateProfile_${userId}`);
  }

  // NOTE: Detailed profile mapping removed (handled directly where needed)
}

// Export singleton instance
export const authService = new AuthService()
export default authService
