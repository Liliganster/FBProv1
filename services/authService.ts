import { supabase } from '../lib/supabase'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { DbProfile, DbProfileInsert, DbProfileUpdate } from '../types/database'

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

      // Create profile entry if user was created successfully
      if (data.user) {
        await this.createUserProfile(data.user, metadata)
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
    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }

  /**
   * Get current session
   */
  async getSession(): Promise<AuthSession> {
    try {
      const { data, error } = await supabase.auth.getSession()
      
      if (error) throw error

      return {
        user: data.session?.user || null,
        session: data.session
      }
    } catch (error) {
      console.error('Error getting session:', error)
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
    country?: string 
  } = {}): Promise<DbProfile | null> {
    try {
      const profileData: DbProfileInsert = {
        id: user.id,
        email: user.email!,
        full_name: metadata.full_name || user.user_metadata?.full_name || null,
        country: metadata.country || null
      }

      const { data, error } = await supabase
        .from('profiles')
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
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return null
    }
  }

  /**
   * Update user profile in database
   */
  async updateUserProfile(userId: string, updates: DbProfileUpdate): Promise<DbProfile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
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
  }
}

// Export singleton instance
export const authService = new AuthService()
export default authService