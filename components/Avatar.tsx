import React from 'react';
import { UserProfile } from '../types';

interface AvatarProps {
  profile: Partial<UserProfile>;
  className?: string;
}

const getInitials = (name = '') => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
};

const Avatar: React.FC<AvatarProps> = ({ profile, className = 'w-10 h-10' }) => {
  const initials = getInitials(profile.name);
  const color = profile.color || '#374151'; // default gray

  if (profile.profilePicture) {
    return (
      <img
        src={profile.profilePicture}
        alt={profile.name || 'Profile'}
        loading="lazy"
        decoding="async"
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold text-white ${className}`}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
};

// FIX: Add default export to make the component available for import.
export default Avatar;
