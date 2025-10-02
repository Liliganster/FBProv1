

import React, { createContext, ReactNode, useEffect } from 'react';
import { UserProfile } from '../types';
import { useAuth } from '../hooks/useAuth';
import useLocalStorage from '../hooks/useLocalStorage';
import { getRateForCountry } from '../services/taxService';
import { migrateLegacyDrivers } from '../services/legacyDriverMigration';

interface UserProfileContextType {
  userProfile: UserProfile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

export const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const UserProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const storageKey = user ? `fahrtenbuch_user_profile_${user.id}` : null;
  const fallbackName = user ? user.email.split('@')[0] : 'user';

  const [userProfile, setUserProfile] = useLocalStorage<UserProfile | null>(storageKey, () => {
    if (!user) return null;
    // This function provides a default profile for new users or if no profile is found in storage.
    return {
        // FIX: Add a stable ID to the user profile to conform to the UserProfile interface.
        id: `profile-${user.id}`,
        name: fallbackName,
        country: 'AT', // Default to Austria
        ratePerKm: getRateForCountry('AT'),
        color: '#374151',
    };
  });

  useEffect(() => {
    if (!user || !storageKey) {
      return;
    }

    const migratedProfile = migrateLegacyDrivers(
      user.id,
      fallbackName,
      storageKey,
      [`fahrtenbuch_drivers_${user.id}`, 'fahrtenbuch_drivers']
    );

    if (migratedProfile) {
      setUserProfile(migratedProfile);
    }
  }, [user, storageKey, fallbackName, setUserProfile]);

  const value = { userProfile, setUserProfile };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
};
