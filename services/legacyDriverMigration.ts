import { UserProfile } from '../types';
import { getRateForCountry } from './taxService';

const PROFILE_FIELDS_TO_MERGE: (keyof UserProfile)[] = [
  'name',
  'licensePlate',
  'uid',
  'address',
  'city',
  'country',
  'profilePicture',
  'color',
  'ratePerKm',
  'vehicleType',
  'fuelConsumption',
  'fuelPrice',
  'energyConsumption',
  'energyPrice',
  'maintenanceCostPerKm',
  'parkingCostPerKm',
  'tollsCostPerKm',
  'finesCostPerKm',
  'miscCostPerKm',
];

const parseDriverRecords = (raw: string | null): Partial<UserProfile>[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed && typeof parsed === 'object') {
      return [parsed];
    }
  } catch (error) {
    console.error('Failed to parse legacy driver data', error);
  }

  return [];
};

const selectPrimaryDriver = (
  drivers: Partial<UserProfile>[],
  userId: string,
): Partial<UserProfile> | null => {
  if (drivers.length === 0) {
    return null;
  }

  const mainDriverId = `driver-main-${userId}`;
  return (
    drivers.find(driver => driver && 'id' in driver && driver.id === mainDriverId) ||
    drivers[0]
  );
};

const mergeProfileWithDriver = (
  existingProfile: UserProfile | null,
  driver: Partial<UserProfile>,
  userId: string,
  fallbackName: string,
): UserProfile => {
  const defaultCountry = driver.country || existingProfile?.country || 'AT';
  const baseProfile: UserProfile = existingProfile
    ? { ...existingProfile }
    : {
        id: `profile-${userId}`,
        name: fallbackName,
        country: defaultCountry,
        ratePerKm: getRateForCountry(defaultCountry),
        color: '#374151',
      };

  const updatedProfile: UserProfile = { ...baseProfile };

  PROFILE_FIELDS_TO_MERGE.forEach(field => {
    const driverValue = driver[field];
    if (driverValue === undefined || driverValue === null || driverValue === '') {
      return;
    }

    const currentValue = updatedProfile[field];
    const shouldOverwrite =
      currentValue === undefined ||
      currentValue === null ||
      currentValue === '';

    if (shouldOverwrite) {
      // @ts-expect-error - dynamic assignment across known keys
      updatedProfile[field] = driverValue;
    }
  });

  if (!updatedProfile.name) {
    updatedProfile.name = fallbackName;
  }

  if (!updatedProfile.country) {
    updatedProfile.country = 'AT';
  }

  if (!updatedProfile.ratePerKm) {
    const country = updatedProfile.country || 'AT';
    updatedProfile.ratePerKm = getRateForCountry(country);
  }

  if (!updatedProfile.color) {
    updatedProfile.color = '#374151';
  }

  return updatedProfile;
};

export const migrateLegacyDrivers = (
  userId: string,
  fallbackName: string,
  targetKey: string,
  sourceKeys: string[],
): UserProfile | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const uniqueKeys = Array.from(new Set(sourceKeys.filter(Boolean)));
  let primaryDriver: Partial<UserProfile> | null = null;

  uniqueKeys.forEach(key => {
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      return;
    }

    const drivers = parseDriverRecords(raw);
    if (!primaryDriver && drivers.length > 0) {
      primaryDriver = selectPrimaryDriver(drivers, userId);
    }

    window.localStorage.removeItem(key);
  });

  const activeDriverKey = `fahrtenbuch_active_driver_id_${userId}`;
  if (window.localStorage.getItem(activeDriverKey)) {
    window.localStorage.removeItem(activeDriverKey);
  }

  if (!primaryDriver) {
    return null;
  }

  let existingProfile: UserProfile | null = null;
  const existingRaw = window.localStorage.getItem(targetKey);
  if (existingRaw) {
    try {
      existingProfile = JSON.parse(existingRaw) as UserProfile;
    } catch (error) {
      console.error('Failed to parse existing user profile during migration', error);
    }
  }

  const mergedProfile = mergeProfileWithDriver(existingProfile, primaryDriver, userId, fallbackName);
  window.localStorage.setItem(targetKey, JSON.stringify(mergedProfile));
  return mergedProfile;
};
