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
  updateUserProfile: (updates: Partial<UserProfile>, options?: { silent?: boolean }) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const UserProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [userProfile, setUserProfileState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fallbackName = user && user.email ? user.email.split('@')[0] : 'user';
  const storageKey = user ? `fahrtenbuch_user_profile_${user.id}` : null;

  const readLocalProfile = useCallback((): UserProfile | null => {
    if (!storageKey || typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as UserProfile) : null;
    } catch (error) {
      console.warn('Failed to read local user profile cache', error);
      return null;
    }
  }, [storageKey]);

  // Create default profile
  const createDefaultProfile = useCallback((userId: string): UserProfile => {
    return {
      id: `profile-${userId}`,
      name: fallbackName,
      country: 'AT',
      ratePerKm: null,
      passengerSurchargePerKm: null,
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
      hasSeenTutorial: false,
      isTutorialEnabled: true,
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

    const localCachedProfile = readLocalProfile();

    try {
      let profile = await databaseService.getUserProfile(user.id);

      // If no profile exists, create a default one (needed to enter the app)
      if (!profile) {
        console.warn('Profile not found in Supabase, attempting recovery from local cache');
        if (localCachedProfile) {
          try {
            profile = await databaseService.createUserProfile(user.id, localCachedProfile);
            console.info('Recovered profile from local cache into Supabase');
          } catch (createErr) {
            console.error('Failed to create profile from local cache, falling back to default', createErr);
          }
        }
      }

      if (!profile) {
        console.warn('Profile still missing, creating default profile');
        try {
          const defaultProfile = createDefaultProfile(user.id);
          profile = await databaseService.createUserProfile(user.id, defaultProfile);
        } catch (createErr) {
          console.error('Failed to create missing profile:', createErr);
          showToast('No se pudo crear tu perfil. Intenta iniciar sesión de nuevo.', 'error');
          setError('Profile creation failed');
          setUserProfileState(null);
          await logout();
          return;
        }
      }

      setUserProfileState(profile);
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(profile));
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
      setError(errorMessage);

      const fallbackProfile = localCachedProfile ?? (user ? createDefaultProfile(user.id) : null);
      if (fallbackProfile) {
        setUserProfileState(fallbackProfile);
        if (storageKey) {
          localStorage.setItem(storageKey, JSON.stringify(fallbackProfile));
        }
        showToast('Usando perfil en caché local (no se pudo contactar con servidor).', 'warning');
        return;
      }
      showToast('No se pudo cargar tu perfil desde Supabase.', 'error');
      setUserProfileState(null);
      await logout();
    } finally {
      setLoading(false);
    }
  }, [createDefaultProfile, logout, showToast, storageKey, user?.email, user?.id, readLocalProfile]);

  // Auto-migrate from localStorage on first load
  useEffect(() => {
    const migrateFromLocalStorage = async () => {
      if (!user?.id || !storageKey) return;

      try {
        // Check for regular profile in localStorage
        const localData = localStorage.getItem(storageKey);
        if (!localData) return;

        const localProfile = JSON.parse(localData) as UserProfile;

        // Check if we already have a profile in Supabase
        const existingProfile = await databaseService.getUserProfile(user.id);
        if (existingProfile) {
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
  const updateUserProfile = useCallback(async (updates: Partial<UserProfile>, options?: { silent?: boolean }) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    const { id, plan, createdAt, updatedAt, ...otherUpdates } = updates;
    const sanitizedUpdates = { ...otherUpdates };

    // Sanitize enum values to prevent 400 errors
    if (sanitizedUpdates.vehicleType && !['combustion', 'electric'].includes(sanitizedUpdates.vehicleType)) {
      sanitizedUpdates.vehicleType = null;
    }

    // Ensure empty strings for numeric fields are converted to null
    const numericFields = [
      'ratePerKm', 'passengerSurchargePerKm', 'fuelConsumption', 'fuelPrice',
      'energyConsumption', 'energyPrice', 'maintenanceCostPerKm',
      'parkingCostPerKm', 'tollsCostPerKm', 'finesCostPerKm', 'miscCostPerKm'
    ];

    numericFields.forEach(field => {
      if ((sanitizedUpdates as any)[field] === '') {
        (sanitizedUpdates as any)[field] = null;
      }
    });

    setLoading(true);
    try {
      const updatedProfile = await databaseService.updateUserProfile(user.id, sanitizedUpdates);
      setUserProfileState(updatedProfile);

      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(updatedProfile));
      }

      if (!options?.silent) {
        showToast('Profile updated successfully', 'success');
      }
    } catch (err) {
      console.error('Error updating user profile:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      if (!options?.silent) {
        showToast(errorMessage, 'error');
      }

      // Fallback to local update
      if (userProfile) {
        const merged = { ...userProfile, ...otherUpdates } as UserProfile;
        setUserProfileState(merged);
        if (storageKey) {
          localStorage.setItem(storageKey, JSON.stringify(merged));
        }
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [createDefaultProfile, showToast, storageKey, user?.id, userProfile]);

  // Set profile (for compatibility with old API)
  const setUserProfile = useCallback(async (profile: UserProfile | null) => {
    if (!user?.id || !profile) {
      setUserProfileState(profile);
      return;
    }

    try {
      await databaseService.updateUserProfile(user.id, profile);
      setUserProfileState(profile);
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(profile));
      }
    } catch (err) {
      console.error('Error setting user profile:', err);
      setUserProfileState(profile);
      if (storageKey && profile) {
        localStorage.setItem(storageKey, JSON.stringify(profile));
      }
    }
  }, [storageKey, user?.id]);

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

