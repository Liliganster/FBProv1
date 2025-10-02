import React, { useMemo } from 'react';
import useTrips from '../hooks/useTrips';
import useUserProfile from '../hooks/useUserProfile';
import { UsersIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import Avatar from './Avatar';

interface DriversViewProps {
  theme: 'light' | 'dark';
}

const DriversView: React.FC<DriversViewProps> = ({ theme }) => {
  const { trips, projects } = useTrips();
  const { userProfile } = useUserProfile();
  const { t } = useTranslation();

  const currentDriverStats = useMemo(() => {
    if (!userProfile) return { totalKm: 0, projectCount: 0 };
    
    // All trips belong to the current user
    const totalKm = trips.reduce((sum, trip) => sum + trip.distance, 0);
    const projectCount = new Set(trips.map(trip => trip.projectId)).size;
    
    return { totalKm, projectCount };
  }, [trips, userProfile]);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">{t('drivers_title')}</h1>
      </div>

      {userProfile ? (
        <div className="bg-surface-dark rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar profile={userProfile} className="w-16 h-16" />
            <div>
              <h2 className="text-2xl font-bold text-white">{userProfile.name}</h2>
              <p className="text-on-surface-dark-secondary">
                {userProfile.licensePlate ? `Matrícula: ${userProfile.licensePlate}` : 'Sin matrícula registrada'}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-700/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <UsersIcon className="w-8 h-8 text-brand-primary" />
                <div>
                  <p className="text-sm text-on-surface-dark-secondary">Total de Kilómetros</p>
                  <p className="text-xl font-bold text-brand-primary">{currentDriverStats.totalKm.toFixed(1)} km</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-700/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <UsersIcon className="w-8 h-8 text-green-400" />
                <div>
                  <p className="text-sm text-on-surface-dark-secondary">Proyectos Activos</p>
                  <p className="text-xl font-bold text-green-400">{currentDriverStats.projectCount}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-700/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <UsersIcon className="w-8 h-8 text-purple-400" />
                <div>
                  <p className="text-sm text-on-surface-dark-secondary">Total de Viajes</p>
                  <p className="text-xl font-bold text-purple-400">{trips.length}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-blue-300">
              <strong>Nota:</strong> Esta aplicación ahora funciona con un único conductor (tu perfil de usuario). 
              Todos los viajes y proyectos están asociados a tu cuenta.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-surface-dark rounded-lg shadow-lg p-6">
          <div className="text-center">
            <UsersIcon className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <p className="text-on-surface-dark-secondary">No se ha encontrado información del conductor.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriversView;