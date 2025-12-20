import React, { useState, useMemo, useCallback } from 'react';
// FIX: Import View type for stronger prop typing.
import { Project, Trip, View, PersonalizationSettings, ExpenseDocument } from '../types';
import useTrips from '../hooks/useTrips';
import { EditIcon, TrashIcon, PlusIcon, SearchIcon, StarIcon, FileTextIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import useUserProfile from '../hooks/useUserProfile';
import { useMobile } from '../hooks/useMediaQuery';
import ProjectEditorModal from './ProjectEditorModal';
import ProjectDetailModal from './ProjectDetailModal';
import { calculateTripReimbursement } from '../services/taxService';
import useDashboardSettings from '../hooks/useDashboardSettings';
import useUndoRedo from '../hooks/useUndoRedo';
import UndoToast from './UndoToast';
import useExpenses from '../hooks/useExpenses';
import { formatDateForDisplay } from '../i18n/translations';
import { Button } from './Button';

interface ProjectsViewProps {
  setCurrentView: (view: View) => void;
  personalization: PersonalizationSettings;
  theme: 'light' | 'dark';
}

const ProjectsView: React.FC<ProjectsViewProps> = ({ setCurrentView, personalization, theme }) => {
  const { projects, trips, addProject, deleteProject, deleteMultipleProjects } = useTrips();
  const { userProfile } = useUserProfile();
  const { visibleProjectIds, toggleProjectVisibility } = useDashboardSettings();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const { addAction, undo, getLastAction } = useUndoRedo();
  const [showUndoToast, setShowUndoToast] = useState(false);
  const { expenses } = useExpenses();
  const isMobile = useMobile();

  const { t } = useTranslation();

  const projectsById = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach(project => {
      map.set(project.id, project);
    });
    return map;
  }, [projects]);

  const tripsByProject = useMemo(() => {
    const grouped = new Map<string, Trip[]>();
    trips.forEach(trip => {
      if (!trip.projectId) return;
      if (!grouped.has(trip.projectId)) {
        grouped.set(trip.projectId, []);
      }
      grouped.get(trip.projectId)!.push(trip);
    });
    return grouped;
  }, [trips]);

  const expensesByProject = useMemo<Record<string, ExpenseDocument[]>>(() => {
    const map: Record<string, ExpenseDocument[]> = {};
    const tripToProject = new Map<string, string>();
    trips.forEach(trip => {
      if (trip.projectId) {
        tripToProject.set(trip.id, trip.projectId);
      }
    });

    expenses.forEach(expense => {
      let targetProjectId: string | undefined | null = expense.projectId;
      if (!targetProjectId && expense.tripId) {
        targetProjectId = tripToProject.get(expense.tripId) ?? null;
      }
      if (!targetProjectId) return;
      if (!map[targetProjectId]) {
        map[targetProjectId] = [];
      }
      map[targetProjectId].push(expense);
    });

    return map;
  }, [expenses, trips]);

  const formatCurrency = useCallback((value: number, currency?: string | null) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'EUR',
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${currency || 'EUR'}`;
    }
  }, []);

  const buildExpenseTooltip = useCallback((items: ExpenseDocument[]) => {
    if (!items.length) return '';
    return items
      .map(expense => {
        const label =
          expense.category === 'fuel'
            ? t('expense_category_fuel') || 'Fuel'
            : t('expense_category_maintenance') || 'Maintenance';
        const formattedDate = expense.invoiceDate ? formatDateForDisplay(expense.invoiceDate) : '';
        const parts = [
          formatCurrency(expense.amount, expense.currency),
          label,
          formattedDate,
          expense.description || '',
        ].filter(Boolean);
        return parts.join(' • ');
      })
      .join('\n');
  }, [formatCurrency, t]);

  const userProjects = useMemo(() => {
    if (!userProfile) return [];
    const uniqueProjects = Array.from(projectsById.values());

    return uniqueProjects.map(project => {
      const projectTrips = tripsByProject.get(project.id) ?? [];
      const totalKm = projectTrips.reduce((sum, trip) => sum + trip.distance, 0);
      const totalReimbursement = projectTrips.reduce((sum, trip) => sum + calculateTripReimbursement(trip, userProfile, project), 0);
      const projectExpenses = expensesByProject[project.id] ?? [];
      const expenseCount = projectExpenses.length;
      const expensesTooltip = buildExpenseTooltip(projectExpenses);

      return {
        ...project,
        tripCount: projectTrips.length,
        documentCount: project.callsheets?.length || 0,
        totalKm,
        totalReimbursement,
        expenseCount,
        expensesTooltip,
      };
    });
  }, [projectsById, tripsByProject, userProfile, expensesByProject, buildExpenseTooltip]);

  const availableYears = useMemo(() => {
    const years = new Set(projects.map(p => new Date(p.createdAt).getFullYear().toString()));
    return Array.from(years).sort().reverse();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    let filtered = userProjects;

    if (yearFilter !== 'all') {
      filtered = filtered.filter(p => new Date(p.createdAt).getFullYear().toString() === yearFilter);
    }

    if (!searchQuery) return filtered;

    return filtered.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.producer.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [userProjects, searchQuery, yearFilter]);

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

      // Add undo action
      addAction({
        type: 'delete',
        description: t('undo_action_delete_project'),
        undo: () => {
          addProject(project);
        }
      });

      setShowUndoToast(true);
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
      const projectsToDelete = projects.filter(p => selectedProjectIds.includes(p.id));
      await deleteMultipleProjects(selectedProjectIds);

      // Add undo action for multiple projects
      addAction({
        type: 'bulk_delete',
        description: t('undo_action_bulk_delete', { count: projectsToDelete.length }),
        undo: () => {
          projectsToDelete.forEach(project => addProject(project));
        }
      });

      setSelectedProjectIds([]);
      setShowUndoToast(true);
    }
  };

  const isAllSelected = filteredProjects.length > 0 && selectedProjectIds.length === filteredProjects.length;

  const contentStyle = {
    // Keep dark, high-contrast panels regardless of theme to preserve legibility
    backgroundColor: `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`,
    backdropFilter: `blur(${personalization.uiBlur}px)`,
    WebkitBackdropFilter: `blur(${personalization.uiBlur}px)`,
    border: '1px solid rgba(255, 255, 255, 0.08)',
  };

  return (
    <div className="text-on-surface-dark" id="projects-view">
      {/* Cabecera fija: el título y los filtros nunca desaparecen */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 md:mb-8 gap-4" id="projects-header">
        <div id="projects-title">
          <h1 className="text-2xl md:text-3xl font-bold text-white">{t('projects_title')}</h1>
          {userProfile && <h2 className="text-base md:text-lg font-semibold text-brand-primary">{userProfile.name}</h2>}
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full lg:w-auto">
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="bg-surface-dark border border-gray-600 rounded-smooth py-2 px-4 focus:ring-2 focus:ring-brand-primary focus:outline-none text-on-surface-dark text-sm font-medium h-[38px] flex-1 md:flex-none"
          >
            <option value="all">{t('common_all_years')}</option>
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <div className="relative flex-1 md:flex-none" id="projects-search">
            <input
              type="text"
              placeholder={t('projects_search_placeholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-surface-dark border border-gray-600 rounded-smooth py-2 pl-10 pr-4 focus:ring-2 focus:ring-brand-primary focus:outline-none text-on-surface-dark text-sm font-medium h-[38px] w-full"
            />
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-dark-secondary" />
          </div>
          <Button
            id="projects-add-btn"
            variant="primary"
            onClick={handleAddNew}
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            {t('projects_addNew')}
          </Button>
        </div>
      </div>

      {isMobile ? (
        // Vista mobile con cards
        <div className="space-y-4">
          {filteredProjects.length > 0 ? (
            <>
              {/* Banner in-line desactivado: usamos barra flotante para selección masiva */}
              {filteredProjects.map(project => {
                const isSelected = selectedProjectIds.includes(project.id);
                const invoiceCount = project.expenseCount || 0;
                const invoiceTooltip = project.expensesTooltip as string | undefined;

                return (
                  <div
                    key={project.id}
                    className={`bg-frost-glass border-glass rounded-fluid p-4 backdrop-blur-glass transition-all duration-200 ${isSelected ? 'ring-2 ring-brand-primary bg-brand-primary/10' : 'hover:bg-gray-800/40'
                      }`}
                  >
                    {/* Header con checkbox, nombre y acciones */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectProject(project.id)}
                          className="bg-background-dark border-gray-600 rounded text-brand-primary focus:ring-brand-primary focus:ring-2 h-5 w-5"
                        />
                        <h3 className="text-white font-semibold text-lg truncate cursor-pointer" onClick={() => handleViewDetails(project)}>
                          {project.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleProjectVisibility(project.id)}
                          title={t('projects_dashboard_toggle_tooltip')}
                          className="p-2 rounded-smooth hover:bg-gray-700/50 transition-colors"
                        >
                          <StarIcon className={`w-5 h-5 transition-all duration-150 transform hover:scale-125 ${visibleProjectIds.includes(project.id)
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-600 hover:text-yellow-500'
                            }`} />
                        </button>
                        <Button
                          variant="icon"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleEdit(project); }}
                          className="text-blue-400 hover:text-blue-300"
                          title={t('common_edit')}
                        >
                          <EditIcon className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="icon"
                          size="sm"
                          onClick={(e) => handleDelete(e, project)}
                          className="text-red-400 hover:text-red-300"
                          title={t('common_delete')}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Contenido principal clickeable */}
                    <div className="cursor-pointer" onClick={() => handleViewDetails(project)}>
                      {/* Productor */}
                      <div className="mb-3">
                        <span className="text-on-surface-dark-secondary text-xs uppercase tracking-wider">{t('projects_col_producer')}</span>
                        <p className="text-white">{project.producer}</p>
                      </div>

                      {/* Info en grid */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-on-surface-dark-secondary text-xs uppercase tracking-wider">{t('projects_col_trips')}</span>
                          <p className="text-white font-medium">{project.tripCount}</p>
                        </div>
                        <div>
                          <span className="text-on-surface-dark-secondary text-xs uppercase tracking-wider">{t('projects_col_documents')}</span>
                          <p className="text-white font-medium">{project.documentCount}</p>
                        </div>
                        <div>
                          <span className="text-on-surface-dark-secondary text-xs uppercase tracking-wider">{t('projects_col_total_km')}</span>
                          <p className="text-brand-primary font-semibold">{project.totalKm.toFixed(1)} km</p>
                        </div>
                        <div>
                          <span className="text-on-surface-dark-secondary text-xs uppercase tracking-wider">{t('projects_col_est_cost')}</span>
                          <p className="text-brand-secondary font-semibold">€{project.totalReimbursement.toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Invoices */}
                      {invoiceCount > 0 && (
                        <div className="mt-3">
                          <span className="text-on-surface-dark-secondary text-xs uppercase tracking-wider block mb-1">{t('projects_col_invoices')}</span>
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full bg-brand-secondary/10 px-2.5 py-1 text-[11px] font-semibold text-brand-secondary"
                            title={invoiceTooltip}
                          >
                            <FileTextIcon className="h-3.5 w-3.5" />
                            <span>{invoiceCount}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="bg-frost-glass border-glass rounded-fluid p-8 backdrop-blur-glass text-center">
              <p className="text-on-surface-dark-secondary">
                {searchQuery ? t('projects_no_search_results') : t('projects_no_projects')}
              </p>
            </div>
          )}
        </div>
      ) : (
        // Vista desktop con tabla
        <div className="-mx-4 md:mx-0">
          <div style={contentStyle} className="bg-frost-glass rounded-gentle shadow-lg overflow-x-auto" id="projects-table-wrapper">
            <table id="projects-table" className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-gray-700/50">
              <tr>
                <th id="projects-col-select" className="p-3 w-12">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    disabled={filteredProjects.length === 0}
                    className="bg-background-dark border border-gray-600 rounded text-brand-primary focus:ring-brand-primary focus:ring-2 h-5 w-5"
                  />
                </th>
                <th id="projects-col-name" className="p-3 text-[11px] font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('projects_col_name')}</th>
                <th id="projects-col-producer" className="p-3 text-[11px] font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('projects_col_producer')}</th>
                <th id="projects-col-trips" className="p-3 text-[11px] font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('projects_col_trips')}</th>
                <th id="projects-col-documents" className="p-3 text-[11px] font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('projects_col_documents')}</th>
                <th id="projects-col-invoices" className="p-3 text-[11px] font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('projects_col_invoices')}</th>
                <th id="projects-col-total-km" className="p-3 text-[11px] font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('projects_col_total_km')}</th>
                <th id="projects-col-est-cost" className="p-3 text-[11px] font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('projects_col_est_cost')}</th>
                <th id="projects-col-dashboard" className="p-3 text-[11px] font-semibold text-on-surface-dark-secondary uppercase tracking-wider text-center">{t('projects_col_dashboard')}</th>
                <th id="projects-col-actions" className="p-3 text-[11px] font-semibold text-on-surface-dark-secondary uppercase tracking-wider text-right">{t('trips_col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {filteredProjects.length > 0 ? filteredProjects.map(project => {
                const isSelected = selectedProjectIds.includes(project.id);
                const invoiceCount = project.expenseCount || 0;
                const invoiceTooltip = project.expensesTooltip as string | undefined;
                const invoiceLabel = t(invoiceCount === 1 ? 'expense_badge_single' : 'expense_badge_plural');
                const invoiceAriaLabel = t('expense_badge_aria_project', { count: invoiceCount, label: invoiceLabel });
                return (
                  <tr
                    key={project.id}
                    className={`${isSelected ? 'bg-brand-primary/20' : ''} hover:bg-gray-800/40 transition-colors cursor-pointer`}
                    onClick={() => handleViewDetails(project)}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectProject(project.id)}
                        className="bg-background-dark border-gray-600 rounded text-brand-primary focus:ring-brand-primary focus:ring-2 h-5 w-5"
                      />
                    </td>
                    <td className="p-3 font-semibold text-white text-sm">{project.name}</td>
                    <td className="p-3 text-sm">{project.producer}</td>
                    <td className="p-3 text-sm">{project.tripCount}</td>
                    <td className="p-3 text-sm">{project.documentCount}</td>
                    <td className="p-3">
                      {invoiceCount > 0 ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full bg-brand-secondary/10 px-2.5 py-1 text-[11px] font-semibold text-brand-secondary"
                          title={invoiceTooltip}
                          aria-label={invoiceAriaLabel}
                        >
                          <FileTextIcon className="h-3.5 w-3.5" />
                          <span>{invoiceCount}</span>
                        </span>
                      ) : (
                        <span className="text-on-surface-dark-secondary">—</span>
                      )}
                    </td>
                    <td className="p-3 font-semibold text-brand-primary text-sm">{project.totalKm.toFixed(1)} km</td>
                    <td className="p-3 font-semibold text-brand-secondary text-sm">€{project.totalReimbursement.toFixed(2)}</td>
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleProjectVisibility(project.id)}
                        title={t('projects_dashboard_toggle_tooltip')}
                        className="p-2 rounded-smooth hover:bg-gray-700/50 transition-colors"
                      >
                        <StarIcon className={`w-5 h-5 mx-auto transition-all duration-150 transform hover:scale-125 ${visibleProjectIds.includes(project.id)
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-600 hover:text-yellow-500'
                          }`} />
                      </button>
                    </td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="icon"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleEdit(project); }}
                        className="text-blue-400 hover:text-blue-300 mr-3"
                        title={t('common_edit')}
                      >
                        <EditIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="icon"
                        size="sm"
                        onClick={(e) => handleDelete(e, project)}
                        className="text-red-400 hover:text-red-300"
                        title={t('common_delete')}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={10} className="text-center p-8 text-on-surface-dark-secondary">
                    {searchQuery ? t('projects_no_search_results') : t('projects_no_projects')}
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedProjectIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center pointer-events-none">
          <div
            className="pointer-events-auto bg-frost-glass border-glass rounded-full px-4 py-2 md:px-6 md:py-2.5 shadow-glass flex items-center gap-3 text-sm"
            style={contentStyle}
          >
            <span className="font-medium text-white">
              {t('projects_selected_count', { count: selectedProjectIds.length })}
            </span>
            <div className="flex items-center gap-2 ml-2">
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteSelected}
              >
                <TrashIcon className="w-4 h-4 mr-1" />
                {t('projects_delete_selected_btn')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isEditorOpen && (
        <ProjectEditorModal
          project={selectedProject}
          onClose={() => setIsEditorOpen(false)}
          personalization={personalization}
          theme={theme}
        />
      )}

      {isDetailOpen && selectedProject && (
        <ProjectDetailModal
          projectId={selectedProject.id}
          trips={trips.filter(t => t.projectId === selectedProject.id)}
          onClose={() => setIsDetailOpen(false)}
          personalization={personalization}
          theme={theme}
        />
      )}

      <UndoToast
        action={getLastAction()}
        onUndo={undo}
        onDismiss={() => setShowUndoToast(false)}
        isVisible={showUndoToast}
        theme={theme}
      />
    </div>
  );
};

export default ProjectsView;
