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
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [userProfile, setUserProfileState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tutorialDefaults = { hasSeenTutorial: false, isTutorialEnabled: true };
  const fallbackName = user && user.email ? user.email.split('@')[0] : 'user';
  const storageKey = user ? `fahrtenbuch_user_profile_${user.id}` : null;

  const getTutorialPrefsKey = useCallback((userIdValue?: string | null) => {
    return userIdValue ? `fahrtenbuch_tutorial_${userIdValue}` : null;
  }, []);

  const readTutorialPrefs = useCallback((userIdOverride?: string | null) => {
    const key = getTutorialPrefsKey(userIdOverride ?? user?.id);
    if (!key || typeof window === 'undefined') return tutorialDefaults;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) return tutorialDefaults;
      const parsed = JSON.parse(raw);
      return {
        hasSeenTutorial: typeof parsed.hasSeenTutorial === 'boolean' ? parsed.hasSeenTutorial : tutorialDefaults.hasSeenTutorial,
        isTutorialEnabled: typeof parsed.isTutorialEnabled === 'boolean' ? parsed.isTutorialEnabled : tutorialDefaults.isTutorialEnabled,
      };
    } catch (storageError) {
      console.warn('Failed to read tutorial prefs, resetting to defaults', storageError);
      return tutorialDefaults;
    }
  }, [getTutorialPrefsKey, user?.id]);

  const persistTutorialPrefs = useCallback((prefs: Partial<Pick<UserProfile, 'hasSeenTutorial' | 'isTutorialEnabled'>>, userIdOverride?: string | null) => {
    const key = getTutorialPrefsKey(userIdOverride ?? user?.id);
    if (!key || typeof window === 'undefined') return tutorialDefaults;
    const current = readTutorialPrefs(userIdOverride);
    const next = {
      hasSeenTutorial: typeof prefs.hasSeenTutorial === 'boolean' ? prefs.hasSeenTutorial : current.hasSeenTutorial,
      isTutorialEnabled: typeof prefs.isTutorialEnabled === 'boolean' ? prefs.isTutorialEnabled : current.isTutorialEnabled,
    };
    localStorage.setItem(key, JSON.stringify(next));
    return next;
  }, [getTutorialPrefsKey, readTutorialPrefs, user?.id]);

  const applyTutorialPrefs = useCallback((profile: UserProfile, overrides?: Partial<Pick<UserProfile, 'hasSeenTutorial' | 'isTutorialEnabled'>>): UserProfile => {
    const stored = readTutorialPrefs(profile.id);
    const mergedTutorial = {
      hasSeenTutorial: typeof overrides?.hasSeenTutorial === 'boolean'
        ? overrides.hasSeenTutorial
        : typeof profile.hasSeenTutorial === 'boolean'
          ? profile.hasSeenTutorial
          : stored.hasSeenTutorial,
      isTutorialEnabled: typeof overrides?.isTutorialEnabled === 'boolean'
        ? overrides.isTutorialEnabled
        : typeof profile.isTutorialEnabled === 'boolean'
          ? profile.isTutorialEnabled
          : stored.isTutorialEnabled,
    };

    persistTutorialPrefs(mergedTutorial, profile.id);
    return { ...profile, ...mergedTutorial };
  }, [persistTutorialPrefs, readTutorialPrefs]);

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
    const tutorialPrefs = readTutorialPrefs(userId);
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
      hasSeenTutorial: tutorialPrefs.hasSeenTutorial,
      isTutorialEnabled: tutorialPrefs.isTutorialEnabled,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }, [fallbackName, readTutorialPrefs, user?.email]);

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

      const profileWithPrefs = applyTutorialPrefs(profile);
      setUserProfileState(profileWithPrefs);
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(profileWithPrefs));
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
      setError(errorMessage);

      const fallbackProfile = localCachedProfile ?? (user ? createDefaultProfile(user.id) : null);
      if (fallbackProfile) {
        const merged = applyTutorialPrefs(fallbackProfile);
        setUserProfileState(merged);
        if (storageKey) {
          localStorage.setItem(storageKey, JSON.stringify(merged));
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
  }, [applyTutorialPrefs, createDefaultProfile, logout, showToast, storageKey, user?.email, user?.id, readLocalProfile]);

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

    const { hasSeenTutorial, isTutorialEnabled, id, plan, createdAt, updatedAt, ...otherUpdates } = updates;
    const hasTutorialUpdates = typeof hasSeenTutorial === 'boolean' || typeof isTutorialEnabled === 'boolean';
    const sanitizedUpdates = { ...otherUpdates };
    // Explicitly strip non-updatable fields to avoid rejecting updates
    delete (sanitizedUpdates as any).plan;
    delete (sanitizedUpdates as any).id;
    delete (sanitizedUpdates as any).createdAt;
    delete (sanitizedUpdates as any).updatedAt;
    const hasOtherUpdates = Object.keys(sanitizedUpdates).length > 0;

    const mergeAndPersist = (profile: UserProfile) => {
      const mergedProfile = applyTutorialPrefs(profile, { hasSeenTutorial, isTutorialEnabled });
      setUserProfileState(mergedProfile);
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(mergedProfile));
      }
      return mergedProfile;
    };

    // Tutorial-only updates are handled locally to avoid schema mismatches
    if (!hasOtherUpdates) {
      const baseProfile = userProfile ?? createDefaultProfile(user.id);
      mergeAndPersist(baseProfile);
      if (!hasTutorialUpdates) {
        showToast('Profile updated successfully', 'success');
      }
      return;
    }

    setLoading(true);
    try {
      const updatedProfile = await databaseService.updateUserProfile(user.id, sanitizedUpdates);
      mergeAndPersist(updatedProfile);
      showToast('Profile updated successfully', 'success');
    } catch (err) {
      console.error('Error updating user profile:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      showToast(errorMessage, 'error');

      // Fallback to local update
      if (userProfile) {
        mergeAndPersist({ ...userProfile, ...otherUpdates });
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [applyTutorialPrefs, createDefaultProfile, showToast, storageKey, user?.id, userProfile]);

  // Set profile (for compatibility with old API)
  const setUserProfile = useCallback(async (profile: UserProfile | null) => {
    if (!user?.id || !profile) {
      setUserProfileState(profile);
      return;
    }

    const profileWithPrefs = applyTutorialPrefs(profile);
    try {
      await databaseService.updateUserProfile(user.id, profileWithPrefs);
      setUserProfileState(profileWithPrefs);
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(profileWithPrefs));
      }
    } catch (err) {
      console.error('Error setting user profile:', err);
      // Still update locally
      setUserProfileState(profileWithPrefs);
      if (storageKey && profileWithPrefs) {
        localStorage.setItem(storageKey, JSON.stringify(profileWithPrefs));
      }
    }
  }, [applyTutorialPrefs, storageKey, user?.id]);

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

