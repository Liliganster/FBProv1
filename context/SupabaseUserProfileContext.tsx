import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserProfile } from '../types';
import { databaseService } from '../services/databaseService';
import { useAuth } from '../hooks/useAuth';
import useToast from '../hooks/useToast';
import { getRateForCountry, getPassengerSurchargeForCountry } from '../services/taxService';

interface UserProfileContextType {
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  setUserProfile: (profile: UserProfile | null) => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const UserProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [userProfile, setUserProfileState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isProd = (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.PROD) || process.env.NODE_ENV === 'production';

  const fallbackName = user && user.email ? user.email.split('@')[0] : 'user';
  const storageKey = user ? `fahrtenbuch_user_profile_${user.id}` : null;

  // Create default profile
  const createDefaultProfile = useCallback((userId: string): UserProfile => {
    return {
      id: `profile-${userId}`,
      name: fallbackName,
      country: 'AT',
      ratePerKm: getRateForCountry('AT'),
      passengerSurchargePerKm: getPassengerSurchargeForCountry('AT'),
      color: '#374151',
      plan: 'free',
      email: user?.email || null,
      fullName: null,
      licensePlate: null,
      uid: null,
      address: null,
      city: null,
      profilePicture: null,
      avatarUrl: null,
      googleMapsApiKey: null,
      openRouterApiKey: null,
      openRouterModel: null,
      lockedUntilDate: null,
      vehicleType: null,
      fuelConsumption: null,
      fuelPrice: null,
      energyConsumption: null,
      energyPrice: null,
      maintenanceCostPerKm: null,
      parkingCostPerKm: null,
      tollsCostPerKm: null,
      finesCostPerKm: null,
      miscCostPerKm: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }, [fallbackName, user?.email]);

  // Load profile from Supabase
  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      setUserProfileState(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let profile = await databaseService.getUserProfile(user.id);

      // If no profile exists, create a default one
      if (!profile) {
        if (isProd) {
          console.error('Profile not found in Supabase; skipping default creation in production');
          showToast('No se encontró tu perfil en la nube. Verifica la configuración de Supabase.', 'error');
          setError('Profile not found in Supabase');
          setUserProfileState(null);
          return;
        }
        console.log('No profile found, creating default profile (non-prod)');
        const defaultProfile = createDefaultProfile(user.id);
        profile = await databaseService.createUserProfile(user.id, defaultProfile);
      }

      setUserProfileState(profile);
    } catch (err) {
      console.error('Error loading user profile:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
      setError(errorMessage);

      if (!isProd) {
        // Fallback to localStorage in non-production
        try {
          if (storageKey) {
            const localData = localStorage.getItem(storageKey);
            if (localData) {
              const parsed = JSON.parse(localData);
              setUserProfileState(parsed);
              console.warn('Using localStorage fallback for user profile');
            } else {
              // Create default profile locally
              const defaultProfile = createDefaultProfile(user.id);
              setUserProfileState(defaultProfile);
            }
          }
        } catch (localError) {
          console.error('Failed to load from localStorage:', localError);
          setUserProfileState(createDefaultProfile(user.id));
        }
      } else {
        showToast('No se pudo cargar tu perfil desde Supabase.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.email, storageKey, createDefaultProfile]);

  // Auto-migrate from localStorage on first load
  useEffect(() => {
    const migrateFromLocalStorage = async () => {
      if (!user?.id || !storageKey || isProd) return;

      try {
        // Check for regular profile in localStorage
        const localData = localStorage.getItem(storageKey);
        if (!localData) return;

        const localProfile = JSON.parse(localData) as UserProfile;

        // Check if we already have a profile in Supabase
        const existingProfile = await databaseService.getUserProfile(user.id);
        if (existingProfile) {
          console.log('Profile already exists in Supabase');
          return;
        }

        // Migrate to Supabase
        console.log('Migrating user profile to Supabase...');
        await databaseService.createUserProfile(user.id, localProfile);

        // Clear localStorage after successful migration
        localStorage.removeItem(storageKey);
        showToast('Profile migrated to cloud storage', 'success');

        // Refresh to show migrated data
        await refreshProfile();
      } catch (error) {
        console.error('Failed to migrate user profile:', error);
      }
    };

    migrateFromLocalStorage();
  }, [user?.id, storageKey, showToast, refreshProfile]);

  // Load profile on mount
  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // Update profile
  const updateUserProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    try {
      const updatedProfile = await databaseService.updateUserProfile(user.id, updates);
      setUserProfileState(updatedProfile);
      showToast('Profile updated successfully', 'success');
    } catch (err) {
      console.error('Error updating user profile:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      showToast(errorMessage, 'error');

      // Fallback to local update
      if (userProfile) {
        const localUpdate = { ...userProfile, ...updates };
        setUserProfileState(localUpdate);
        if (storageKey) {
          localStorage.setItem(storageKey, JSON.stringify(localUpdate));
        }
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.id, userProfile, storageKey, showToast]);

  // Set profile (for compatibility with old API)
  const setUserProfile = useCallback(async (profile: UserProfile | null) => {
    if (!user?.id || !profile) {
      setUserProfileState(profile);
      return;
    }

    try {
      await databaseService.updateUserProfile(user.id, profile);
      setUserProfileState(profile);
    } catch (err) {
      console.error('Error setting user profile:', err);
      // Still update locally
      setUserProfileState(profile);
      if (storageKey && profile) {
        localStorage.setItem(storageKey, JSON.stringify(profile));
      }
    }
  }, [user?.id, storageKey]);

  const contextValue: UserProfileContextType = {
    userProfile,
    loading,
    error,
    setUserProfile,
    updateUserProfile,
    refreshProfile
  };

  return (
    <UserProfileContext.Provider value={contextValue}>
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
};

