import React, { useState, useMemo } from 'react';
import useDrivers from '../hooks/useDrivers';
import useTrips from '../hooks/useTrips';
// FIX: Use UserProfile as Driver since Driver type was merged.
import { UserProfile as Driver } from '../types';
import { PlusIcon, EditIcon, TrashIcon, UsersIcon, StarIcon, SearchIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import DriverEditorModal from './DriverEditorModal';
import useActiveDriver from '../hooks/useActiveDriver';
import Avatar from './Avatar';

const DriversView: React.FC = () => {
  const { drivers, addDriver, updateDriver, deleteDriver, deleteMultipleDrivers } = useDrivers();
  // FIX: Fetch projects along with trips to link them to drivers.
  const { trips, projects } = useTrips();
  const { activeDriver, setActiveDriverId } = useActiveDriver();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { t } = useTranslation();

  const driverStats = useMemo(() => {
    return drivers.map(driver => {
      // FIX: Filter trips based on the project's ownerDriverId instead of the non-existent trip.driverId.
      const driverTrips = trips.filter(trip => {
        const project = projects.find(p => p.id === trip.projectId);
        return project?.ownerDriverId === driver.id;
      });
      const totalKm = driverTrips.reduce((sum, trip) => sum + trip.distance, 0);
      const projectCount = new Set(driverTrips.map(trip => trip.projectId)).size;
      return { ...driver, totalKm, projectCount };
    });
  }, [drivers, trips, projects]);

  const filteredDrivers = useMemo(() => {
    if (!searchQuery) return driverStats;
    return driverStats.filter(driver =>
        driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (driver.licensePlate && driver.licensePlate.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [driverStats, searchQuery]);

  const handleAdd = () => {
    setEditingDriver(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setIsEditorOpen(true);
  };

  const handleSave = (driver: Omit<Driver, 'id'> | Driver) => {
    if ('id' in driver) {
      updateDriver(driver);
    } else {
      addDriver(driver);
    }
    setIsEditorOpen(false);
  };

  const handleDelete = (driverId: string) => {
    if (window.confirm(t('drivers_delete_confirm'))) {
      deleteDriver(driverId);
    }
  };

  const handleSelectDriver = (id: string) => {
    setSelectedDriverIds(prev =>
      prev.includes(id) ? prev.filter(driverId => driverId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedDriverIds(filteredDrivers.map(d => d.id));
    } else {
      setSelectedDriverIds([]);
    }
  };

  const handleDeleteSelected = () => {
    if (window.confirm(t('drivers_delete_selected_confirm', { count: selectedDriverIds.length }))) {
      deleteMultipleDrivers(selectedDriverIds);
      setSelectedDriverIds([]);
    }
  };

  const isAllSelected = filteredDrivers.length > 0 && selectedDriverIds.length === filteredDrivers.length;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        {selectedDriverIds.length > 0 ? (
          <div className="flex items-center gap-4 w-full">
            <h2 className="text-xl font-semibold text-white">{t('trips_selected_count', { count: selectedDriverIds.length })}</h2>
            <button
              onClick={handleDeleteSelected}
              className="flex items-center bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg transition-colors ml-auto"
            >
              <TrashIcon className="w-5 h-5 mr-2" />
              {t('trips_delete_selected_btn')}
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-white">{t('drivers_title')}</h1>
            <div className="flex items-center gap-4">
               <div className="relative">
                   <input
                       type="text"
                       placeholder={t('drivers_search_placeholder')}
                       value={searchQuery}
                       onChange={e => setSearchQuery(e.target.value)}
                       className="bg-surface-dark border border-gray-600 rounded-lg py-2 pl-10 pr-4 focus:ring-2 focus:ring-brand-primary focus:outline-none text-on-surface-dark"
                   />
                   <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-dark-secondary" />
               </div>
               <button onClick={handleAdd} className="flex items-center bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                 <PlusIcon className="w-5 h-5 mr-2" />
                 {t('drivers_add_btn')}
               </button>
           </div>
          </>
        )}
      </div>

      <div className="bg-surface-dark rounded-lg shadow-lg overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-700/50">
            <tr>
              <th className="p-4 w-12">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  disabled={filteredDrivers.length === 0}
                  className="bg-background-dark border-gray-600 rounded text-brand-primary focus:ring-brand-primary focus:ring-2 h-5 w-5"
                />
              </th>
              <th className="p-4 text-sm font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('drivers_col_name')}</th>
              <th className="p-4 text-sm font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('drivers_col_license')}</th>
              <th className="p-4 text-sm font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('drivers_col_projects')}</th>
              <th className="p-4 text-sm font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('drivers_col_total_km')}</th>
              <th className="p-4 text-sm font-semibold text-on-surface-dark-secondary uppercase tracking-wider text-right">{t('drivers_col_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {filteredDrivers.length > 0 ? filteredDrivers.map(driver => {
              const isSelected = selectedDriverIds.includes(driver.id);
              const isActive = activeDriver?.id === driver.id;
              return (
                <tr 
                  key={driver.id} 
                  onClick={() => setActiveDriverId(driver.id)}
                  className={`${isSelected ? 'bg-brand-primary/20' : ''} ${isActive ? 'bg-brand-primary/30' : ''} hover:bg-gray-800/40 transition-colors cursor-pointer border-l-4`}
                  style={{ borderColor: driver.color || 'transparent' }}
                >
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectDriver(driver.id)}
                      className="bg-background-dark border-gray-600 rounded text-brand-primary focus:ring-brand-primary focus:ring-2 h-5 w-5"
                    />
                  </td>
                  <td className="p-4 font-semibold text-white flex items-center gap-3">
                    {/* FIX: Use 'profile' prop instead of 'driver' for Avatar component */}
                    <Avatar profile={driver} className="w-10 h-10" />
                    <span>{driver.name}</span>
                    {isActive && <StarIcon className="w-4 h-4 ml-2 text-yellow-400 fill-current" />}
                  </td>
                  <td className="p-4">{driver.licensePlate || 'N/A'}</td>
                  <td className="p-4">{driver.projectCount}</td>
                  <td className="p-4 font-bold text-brand-primary">{driver.totalKm.toFixed(1)} km</td>
                  <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleEdit(driver)} className="text-blue-400 hover:text-blue-300 mr-4"><EditIcon className="w-5 h-5"/></button>
                    <button onClick={() => handleDelete(driver.id)} className="text-red-400 hover:text-red-300"><TrashIcon className="w-5 h-5"/></button>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={6} className="text-center p-8 text-on-surface-dark-secondary">
                   <div className="flex flex-col items-center">
                    <UsersIcon className="w-12 h-12 mb-2 text-gray-600"/>
                    {driverStats.length === 0 ? t('drivers_no_drivers') : t('drivers_no_search_results')}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isEditorOpen && (
        <DriverEditorModal
          driver={editingDriver}
          onSave={handleSave}
          onClose={() => setIsEditorOpen(false)}
        />
      )}
    </div>
  );
};

export default DriversView;