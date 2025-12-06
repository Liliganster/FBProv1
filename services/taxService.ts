import { Trip, UserProfile, Project } from '../types';

// Fiscal rules can be expanded here over time
// USER REQUEST: No default values. Rates are established by the user.
// We keep the structure but set all system defaults to 0.
interface RateRules {
    [countryCode: string]: {
        [year: number]: {
            ratePerKm: number;
            passengerSurchargePerKm: number;
        };
        default: { // Fallback for years not specified
            ratePerKm: number;
            passengerSurchargePerKm: number;
        };
    };
}

const FISCAL_RATES: RateRules = {
    default: { // Fallback for countries not specified
        default: { ratePerKm: 0, passengerSurchargePerKm: 0 },
    }
};

const getCountryCodeForRates = (country?: string): string => {
    // We no longer match countries to specific rates as per user request.
    return 'default';
};

export const getRateForCountry = (country?: string): number => {
    // Always return 0 as system default. User must set their own rate.
    return 0;
};

export const getPassengerSurchargeForCountry = (country?: string): number => {
    // Always return 0 as system default. User must set their own rate.
    return 0;
};

export const calculateTripReimbursement = (trip: Trip, userProfile: UserProfile | null | undefined, project: Project | null | undefined): number => {
    if (!userProfile || !trip) return 0;

    // Precedence: Trip -> Project -> User Profile -> System Default (0)
    // Note: userProfile.ratePerKm should be the primary source if trip/project don't override.

    const finalRatePerKm = trip.ratePerKm ?? project?.ratePerKm ?? userProfile.ratePerKm ?? 0;
    const passengerRatePerKm = userProfile.passengerSurchargePerKm ?? 0;

    const baseEarning = trip.distance * finalRatePerKm;
    const passengerEarning = trip.distance * (trip.passengers || 0) * passengerRatePerKm;

    return baseEarning + passengerEarning;
};
