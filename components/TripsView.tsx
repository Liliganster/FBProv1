import React, { useState, useMemo, useEffect } from 'react';
import VirtualList from './VirtualList';
import useTrips from '../hooks/useTrips';
import { Trip, SpecialOrigin, UserProfile, PersonalizationSettings, ExpenseDocument } from '../types';
import TripEditorModal from './TripEditorModal';
import BulkUploadModal from './BulkUploadModal';
import TripDetailModal from './TripDetailModal';
import BatchEditModal from './BatchEditModal';
import { PlusIcon, EditIcon, TrashIcon, UploadCloudIcon, MapIcon, ChevronUpIcon, ChevronDownIcon, WarningIcon, LockIcon, CalendarPlusIcon, FileTextIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import useUserProfile from '../hooks/useUserProfile';
import { useMobile } from '../hooks/useMediaQuery';
import { formatDateForDisplay } from '../i18n/translations';
import { calculateTripReimbursement } from '../services/taxService';
import useGoogleCalendar from '../hooks/useGoogleCalendar';
import useToast from '../hooks/useToast';
import useUndoRedo from '../hooks/useUndoRedo';
import UndoToast from './UndoToast';
import useExpenses from '../hooks/useExpenses';
import { Button } from './Button';

const SpecialOriginTag = React.memo(({ originType }: { originType: SpecialOrigin }) => {
  const { t } = useTranslation();
  const styles: { [key in SpecialOrigin]: string } = {
    [SpecialOrigin.HOME]: 'hidden',
    [SpecialOrigin.CONTINUATION]: 'bg-blue-500/20 text-blue-300',
    [SpecialOrigin.END_OF_CONTINUATION]: 'bg-green-500/20 text-green-300',
  };

  const textKey: { [key in SpecialOrigin]: string } = {
    [SpecialOrigin.HOME]: '',
    [SpecialOrigin.CONTINUATION]: 'specialOrigin_continuation_tag',
    [SpecialOrigin.END_OF_CONTINUATION]: 'specialOrigin_return_tag',
  };

  if (originType === SpecialOrigin.HOME) return null;

  return (
    <span className={`ml-2 px-2 py-0.5 rounded-smooth text-xs font-semibold ${styles[originType]}`}>
      {t(textKey[originType])}
    </span>
  );
});

interface TripsViewProps {
  personalization: PersonalizationSettings;
  theme: 'light' | 'dark';
}

const TripsView: React.FC<TripsViewProps> = ({ personalization, theme }) => {
  const { trips, projects, addTrip, updateTrip, deleteTrip, deleteMultipleTrips, addCsvTrips, addAiTrips, updateMultipleTrips } = useTrips();
  const { userProfile } = useUserProfile();
  const { isSignedIn, createCalendarEvent } = useGoogleCalendar();
  const { showToast } = useToast();
  const { addAction, undo, getLastAction } = useUndoRedo();
  const { expenses } = useExpenses();
  const isMobile = useMobile();
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isBatchEditModalOpen, setIsBatchEditModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 100; // paginate to avoid rendering huge lists
  const { t } = useTranslation();

  const expensesByTrip = useMemo<Record<string, ExpenseDocument[]>>(() => {
    const map: Record<string, ExpenseDocument[]> = {};
    expenses.forEach(expense => {
      if (!expense.tripId) return;
      if (!map[expense.tripId]) {
        map[expense.tripId] = [];
      }
      map[expense.tripId].push(expense);
    });
    return map;
  }, [expenses]);

  const formatCurrency = (value: number, currency?: string | null) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'EUR',
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${currency || 'EUR'}`;
    }
  };

  const buildExpenseTooltip = (items: ExpenseDocument[]) => {
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
        // Use a bullet separator with a safe unicode escape to avoid encoding issues
        return parts.join(' \u2022 ');
      })
      .join('\n');
  };

  const getProjectName = (projectId: string) => {
    // Prefer lookup by ID
    const byId = projects.find(p => p.id === projectId)?.name;
    if (byId) return byId;
    // Some historical trips saved the project name in projectId. Try match by name.
    if (projectId) {
      const byName = projects.find(p => (p.name || '').toLowerCase() === projectId.toLowerCase())?.name;
      if (byName) return byName;
      // If it's a non-UUID string, show it as-is to avoid "Unknown Project"
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId);
      if (!isUuid) return projectId;
    }
    return t('trips_unknownProject');
  };

  const handleViewTrip = (trip: Trip) => {
    setSelectedTrip(trip);
    setIsDetailModalOpen(true);
  };

  const handleAddTrip = () => {
    setEditingTrip(null);
    setIsEditorModalOpen(true);
  };

  const handleEditTrip = (trip: Trip) => {
    setEditingTrip(trip);
    setIsEditorModalOpen(true);
  };

  const handleSaveTrip = async (trip: Trip) => {
    try {
      if (editingTrip) {
        await updateTrip(trip);
      } else {
        await addTrip(trip);
      }
      setIsEditorModalOpen(false);
      setEditingTrip(null);
    } catch (error) {
      console.error('Error saving trip:', error);
      showToast('Error saving trip', 'error');
    }
  };

  const handleSaveBulkTrips = async (newTrips: Omit<Trip, 'id'>[], source: 'ai' | 'csv') => {
    try {
      if (source === 'ai' && addAiTrips) {
        await addAiTrips(newTrips);
      } else {
        await addCsvTrips(newTrips);
      }
      setIsBulkModalOpen(false);
    } catch (error) {
      console.error('Error saving bulk trips:', error);
      showToast('Error saving bulk trips', 'error');
    }
  }

  const handleSaveBatch = async (updates: { projectId?: string; reason?: string }) => {
    try {
      await updateMultipleTrips(selectedTripIds, updates);
      setIsBatchEditModalOpen(false);
      setSelectedTripIds([]);
    } catch (error) {
      console.error('Error updating multiple trips:', error);
      showToast('Error updating trips', 'error');
    }
  };

  const handleDeleteTrip = (id: string) => {
    if (window.confirm(t('trips_deleteConfirm'))) {
      const tripToDelete = trips.find(t => t.id === id);
      if (tripToDelete) {
        deleteTrip(id);

        // Add undo action
        addAction({
          type: 'delete',
          description: t('undo_action_delete_trip'),
          undo: () => {
            addTrip(tripToDelete);
          }
        });

        setShowUndoToast(true);
      }
    }
  };

  const handleSelectTrip = (id: string) => {
    setSelectedTripIds(prev =>
      prev.includes(id) ? prev.filter(tripId => tripId !== id) : [...prev, id]
    );
  };

  const handleAddToCalendar = async (trip: Trip) => {
    try {
      const projectName = getProjectName(trip.projectId);
      await createCalendarEvent(trip, projectName);
      showToast(t('toast_calendar_event_success'), 'success');
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      const errorMessage = error instanceof Error ? error.message : t('toast_calendar_event_error');
      if (errorMessage.includes('No primary calendar selected')) {
        showToast(t('toast_calendar_no_primary'), 'warning');
      } else {
        showToast(errorMessage, 'error');
      }
    }
  };

  const filteredTrips = useMemo(() => {
    if (!userProfile) return [];

    const userTrips = trips.filter(trip => (projectFilter === 'all' || trip.projectId === projectFilter));

    if (sortOrder === 'desc') {
      return userTrips.reverse(); // The trips are already sorted asc by date from context
    }
    return userTrips;

  }, [trips, projectFilter, userProfile, sortOrder]);

  // Reset pagination when filters/sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [projectFilter, sortOrder]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredTrips.length / PAGE_SIZE)), [filteredTrips.length]);
  const pagedTrips = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTrips.slice(start, start + PAGE_SIZE);
  }, [filteredTrips, currentPage]);

  // SSR-safe height for virtual list
  const listHeight = typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.7) : 600;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedTripIds(filteredTrips.map(trip => trip.id));
    } else {
      setSelectedTripIds([]);
    }
  };

  const handleDeleteSelected = () => {
    if (window.confirm(t('trips_delete_selected_confirm', { count: selectedTripIds.length }))) {
      const tripsToDelete = trips.filter(t => selectedTripIds.includes(t.id));
      deleteMultipleTrips(selectedTripIds);

      // Add undo action for multiple trips
      addAction({
        type: 'bulk_delete',
        description: t('undo_action_bulk_delete', { count: tripsToDelete.length }),
        undo: () => {
          tripsToDelete.forEach(trip => addTrip(trip));
        }
      });

      setSelectedTripIds([]);
      setShowUndoToast(true);
    }
  };

  const handleSortByDate = () => {
    setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const isAllSelected = filteredTrips.length > 0 && selectedTripIds.length === filteredTrips.length;

  const EMISSION_FACTOR_G_PER_KM = 140;

  const contentStyle = {
    backgroundColor: theme === 'dark'
      ? `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`
      : `rgba(243, 244, 246, ${1 - personalization.uiTransparency})`,
    backdropFilter: `blur(${personalization.uiBlur}px)`,
  };

  return (
    <div className="text-on-surface-dark">
      <div className="flex justify-between items-center mb-8">
        {selectedTripIds.length > 0 ? (
          <div className="flex items-center gap-4 w-full">
            <h2 className="text-xl font-semibold text-white">{t('trips_selected_count', { count: selectedTripIds.length })}</h2>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="primary"
                onClick={() => setIsBatchEditModalOpen(true)}
              >
                <EditIcon className="w-5 h-5 mr-2" />
                {t('trips_edit_selected_btn')}
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteSelected}
              >
                <TrashIcon className="w-5 h-5 mr-2" />
                {t('trips_delete_selected_btn')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-title bg-clip-text text-transparent">{t('trips_title')}</h1>
              {userProfile && <h2 className="text-lg font-semibold text-brand-primary">{userProfile.name}</h2>}
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label htmlFor="project-filter" className="sr-only">{t('trips_filter_by_project')}</label>
                <select
                  id="project-filter"
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="bg-gradient-surface border-surface rounded-smooth py-2 px-4 focus:ring-2 focus:ring-brand-primary focus:outline-none text-white transition-all duration-200 text-sm font-medium h-[38px]"
                >
                  <option value="all">{t('trips_filter_all_projects')}</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <Button variant="success" onClick={() => setIsBulkModalOpen(true)}>
                <UploadCloudIcon className="w-5 h-5 mr-2" />
                {t('trips_bulkUpload')}
              </Button>
              <Button variant="primary" onClick={handleAddTrip}>
                <PlusIcon className="w-5 h-5 mr-2" />
                {t('trips_addTrip')}
              </Button>
            </div>
          </>
        )}
      </div>

      {isMobile ? (
        // Vista mobile con cards
        <div className="space-y-4">
          {filteredTrips.length > 0 ? (
            <>
              {selectedTripIds.length > 0 && (
                <div className="bg-frost-glass border-glass rounded-fluid p-4 mb-4 backdrop-blur-glass">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">{t('trips_selected_count', { count: selectedTripIds.length })}</span>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setIsBatchEditModalOpen(true)}
                      >
                        <EditIcon className="w-4 h-4 mr-1" />
                        {t('trips_editSelected')}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={handleDeleteSelected}
                      >
                        <TrashIcon className="w-4 h-4 mr-1" />
                        {t('trips_deleteSelected')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {/* Use virtual scrolling for large datasets */}
              {filteredTrips.length > 100 ? (
                <VirtualList
                  items={filteredTrips}
                  itemHeight={180}
                  height={listHeight}
                  overscan={6}
                  renderItem={(trip) => {
                    const isSelected = selectedTripIds.includes(trip.id);
                    const isLocked = userProfile?.lockedUntilDate ? new Date(trip.date) <= new Date(userProfile.lockedUntilDate) : false;
                    const allWarnings = [...(trip.warnings || [])];
                    if (trip.distance > 1000) { allWarnings.push(t('trips_warning_improbable_distance')); }
                    if (trip.distance === 0) { allWarnings.push(t('trips_warning_zero_distance')); }
                    if (!trip.reason?.trim()) { allWarnings.push(t('dashboard_alert_missing_reason')); }
                    const project = projects.find(p => p.id === trip.projectId);
                    const reimbursement = calculateTripReimbursement(trip, userProfile, project);
                    const emissions = (trip.distance * EMISSION_FACTOR_G_PER_KM) / 1000;
                    const tripExpenses = expensesByTrip[trip.id] ?? [];
                    const invoiceCount = tripExpenses.length;
                    return (
                      <div
                        key={trip.id}
                        className={`bg-frost-glass border-glass rounded-fluid p-4 mb-3 backdrop-blur-glass transition-all duration-200 ${isSelected ? 'ring-2 ring-brand-primary bg-brand-primary/10' : 'hover:bg-gradient-surface/50'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectTrip(trip.id)}
                              className="bg-gradient-surface border-surface rounded text-brand-primary focus:ring-brand-primary focus:ring-2 h-5 w-5 transition-all duration-200"
                              disabled={isLocked}
                            />
                            <div className="flex items-center gap-2">
                              {isLocked && (
                                <span title={t('trips_locked_tooltip')} className="cursor-pointer hover:scale-110 transition-transform">
                                  <LockIcon className="w-4 h-4 text-yellow-400 hover:text-yellow-300" />
                                </span>
                              )}
                              <span className="text-white font-medium">{formatDateForDisplay(trip.date)}</span>
                              {allWarnings.length > 0 && (
                                <div className="cursor-pointer hover:scale-110 transition-transform" title={allWarnings.join('\n')}>
                                  <WarningIcon className="w-4 h-4 text-yellow-400 hover:text-yellow-300" />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="icon" size="sm" onClick={() => handleViewTrip(trip)} title={t('trips_view_trip')}>
                              <MapIcon className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="icon"
                              size="sm"
                              onClick={() => handleAddToCalendar(trip)}
                              disabled={isLocked || !isSignedIn}
                              className="text-green-400 hover:text-green-300"
                              title={isSignedIn ? t('trips_col_actions_add_to_calendar') : t('trips_col_actions_add_to_calendar_disabled')}
                            >
                              <CalendarPlusIcon className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="icon"
                              size="sm"
                              onClick={() => handleEditTrip(trip)}
                              disabled={isLocked}
                              className="text-blue-400 hover:text-blue-300"
                              title={t('common_edit')}
                            >
                              <EditIcon className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="icon"
                              size="sm"
                              onClick={() => handleDeleteTrip(trip.id)}
                              disabled={isLocked}
                              className="text-red-400 hover:text-red-300"
                              title={t('common_delete')}
                            >
                              <TrashIcon className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="cursor-pointer" onClick={() => handleViewTrip(trip)}>
                          <div className="mb-2">
                            <div className="flex items-center gap-1">
                              <span className="text-white text-sm font-medium">{trip.locations.join(' -> ')}</span>
                              <SpecialOriginTag originType={trip.specialOrigin} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-on-surface-dark-secondary text-xs uppercase tracking-wider">{t('trips_col_project')}</span>
                              <p className="text-white">{getProjectName(trip.projectId)}</p>
                            </div>
                            <div>
                              <span className="text-on-surface-dark-secondary text-xs uppercase tracking-wider">{t('trips_col_distance')}</span>
                              <p className="text-brand-primary font-semibold">{trip.distance.toFixed(1)} km</p>
                            </div>
                            <div>
                              <span className="text-on-surface-dark-secondary text-xs uppercase tracking-wider">{t('trips_col_emissions')}</span>
                              <p className="text-white">
                                <span className="font-semibold">{emissions.toFixed(1)}</span>
                                <span className="text-xs text-on-surface-dark-secondary ml-1">kg</span>
                              </p>
                            </div>
                            <div>
                              <span className="text-on-surface-dark-secondary text-xs uppercase tracking-wider">{t('trips_col_earnings')}</span>
                              <p className="text-brand-secondary font-semibold">EUR {reimbursement.toFixed(2)}</p>
                            </div>
                          </div>
                          {invoiceCount > 0 && (
                            <div className="mt-2">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-secondary/10 px-2.5 py-1 text-[11px] font-semibold text-brand-secondary">
                                <FileTextIcon className="h-3.5 w-3.5" />
                                <span>{invoiceCount}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />
              ) : (
                pagedTrips.map((trip) => {
                  const isSelected = selectedTripIds.includes(trip.id);
                  const isLocked = userProfile?.lockedUntilDate ? new Date(trip.date) <= new Date(userProfile.lockedUntilDate) : false;

                  const allWarnings = [...(trip.warnings || [])];
                  if (trip.distance > 1000) {
                    allWarnings.push(t('trips_warning_improbable_distance'));
                  }
                  if (trip.distance === 0) {
                    allWarnings.push(t('trips_warning_zero_distance'));
                  }
                  if (!trip.reason?.trim()) {
                    allWarnings.push(t('dashboard_alert_missing_reason'));
                  }

                  const project = projects.find(p => p.id === trip.projectId);
                  const reimbursement = calculateTripReimbursement(trip, userProfile, project);
                  const emissions = (trip.distance * EMISSION_FACTOR_G_PER_KM) / 1000;
                  const tripExpenses = expensesByTrip[trip.id] ?? [];
                  const invoiceCount = tripExpenses.length;

                  return (
                    <div
                      key={trip.id}
                      className={`bg-frost-glass border-glass rounded-fluid p-4 backdrop-blur-glass transition-all duration-200 ${isSelected ? 'ring-2 ring-brand-primary bg-brand-primary/10' : 'hover:bg-gradient-surface/50'
                        }`}
                    >
                      {/* Header con checkbox, fecha y acciones */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectTrip(trip.id)}
                            className="bg-gradient-surface border-surface rounded text-brand-primary focus:ring-brand-primary focus:ring-2 h-5 w-5 transition-all duration-200"
                            disabled={isLocked}
                          />
                          <div className="flex items-center gap-2">
                            {isLocked && (
                              <span title={t('trips_locked_tooltip')} className="cursor-pointer hover:scale-110 transition-transform">
                                <LockIcon className="w-4 h-4 text-yellow-400 hover:text-yellow-300" />
                              </span>
                            )}
                            <span className="text-white font-medium">{formatDateForDisplay(trip.date)}</span>
                            {allWarnings.length > 0 && (
                              <div className="cursor-pointer hover:scale-110 transition-transform" title={allWarnings.join('\n')}>
                                <WarningIcon className="w-4 h-4 text-yellow-400 hover:text-yellow-300" />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button variant="icon" size="sm" onClick={() => handleViewTrip(trip)} title={t('trips_view_trip')}>
                            <MapIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="icon"
                            size="sm"
                            onClick={() => handleAddToCalendar(trip)}
                            disabled={isLocked || !isSignedIn}
                            className="text-green-400 hover:text-green-300"
                            title={isSignedIn ? t('trips_col_actions_add_to_calendar') : t('trips_col_actions_add_to_calendar_disabled')}
                          >
                            <CalendarPlusIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="icon"
                            size="sm"
                            onClick={() => handleEditTrip(trip)}
                            disabled={isLocked}
                            className="text-blue-400 hover:text-blue-300"
                            title={t('common_edit')}
                          >
                            <EditIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="icon"
                            size="sm"
                            onClick={() => handleDeleteTrip(trip.id)}
                            disabled={isLocked}
                            className="text-red-400 hover:text-red-300"
                            title={t('common_delete')}
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Contenido principal clickeable */}
                      <div className="cursor-pointer" onClick={() => handleViewTrip(trip)}>
                        {/* Ruta */}
                        <div className="mb-2">
                          <div className="flex items-center gap-1">
                            <span className="text-white text-sm font-medium">{trip.locations.join(' -> ')}</span>
                            <SpecialOriginTag originType={trip.specialOrigin} />
                          </div>
                        </div>

                        {/* Info en grid */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-on-surface-dark-secondary text-xs uppercase tracking-wider">{t('trips_col_project')}</span>
                            <p className="text-white">{getProjectName(trip.projectId)}</p>
                          </div>
                          <div>
                            <span className="text-on-surface-dark-secondary text-xs uppercase tracking-wider">{t('trips_col_distance')}</span>
                            <p className="text-brand-primary font-semibold">{trip.distance.toFixed(1)} km</p>
                          </div>
                          <div>
                            <span className="text-on-surface-dark-secondary text-xs uppercase tracking-wider">{t('trips_col_emissions')}</span>
                            <p className="text-white">
                              <span className="font-semibold">{emissions.toFixed(1)}</span>
                              <span className="text-xs text-on-surface-dark-secondary ml-1">kg</span>
                            </p>
                          </div>
                          <div>
                            <span className="text-on-surface-dark-secondary text-xs uppercase tracking-wider">{t('trips_col_earnings')}</span>
                            <p className="text-brand-secondary font-semibold">EUR {reimbursement.toFixed(2)}</p>
                          </div>
                        </div>

                        {/* Invoices */}
                        {invoiceCount > 0 && (
                          <div className="mt-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-secondary/10 px-2.5 py-1 text-[11px] font-semibold text-brand-secondary">
                              <FileTextIcon className="h-3.5 w-3.5" />
                              <span>{invoiceCount}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              {/* Pagination controls for mobile/card view */}
              {filteredTrips.length > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-on-surface-dark-secondary">
                    {t('trips_total') || 'Total'}: {filteredTrips.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      {t('prev') || 'Previous'}
                    </Button>
                    <span className="text-sm text-on-surface-dark-secondary">
                      {t('page') || 'Page'} {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      {t('next') || 'Next'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-frost-glass border-glass rounded-fluid p-8 backdrop-blur-glass text-center">
              <p className="text-on-surface-dark-secondary">{t('trips_noTrips')}</p>
            </div>
          )}
        </div>
      ) : (
        // Vista desktop con tabla
        <div className="bg-frost-glass border-glass rounded-fluid shadow-glass overflow-hidden backdrop-blur-glass">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-surface border-b border-glass">
              <tr>
                <th className="p-3 w-12">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    disabled={filteredTrips.length === 0}
                    className="bg-gradient-surface border-surface rounded text-brand-primary focus:ring-brand-primary focus:ring-2 h-5 w-5 transition-all duration-200"
                  />
                </th>
                <th className="p-3 text-[11px] font-semibold text-on-surface-secondary uppercase tracking-wider">
                  <div onClick={handleSortByDate} className="uppercase flex items-center gap-1 hover:text-white transition-colors duration-200 cursor-pointer select-none">
                    {t('trips_col_date')}
                    <div className="flex flex-col -space-y-2">
                      <ChevronUpIcon className={`w-4 h-4 transition-colors ${sortOrder === 'asc' ? 'text-brand-primary' : 'text-on-surface-tertiary'}`} />
                      <ChevronDownIcon className={`w-4 h-4 transition-colors ${sortOrder === 'desc' ? 'text-brand-primary' : 'text-on-surface-tertiary'}`} />
                    </div>
                  </div>
                </th>
                <th className="p-3 text-[11px] font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('trips_col_route')}</th>
                <th className="p-3 text-[11px] font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('trips_col_project')}</th>
                <th className="p-3 text-[11px] font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('trips_col_invoices')}</th>
                <th className="p-3 text-[11px] font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('trips_col_distance')}</th>
                <th className="p-3 text-[11px] font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('trips_col_emissions')}</th>
                <th className="p-3 text-[11px] font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('trips_col_earnings')}</th>
                <th className="p-3 text-[11px] font-semibold text-on-surface-dark-secondary uppercase tracking-wider text-right">{t('trips_col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {filteredTrips.length > 0 ? pagedTrips.map((trip) => {
                const isSelected = selectedTripIds.includes(trip.id);
                const isLocked = userProfile?.lockedUntilDate ? new Date(trip.date) <= new Date(userProfile.lockedUntilDate) : false;

                const allWarnings = [...(trip.warnings || [])];
                if (trip.distance > 1000) {
                  allWarnings.push(t('trips_warning_improbable_distance'));
                }
                if (trip.distance === 0) {
                  allWarnings.push(t('trips_warning_zero_distance'));
                }
                if (!trip.reason?.trim()) {
                  allWarnings.push(t('dashboard_alert_missing_reason'));
                }

                const project = projects.find(p => p.id === trip.projectId);
                const reimbursement = calculateTripReimbursement(trip, userProfile, project);
                const emissions = (trip.distance * EMISSION_FACTOR_G_PER_KM) / 1000;
                const tripExpenses = expensesByTrip[trip.id] ?? [];
                const invoiceCount = tripExpenses.length;
                const invoiceTooltip = buildExpenseTooltip(tripExpenses);
                const invoiceLabel = t(invoiceCount === 1 ? 'expense_badge_single' : 'expense_badge_plural');
                const invoiceAriaLabel = t('expense_badge_aria_trip', { count: invoiceCount, label: invoiceLabel });

                return (
                  <tr
                    key={trip.id}
                    className={`${isSelected ? 'bg-brand-primary/20' : ''} hover:bg-gradient-surface/50 transition-all duration-200 text-white border-b border-glass/20 last:border-b-0`}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectTrip(trip.id)}
                        className="bg-gradient-surface border-surface rounded text-brand-primary focus:ring-brand-primary focus:ring-2 h-5 w-5 transition-all duration-200"
                        disabled={isLocked}
                      />
                    </td>
                    <td className="p-3 whitespace-nowrap cursor-pointer text-sm" onClick={() => handleViewTrip(trip)}>
                      <div className="flex items-center gap-2">
                        {/* FIX: Wrap LockIcon in a span with a title attribute to fix prop assignment error. */}
                        {isLocked && <span title={t('trips_locked_tooltip')} className="cursor-pointer hover:scale-110 transition-transform"><LockIcon className="w-4 h-4 text-yellow-400 hover:text-yellow-300" /></span>}
                        {formatDateForDisplay(trip.date)}
                      </div>
                    </td>
                    <td className="p-3 cursor-pointer text-sm" onClick={() => handleViewTrip(trip)}>
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg" title={trip.locations.join(' -> ')}>{trip.locations.join(' -> ')}</span>
                        <SpecialOriginTag originType={trip.specialOrigin} />
                        {allWarnings.length > 0 && (
                          <div className="ml-1 cursor-pointer hover:scale-110 transition-transform flex-shrink-0" title={allWarnings.join('\n')}>
                            <WarningIcon className="w-5 h-5 text-yellow-400 hover:text-yellow-300" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap cursor-pointer text-sm" onClick={() => handleViewTrip(trip)}>{getProjectName(trip.projectId)}</td>
                    <td className="p-3 whitespace-nowrap cursor-pointer" onClick={() => handleViewTrip(trip)}>
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
                        // Use an em dash via HTML entity to avoid mojibake in some environments
                        <span className="text-on-surface-dark-secondary" aria-hidden="true">&mdash;</span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap text-brand-primary font-semibold text-sm cursor-pointer" onClick={() => handleViewTrip(trip)}>{trip.distance.toFixed(1)} km</td>
                    <td className="p-3 whitespace-nowrap cursor-pointer text-sm" onClick={() => handleViewTrip(trip)}>
                      <span className="font-semibold">{emissions.toFixed(1)}</span>
                      <span className="text-xs text-on-surface-dark-secondary ml-1">kg</span>
                    </td>
                    <td className="p-3 whitespace-nowrap font-semibold text-sm text-brand-secondary cursor-pointer" onClick={() => handleViewTrip(trip)}>EUR {reimbursement.toFixed(2)}</td>

                    <td
                      className="p-3 whitespace-nowrap text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="icon" size="sm" onClick={() => handleViewTrip(trip)} className="mr-2" title={t('trips_view_trip')}>
                        <MapIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="icon"
                        size="sm"
                        onClick={() => handleAddToCalendar(trip)}
                        disabled={isLocked || !isSignedIn}
                        className="mr-2 text-green-400 hover:text-green-300"
                        title={isSignedIn ? t('trips_col_actions_add_to_calendar') : t('trips_col_actions_add_to_calendar_disabled')}
                      >
                        <CalendarPlusIcon className="w-4 h-4" />
                      </Button>
                      <Button variant="icon" size="sm" onClick={() => handleEditTrip(trip)} disabled={isLocked} className="mr-2 text-blue-400 hover:text-blue-300" title={t('common_edit')}>
                        <EditIcon className="w-4 h-4" />
                      </Button>
                      <Button variant="icon" size="sm" onClick={() => handleDeleteTrip(trip.id)} disabled={isLocked} className="text-red-400 hover:text-red-300" title={t('common_delete')}>
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={9} className="text-center p-8 text-on-surface-dark-secondary">{t('trips_noTrips')}</td>
                </tr>
              )}
            </tbody>
          </table>
          {/* Pagination controls for desktop/table view */}
          {filteredTrips.length > PAGE_SIZE && (
            <div className="flex items-center justify-between p-4">
              <span className="text-sm text-on-surface-dark-secondary">
                {t('trips_total') || 'Total'}: {filteredTrips.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1 rounded-smooth bg-gradient-surface disabled:opacity-50"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  {t('prev') || 'Previous'}
                </button>
                <span className="text-sm text-on-surface-dark-secondary">
                  {t('page') || 'Page'} {currentPage} / {totalPages}
                </span>
                <button
                  className="px-3 py-1 rounded-smooth bg-gradient-surface disabled:opacity-50"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  {t('next') || 'Next'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isEditorModalOpen && (
        <TripEditorModal
          trip={editingTrip}
          projects={projects}
          trips={trips}
          onSave={handleSaveTrip}
          onClose={() => setIsEditorModalOpen(false)}
          personalization={personalization}
          theme={theme}
        />
      )}
      {isBulkModalOpen && (
        <BulkUploadModal
          projects={projects}
          onSave={handleSaveBulkTrips}
          onClose={() => setIsBulkModalOpen(false)}
          personalization={personalization}
          theme={theme}
        />
      )}
      {isBatchEditModalOpen && (
        <BatchEditModal
          onClose={() => setIsBatchEditModalOpen(false)}
          onSave={handleSaveBatch}
          projects={projects}
          selectedTripCount={selectedTripIds.length}
          personalization={personalization}
          theme={theme}
        />
      )}
      {isDetailModalOpen && selectedTrip && (
        <TripDetailModal
          trip={selectedTrip}
          project={projects.find(p => p.id === selectedTrip.projectId)}
          onClose={() => setIsDetailModalOpen(false)}
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

export default TripsView;
