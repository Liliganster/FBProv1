

import React, { createContext, ReactNode } from 'react';
import { UserProfile } from '../types';
import { useAuth } from '../hooks/useAuth';
import useLocalStorage from '../hooks/useLocalStorage';
import { getRateForCountry } from '../services/taxService';

interface UserProfileContextType {
  userProfile: UserProfile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

export const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const UserProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const storageKey = user ? `fahrtenbuch_user_profile_${user.id}` : null;
  
  const [userProfile, setUserProfile] = useLocalStorage<UserProfile | null>(storageKey, () => {
    if (!user) return null;
    // This function provides a default profile for new users or if no profile is found in storage.
    return {
        // FIX: Add a stable ID to the user profile to conform to the UserProfile interface.
        id: `profile-${user.id}`,
        name: user.email.split('@')[0],
        country: 'AT', // Default to Austria
        ratePerKm: getRateForCountry('AT'),
        color: '#374151',
    };
  });
  
  const value = { userProfile, setUserProfile };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
};
