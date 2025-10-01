import React from 'react';
import { UserProfile } from '../types';
import { UserCircleIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import Avatar from './Avatar';
import useUserProfile from '../hooks/useUserProfile';

type View = 'dashboard' | 'trips' | 'projects' | 'settings' | 'reports' | 'calendar';

interface AdminProfileWidgetProps {
    setCurrentView: (view: View) => void;
    currentView: View;
}

const AdminProfileWidget: React.FC<AdminProfileWidgetProps> = ({ setCurrentView, currentView }) => {
    const { t } = useTranslation();
    const { userProfile } = useUserProfile();

    const displayName = userProfile?.name || t('settings_profile_fullName');
    const displayProfile = userProfile || { name: displayName };

    return (
        <div
            onClick={() => setCurrentView('settings')}
            className={`flex items-center p-3 mb-2 rounded-lg cursor-pointer transition-colors border ${
                currentView === 'settings'
                    ? 'bg-brand-primary/20 border-brand-primary/50 text-white'
                    : 'border-transparent hover:bg-surface-dark/60'
            }`}
            role="button"
            aria-label={`Navigate to User Settings`}
        >
            {displayProfile ? (
                <Avatar profile={displayProfile} className="w-8 h-8 flex-shrink-0" />
            ) : (
                <UserCircleIcon className="w-8 h-8 flex-shrink-0" />
            )}
            <div className="ml-3 overflow-hidden">
                <p className="font-semibold text-sm truncate" title={displayName}>{displayName}</p>
                <p className="text-xs text-on-surface-dark-secondary">{t('nav_settings')}</p>
            </div>
        </div>
    );
};

export default AdminProfileWidget;