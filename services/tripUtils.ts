import { Trip } from '../types';

/**
 * Normalizes a trip signature by combining date and locations into a unique identifier
 * for duplicate detection purposes.
 * @param date The trip date in ISO format
 * @param locations Array of location strings for the trip
 * @returns A normalized signature string for duplicate comparison
 */
export const normalizeSignature = (date: string, locations: string[]): string => {
    // Normalize locations: trim, lowercase, normalize spaces, filter empty
    const normalizedLocations = locations
        .filter(l => l && l.trim()) // Remove empty locations
        .map(l => l.trim().toLowerCase().replace(/\s+/g, ' '))
        .join('→'); // Use arrow separator for better readability
    
    return `${date}|${normalizedLocations}`;
};

/**
 * Checks if a trip is a duplicate of existing trips based on date and locations
 * @param tripToCheck The trip data to check for duplicates
 * @param existingTrips Array of existing trips to compare against
 * @param excludeTripId Optional trip ID to exclude from duplicate check (for editing scenarios)
 * @returns true if a duplicate is found, false otherwise
 */
export const isDuplicateTrip = (
    tripToCheck: { date: string; locations: string[] },
    existingTrips: Trip[],
    excludeTripId?: string
): boolean => {
    const signatureToCheck = normalizeSignature(tripToCheck.date, tripToCheck.locations);
    
    return existingTrips
        .filter(trip => excludeTripId ? trip.id !== excludeTripId : true)
        .some(trip => normalizeSignature(trip.date, trip.locations) === signatureToCheck);
};

/**
 * Gets all trips that match the signature of the given trip data
 * @param tripToCheck The trip data to find duplicates for
 * @param existingTrips Array of existing trips to search in
 * @param excludeTripId Optional trip ID to exclude from results
 * @returns Array of duplicate trips found
 */
export const findDuplicateTrips = (
    tripToCheck: { date: string; locations: string[] },
    existingTrips: Trip[],
    excludeTripId?: string
): Trip[] => {
    const signatureToCheck = normalizeSignature(tripToCheck.date, tripToCheck.locations);
    
    return existingTrips
        .filter(trip => excludeTripId ? trip.id !== excludeTripId : true)
        .filter(trip => normalizeSignature(trip.date, trip.locations) === signatureToCheck);
};