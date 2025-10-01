import { useState, useEffect, useCallback } from 'react';
import useUserProfile from './useUserProfile';

const getStorageKey = (profileId: string) => `fahrtenbuch_dashboard_projects_${profileId}`;

export const useDashboardSettings = () => {
    const { userProfile } = useUserProfile();
    const [visibleProjectIds, setVisibleProjectIds] = useState<string[]>([]);

    useEffect(() => {
        if (userProfile) {
            const saved = localStorage.getItem(getStorageKey(userProfile.id));
            setVisibleProjectIds(saved ? JSON.parse(saved) : []);
        } else {
            setVisibleProjectIds([]);
        }
    }, [userProfile]);

    const toggleProjectVisibility = useCallback((projectId: string) => {
        if (!userProfile) return;

        const newVisibleIds = visibleProjectIds.includes(projectId)
            ? visibleProjectIds.filter(id => id !== projectId)
            : [...visibleProjectIds, projectId];
        
        setVisibleProjectIds(newVisibleIds);
        
        if (newVisibleIds.length > 0) {
            localStorage.setItem(getStorageKey(userProfile.id), JSON.stringify(newVisibleIds));
        } else {
            localStorage.removeItem(getStorageKey(userProfile.id));
        }
    }, [userProfile, visibleProjectIds]);
    
    const hasSettings = useCallback(() => {
       if (!userProfile) return false;
       return localStorage.getItem(getStorageKey(userProfile.id)) !== null;
    }, [userProfile]);

    return { visibleProjectIds, toggleProjectVisibility, hasSettings };
};

export default useDashboardSettings;