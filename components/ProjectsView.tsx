import React, { useState, useMemo } from 'react';
// FIX: Import View type for stronger prop typing.
import { Project, Trip, View, PersonalizationSettings } from '../types';
import useTrips from '../hooks/useTrips';
import { EditIcon, TrashIcon, PlusIcon, SearchIcon, StarIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import useUserProfile from '../hooks/useUserProfile';
import ProjectEditorModal from './ProjectEditorModal';
import ProjectDetailModal from './ProjectDetailModal';
import { calculateTripReimbursement } from '../services/taxService';
import useDashboardSettings from '../hooks/useDashboardSettings';

interface ProjectsViewProps {
    setCurrentView: (view: View) => void;
    personalization: PersonalizationSettings;
    theme: 'light' | 'dark';
}

const ProjectsView: React.FC<ProjectsViewProps> = ({ setCurrentView, personalization, theme }) => {
  const { projects, trips, deleteProject, deleteMultipleProjects } = useTrips();
  const { userProfile } = useUserProfile();
  const { visibleProjectIds, toggleProjectVisibility } = useDashboardSettings();
  
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  
  const { t } = useTranslation();

  const userProjects = useMemo(() => {
    if (!userProfile) return [];

    return projects
      .map(project => {
        const projectTrips = trips.filter(trip => trip.projectId === project.id);
        const totalKm = projectTrips.reduce((sum, trip) => sum + trip.distance, 0);
        const totalReimbursement = projectTrips.reduce((sum, trip) => sum + calculateTripReimbursement(trip, userProfile, project), 0);

        return {
          ...project,
          tripCount: projectTrips.length,
          documentCount: project.callsheets?.length || 0,
          totalKm,
          totalReimbursement
        };
      });
  }, [projects, trips, userProfile]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery) return userProjects;
    return userProjects.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.producer.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [userProjects, searchQuery]);

  const handleAddNew = () => {
    setSelectedProject(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (project: Project) => {
    setSelectedProject(project);
    setIsEditorOpen(true);
  };
  
  const handleViewDetails = (project: Project) => {
    setSelectedProject(project);
    setIsDetailOpen(true);
  };

  const handleDelete = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
     if (window.confirm(t('projects_deleteConfirm'))) {
        await deleteProject(project.id);
     }
  };

  const handleSelectProject = (id: string) => {
    setSelectedProjectIds(prev =>
      prev.includes(id) ? prev.filter(projectId => projectId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedProjectIds(filteredProjects.map(p => p.id));
    } else {
      setSelectedProjectIds([]);
    }
  };

  const handleDeleteSelected = async () => {
    if (window.confirm(t('projects_delete_selected_confirm', { count: selectedProjectIds.length }))) {
      await deleteMultipleProjects(selectedProjectIds);
      setSelectedProjectIds([]);
    }
  };

  const isAllSelected = filteredProjects.length > 0 && selectedProjectIds.length === filteredProjects.length;

  const contentStyle = {
    backgroundColor: theme === 'dark'
        ? `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`
        : `rgba(243, 244, 246, ${1 - personalization.uiTransparency})`,
    backdropFilter: `blur(${personalization.uiBlur}px)`,
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        {selectedProjectIds.length > 0 ? (
          <div className="flex items-center gap-4 w-full">
            <h2 className="text-xl font-semibold text-white">{t('projects_selected_count', { count: selectedProjectIds.length })}</h2>
            <button
              onClick={handleDeleteSelected}
              className="flex items-center bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg transition-colors ml-auto"
            >
              <TrashIcon className="w-5 h-5 mr-2" />
              {t('projects_delete_selected_btn')}
            </button>
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-3xl font-bold text-white">{t('projects_title')}</h1>
              {userProfile && <h2 className="text-lg font-semibold text-brand-primary">{userProfile.name}</h2>}
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                  <input
                      type="text"
                      placeholder={t('projects_search_placeholder')}
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="bg-surface-dark border border-gray-600 rounded-lg py-2 pl-10 pr-4 focus:ring-2 focus:ring-brand-primary focus:outline-none text-on-surface-dark"
                  />
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-dark-secondary" />
              </div>
              <button 
                onClick={handleAddNew} 
                className="flex items-center bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                {t('projects_addNew')}
              </button>
            </div>
          </>
        )}
      </div>
      
      <div style={contentStyle} className="rounded-lg shadow-lg overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-700/50">
            <tr>
              <th className="p-4 w-12">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  disabled={filteredProjects.length === 0}
                  className="bg-background-dark border border-gray-600 rounded text-brand-primary focus:ring-brand-primary focus:ring-2 h-5 w-5"
                />
              </th>
              <th className="p-4 text-sm font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('projects_col_name')}</th>
              <th className="p-4 text-sm font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('projects_col_producer')}</th>
              <th className="p-4 text-sm font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('projects_col_trips')}</th>
              <th className="p-4 text-sm font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('projects_col_documents')}</th>
              <th className="p-4 text-sm font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('projects_col_total_km')}</th>
              <th className="p-4 text-sm font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('projects_col_est_cost')}</th>
              <th className="p-4 text-sm font-semibold text-on-surface-dark-secondary uppercase tracking-wider text-center">{t('projects_col_dashboard')}</th>
              <th className="p-4 text-sm font-semibold text-on-surface-dark-secondary uppercase tracking-wider text-right">{t('trips_col_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {filteredProjects.length > 0 ? filteredProjects.map(project => {
              const isSelected = selectedProjectIds.includes(project.id);
              return (
              <tr 
                key={project.id} 
                className={`${isSelected ? 'bg-brand-primary/20' : ''} hover:bg-gray-800/40 transition-colors cursor-pointer`}
                onClick={() => handleViewDetails(project)}
              >
                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleSelectProject(project.id)}
                    className="bg-background-dark border-gray-600 rounded text-brand-primary focus:ring-brand-primary focus:ring-2 h-5 w-5"
                  />
                </td>
                <td className="p-4 font-semibold text-white">{project.name}</td>
                <td className="p-4">{project.producer}</td>
                <td className="p-4">{project.tripCount}</td>
                <td className="p-4">{project.documentCount}</td>
                <td className="p-4 font-semibold text-brand-primary">{project.totalKm.toFixed(1)} km</td>
                <td className="p-4 font-semibold text-brand-secondary">€{project.totalReimbursement.toFixed(2)}</td>
                <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <button 
                        onClick={() => toggleProjectVisibility(project.id)}
                        title={t('projects_dashboard_toggle_tooltip')}
                        className="p-2 rounded-full hover:bg-gray-700/50 transition-colors"
                    >
                        <StarIcon className={`w-6 h-6 mx-auto transition-all duration-150 transform hover:scale-125 ${
                            visibleProjectIds.includes(project.id) 
                            ? 'text-yellow-400 fill-current' 
                            : 'text-gray-600 hover:text-yellow-500'
                        }`} />
                    </button>
                </td>
                <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(project); }} className="text-blue-400 hover:text-blue-300 mr-4"><EditIcon className="w-5 h-5"/></button>
                  <button onClick={(e) => handleDelete(e, project)} className="text-red-400 hover:text-red-300"><TrashIcon className="w-5 h-5"/></button>
                </td>
              </tr>
              );
            }) : (
              <tr>
                <td colSpan={9} className="text-center p-8 text-on-surface-dark-secondary">
                  {searchQuery ? t('projects_no_search_results') : t('projects_no_projects')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {isEditorOpen && (
        <ProjectEditorModal
          project={selectedProject}
          onClose={() => setIsEditorOpen(false)}
        />
      )}
      
      {isDetailOpen && selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          trips={trips.filter(t => t.projectId === selectedProject.id)}
          onClose={() => setIsDetailOpen(false)}
        />
      )}
    </div>
  );
};

export default ProjectsView;