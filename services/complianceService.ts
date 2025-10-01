import { Trip } from '../types';

/**
 * Generates a SHA-256 hash for a given string.
 * @param data The string to hash.
 * @returns A promise that resolves to the hex-encoded hash string.
 */
export const generateHash = async (data: string): Promise<string> => {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
};

/**
 * Creates a consistent, serializable string payload for a trip to be hashed.
 * The order of properties is fixed to ensure consistent hashing.
 * @param trip The trip object.
 * @param previousHash The hash of the previous trip in the chain.
 * @returns A JSON string of the trip's essential data.
 */
export const createTripHashPayload = (trip: Trip, previousHash: string): string => {
    // Create a new object to ensure property order and avoid including the old hash in the new hash calculation
    const payload = {
        id: trip.id,
        date: trip.date,
        locations: trip.locations,
        distance: trip.distance,
        projectId: trip.projectId,
        reason: trip.reason,
        specialOrigin: trip.specialOrigin,
        passengers: trip.passengers || 0,
        previousHash: previousHash,
    };
    return JSON.stringify(payload);
};