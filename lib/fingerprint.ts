import FingerprintJS from '@fingerprintjs/fingerprintjs';

// Singleton promise to prevent multiple initializations
const fpPromise = FingerprintJS.load();

export const getDeviceFingerprint = async (): Promise<string> => {
    try {
        const fp = await fpPromise;
        const result = await fp.get();
        return result.visitorId;
    } catch (error) {
        console.error('Failed to get device fingerprint:', error);
        // Fallback or rethrow depending on strictness requirements
        // For now, return a placeholder or empty string to avoid blocking legitimate errors
        return 'unknown_device';
    }
};
