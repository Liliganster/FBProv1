import { Trip, UserProfile, Project } from '../types';

// Fiscal rules can be expanded here over time
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
    AT: {
        2024: { ratePerKm: 0.42, passengerSurchargePerKm: 0.05 },
        2023: { ratePerKm: 0.42, passengerSurchargePerKm: 0.05 },
        default: { ratePerKm: 0.42, passengerSurchargePerKm: 0.05 },
    },
    DE: {
        2024: { ratePerKm: 0.30, passengerSurchargePerKm: 0.02 },
        2023: { ratePerKm: 0.30, passengerSurchargePerKm: 0.02 },
        default: { ratePerKm: 0.30, passengerSurchargePerKm: 0.02 },
    },
    ES: {
        2024: { ratePerKm: 0.26, passengerSurchargePerKm: 0 },
        2023: { ratePerKm: 0.26, passengerSurchargePerKm: 0 },
        default: { ratePerKm: 0.26, passengerSurchargePerKm: 0 },
    },
    default: { // Fallback for countries not specified
        default: { ratePerKm: 0.42, passengerSurchargePerKm: 0.05 },
    }
};

const getCountryCodeForRates = (country?: string): string => {
    if (!country) return 'default';
    const lowerCountry = country.toLowerCase();
    if (lowerCountry.includes('austria') || lowerCountry.includes('österreich')) return 'AT';
    if (lowerCountry.includes('germany') || lowerCountry.includes('deutschland')) return 'DE';
    if (lowerCountry.includes('spain') || lowerCountry.includes('españa')) return 'ES';
    return 'default';
};

export const getRateForCountry = (country?: string): number => {
    const countryCode = getCountryCodeForRates(country);
    const countryRules = FISCAL_RATES[countryCode] || FISCAL_RATES.default;
    // For simplicity, we use the default rate for the country, not a specific year,
    // as this is for setting a baseline in the UI.
    return countryRules.default.ratePerKm;
};

export const getPassengerSurchargeForCountry = (country?: string): number => {
    const countryCode = getCountryCodeForRates(country);
    const countryRules = FISCAL_RATES[countryCode] || FISCAL_RATES.default;
    // For simplicity, we use the default rate for the country, not a specific year,
    // as this is for setting a baseline in the UI.
    return countryRules.default.passengerSurchargePerKm;
};

export const calculateTripReimbursement = (trip: Trip, userProfile: UserProfile | null | undefined, project: Project | null | undefined): number => {
    if (!userProfile || !trip) return 0;

    const tripYear = new Date(trip.date).getFullYear();
    const countryCode = getCountryCodeForRates(userProfile.country);

    const countryRules = FISCAL_RATES[countryCode] || FISCAL_RATES.default;
    const yearRules = countryRules[tripYear] || countryRules.default;
    
    // Precedence: Trip -> Project -> User Profile -> Country Default
    const finalRatePerKm = trip.ratePerKm ?? project?.ratePerKm ?? userProfile.ratePerKm ?? yearRules.ratePerKm;
    
    const baseEarning = trip.distance * finalRatePerKm;
    const passengerEarning = trip.distance * (trip.passengers || 0) * yearRules.passengerSurchargePerKm;

    return baseEarning + passengerEarning;
};