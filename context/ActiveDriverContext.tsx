import React, { createContext, useState, useEffect, ReactNode, useMemo } from 'react';
import useDrivers from '../hooks/useDrivers';
// FIX: Use UserProfile as Driver since Driver type was merged.
import { UserProfile as Driver } from '../types';
import { useAuth } from '../hooks/useAuth';

interface ActiveDriverContextType {
  activeDriver: Driver | null;
  setActiveDriverId: (driverId: string | null) => void;
}

export const ActiveDriverContext = createContext<ActiveDriverContextType | undefined>(undefined);

export const ActiveDriverProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { drivers } = useDrivers();
  const storageKey = user ? `fahrtenbuch_active_driver_id_${user.id}` : null;
  
  const [activeDriverId, setActiveDriverId] = useState<string | null>(() => {
    if (!storageKey) return null;
    return localStorage.getItem(storageKey);
  });

  useEffect(() => {
    if (storageKey && activeDriverId) {
      localStorage.setItem(storageKey, activeDriverId);
    } else if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  }, [activeDriverId, storageKey]);
  
  // Handle user login/logout
  useEffect(() => {
      if(!user) {
          setActiveDriverId(null);
      } else {
          // On login, load last active driver for this user
          const savedId = localStorage.getItem(`fahrtenbuch_active_driver_id_${user.id}`);
          setActiveDriverId(savedId);
      }
  }, [user]);

  // Set a default active driver if none is set or the saved one is invalid
  useEffect(() => {
    if (user && drivers.length > 0) {
      const activeDriverExists = drivers.some(d => d.id === activeDriverId);
      if (!activeDriverId || !activeDriverExists) {
        const mainDriverId = `driver-main-${user.id}`;
        const mainDriver = drivers.find(d => d.id === mainDriverId);
        setActiveDriverId(mainDriver ? mainDriver.id : drivers[0].id);
      }
    }
  }, [drivers, activeDriverId, user]);

  const activeDriver = useMemo(() => {
    return drivers.find(d => d.id === activeDriverId) || null;
  }, [drivers, activeDriverId]);

  const value = {
    activeDriver,
    setActiveDriverId,
  };

  return (
    <ActiveDriverContext.Provider value={value}>
      {children}
    </ActiveDriverContext.Provider>
  );
};