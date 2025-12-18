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

const STORAGE_KEYS = {
    ATTEMPTS: 'fahrtenbuch_update_attempts',
    LAST_ATTEMPT: 'fahrtenbuch_last_update_attempt',
};

export const useVersionCheck = (intervalMs = 60 * 1000) => {
    const [hasUpdate, setHasUpdate] = useState(false);
    const [serverVersion, setServerVersion] = useState<string | null>(null);

    const reloadPage = async (forceNuclear: boolean = false) => {
        const attempts = parseInt(localStorage.getItem(STORAGE_KEYS.ATTEMPTS) || '0', 10);
        localStorage.setItem(STORAGE_KEYS.ATTEMPTS, (attempts + 1).toString());
        localStorage.setItem(STORAGE_KEYS.LAST_ATTEMPT, Date.now().toString());

        console.log(`[VersionCheck] Reloading page (Attempt ${attempts + 1})... Nuclear: ${forceNuclear}`);

        // 1. Unregister service workers (Always do this on update)
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
            } catch (e) { console.error('Error unregistering SW:', e); }
        }

        // 2. Clear Caches (Nuclear or Persistent loop)
        if (forceNuclear || attempts >= 2) {
            if ('caches' in window) {
                try {
                    const cacheNames = await caches.keys();
                    for (const name of cacheNames) {
                        await caches.delete(name);
                    }
                } catch (e) { console.error('Error clearing caches:', e); }
            }
        }

        // 3. Force Reload with Cache Busting
        const url = new URL(window.location.href);
        url.searchParams.set('reload', Date.now().toString());

        // Replace state to avoid history pollution, then reload
        window.history.replaceState({}, '', url.toString());

        // Critical: Force reload from server
        window.location.reload();
    };

    const checkVersion = useCallback(async () => {
        if (import.meta.env.DEV) return;

        try {
            // Cache-busting for the JSON itself
            const response = await fetch(`/version.json?t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });

            if (!response.ok) return;

            const data: VersionData = await response.json();

            if (data.buildTime && data.buildTime !== CURRENT_BUILD_TIME) {
                // Determine if server is actually NEWER (string ISO comparison)
                if (data.buildTime > CURRENT_BUILD_TIME) {
                    console.info(`[VersionCheck] Update available. Client: ${CURRENT_BUILD_TIME} < Server: ${data.buildTime}`);

                    setServerVersion(data.buildTime);
                    setHasUpdate(true);

                    // AUTO-RECOVERY LOGIC
                    // Check if we just tried to update and failed (within last 5 mins)
                    const lastAttempt = parseInt(localStorage.getItem(STORAGE_KEYS.LAST_ATTEMPT) || '0', 10);
                    const now = Date.now();
                    const justTried = (now - lastAttempt) < 5 * 60 * 1000; // 5 mins

                    if (justTried) {
                        const attempts = parseInt(localStorage.getItem(STORAGE_KEYS.ATTEMPTS) || '0', 10);
                        console.warn(`[VersionCheck] Loop detected! Attempts: ${attempts}. Triggering auto-recovery.`);

                        // If we are stuck in a loop (attempts > 0), force reload immediately
                        if (attempts < 5) { // Safety cap to prevent infinite reload loop if server is broken
                            setTimeout(() => reloadPage(attempts >= 2), 1000);
                        } else {
                            // Too many failures, maybe stop and let user decide?
                            // Or reset counter to try again later?
                            console.error('[VersionCheck] Too many update failures. Stopping auto-reload.');
                        }
                    } else {
                        // Reset attempts if it's been a while since last try
                        if (now - lastAttempt > 60 * 60 * 1000) { // 1 hour
                            localStorage.setItem(STORAGE_KEYS.ATTEMPTS, '0');
                        }
                    }
                }
            } else {
                // Version matches! Clear attempts
                localStorage.setItem(STORAGE_KEYS.ATTEMPTS, '0');
            }
        } catch (error) {
            console.debug('[VersionCheck] Failed to check version', error);
        }
    }, []);

    useEffect(() => {
        checkVersion();
        const interval = setInterval(checkVersion, intervalMs);
        const onFocus = () => checkVersion();
        window.addEventListener('focus', onFocus);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
        };
    }, [checkVersion, intervalMs]);

    return { hasUpdate, reloadPage, checkVersion, currentVersion: CURRENT_BUILD_TIME, serverVersion };
};
