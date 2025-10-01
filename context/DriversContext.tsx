import React, { createContext, useState, useEffect, ReactNode } from 'react';
// FIX: Use UserProfile as Driver since Driver type was merged.
import { UserProfile as Driver } from '../types';
import useToast from '../hooks/useToast';
import useTranslation from '../hooks/useTranslation';
import useTrips from '../hooks/useTrips';
import { getRateForCountry } from '../services/taxService';
import { useAuth } from '../hooks/useAuth';
import useLocalStorage from '../hooks/useLocalStorage';

interface DriversContextType {
  drivers: Driver[];
  addDriver: (driver: Omit<Driver, 'id'>, id?: string) => void;
  updateDriver: (updatedDriver: Driver) => void;
  deleteDriver: (driverId: string) => void;
  deleteMultipleDrivers: (driverIds: string[]) => void;
}

export const DriversContext = createContext<DriversContextType | undefined>(undefined);

export const DriversProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { projects, updateProject } = useTrips();
  
  const storageKey = user ? `fahrtenbuch_drivers_${user.id}` : null;
  const [drivers, setDrivers] = useLocalStorage<Driver[]>(storageKey, []);
  
  const mainDriverId = user ? `driver-main-${user.id}` : null;

  const addDriver = (driver: Omit<Driver, 'id'>, id?: string) => {
    if (drivers.length >= 20) {
      showToast(t('drivers_alert_max_drivers'), 'warning');
      return;
    }
    const rate = driver.ratePerKm ?? getRateForCountry(driver.country);
    const newId = id || `driver-${Date.now()}`;
    const newDriver = { ...driver, ratePerKm: rate, id: newId };
    setDrivers(prev => [...prev, newDriver]);
  };

  const updateDriver = (updatedDriver: Driver) => {
    setDrivers(prev => prev.map(d => d.id === updatedDriver.id ? updatedDriver : d));
  };

  const deleteDriver = (driverId: string) => {
    const adminDriverExists = drivers.some(d => d.id === mainDriverId && d.id !== driverId);
    
    projects.filter(p => p.ownerDriverId === driverId)
      .forEach(p => {
        updateProject({ ...p, ownerDriverId: adminDriverExists ? mainDriverId : undefined });
      });

    setDrivers(prev => prev.filter(d => d.id !== driverId));
  };

  const deleteMultipleDrivers = (driverIds: string[]) => {
    const adminDriverExists = drivers.some(d => d.id === mainDriverId && !driverIds.includes(d.id));

    projects.filter(p => p.ownerDriverId && driverIds.includes(p.ownerDriverId))
      .forEach(p => {
          updateProject({ ...p, ownerDriverId: adminDriverExists ? mainDriverId : undefined });
      });
      
    setDrivers(prev => prev.filter(d => !driverIds.includes(d.id)));
  };

  const value = {
    drivers,
    addDriver,
    updateDriver,
    deleteDriver,
    deleteMultipleDrivers,
  };

  return (
    <DriversContext.Provider value={value}>
      {children}
    </DriversContext.Provider>
  );
};