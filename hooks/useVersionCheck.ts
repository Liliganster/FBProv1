import { useState, useEffect, useCallback } from 'react';

// Use build-time constant injected by Vite
// Fallback to current time if dev environment
const CURRENT_BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined'
    ? __BUILD_TIME__
    : new Date().toISOString();

interface VersionData {
    buildTime: string;
    commitHash: string;
}

export const useVersionCheck = (intervalMs = 60 * 1000) => {
    const [hasUpdate, setHasUpdate] = useState(false);
    const [serverVersion, setServerVersion] = useState<string | null>(null);

    const checkVersion = useCallback(async () => {
        // Skip check in development if we don't have a stable build time (or rely on HMR)
        // if (import.meta.env.DEV) return;

        try {
            // Add timestamp to prevent browser caching of the JSON file itself
            const response = await fetch(`/version.json?t=${Date.now()}`, {
                cache: 'no-store',
            });

            if (!response.ok) return;

            const data: VersionData = await response.json();

            // Compare build times
            // If server build time is newer than client build time -> Update available
            if (data.buildTime && data.buildTime !== CURRENT_BUILD_TIME) {
                // Double check to ensure it's not actually OLDER (e.g. rollback)
                // Ideally we compare strict inequality, but string comparison of ISO dates works
                if (data.buildTime > CURRENT_BUILD_TIME) {
                    console.info(`[VersionCheck] Update available. Client: ${CURRENT_BUILD_TIME}, Server: ${data.buildTime}`);
                    setServerVersion(data.buildTime);
                    setHasUpdate(true);
                }
            }
        } catch (error) {
            // Silent fail (network error, offline, etc.)
            console.debug('[VersionCheck] Failed to check version', error);
        }
    }, []);

    useEffect(() => {
        // Initial check
        checkVersion();

        // Polling interval
        const interval = setInterval(checkVersion, intervalMs);

        // Also check when window regains focus (user comes back to tab)
        const onFocus = () => checkVersion();
        window.addEventListener('focus', onFocus);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
        };
    }, [checkVersion, intervalMs]);

    const reloadPage = () => {
        // Force reload bypassing cache
        window.location.reload();
    };

    return { hasUpdate, reloadPage, currentVersion: CURRENT_BUILD_TIME, serverVersion };
};
