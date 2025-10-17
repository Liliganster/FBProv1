
import React, { useState, useRef, useMemo } from 'react';
import { Project, CallsheetFile, SpecialOrigin, Trip, DocumentType, ExpenseDocument } from '../types';
import useTrips from '../hooks/useTrips';
import useProjects from '../hooks/useProjects';
import { XIcon, FileTextIcon, EyeIcon, TrashIcon, LoaderIcon, SparklesIcon, LeafIcon, LineChartIcon, PieChartIcon, CarIcon, UploadCloudIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import { formatDateForDisplay } from '../i18n/translations';
import useToast from '../hooks/useToast';
import { processFileForTrip } from '../services/aiService';
import useUserProfile from '../hooks/useUserProfile';
import useGoogleMapsScript from '../hooks/useGoogleMapsScript';
import { supabase } from '../lib/supabase';
import useExpenses from '../hooks/useExpenses';
import ExpenseUploadModal from './ExpenseUploadModal';

interface ProjectDetailModalProps {
  projectId: string,
  trips: Trip[],
  onClose: () => void;
}

const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({ projectId, trips, onClose }) => {
  const tripsContext = useTrips();
  const { projects, addCallsheetsToProject, deleteCallsheetFromProject } = useProjects();
  const addMultipleTrips = tripsContext.addMultipleTrips || (() => Promise.resolve());
  const { userProfile } = useUserProfile();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingFileId, setProcessingFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  const { showToast } = useToast();
  
  useGoogleMapsScript();
  const { expenses, getExpensesForProject, deleteExpense, loading: expensesLoading } = useExpenses();
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  const tripMap = useMemo(() => {
    const map = new Map<string, Trip>();
    trips.forEach(trip => map.set(trip.id, trip));
    return map;
  }, [trips]);

  const projectExpenses = useMemo(() => {
    const directExpenses = getExpensesForProject(projectId);
    if (directExpenses.length === expenses.length) {
      return directExpenses;
    }
    const projectTripIds = new Set(trips.map(trip => trip.id));
    const linkedTripExpenses = expenses.filter(expense => expense.tripId && projectTripIds.has(expense.tripId));

    const mergedIds = new Set<string>();
    const combined: ExpenseDocument[] = [];

    directExpenses.forEach(expense => {
      mergedIds.add(expense.id);
      combined.push(expense);
    });

    linkedTripExpenses.forEach(expense => {
      if (!mergedIds.has(expense.id)) {
        combined.push(expense);
      }
    });

    return combined;
  }, [expenses, getExpensesForProject, projectId, trips]);

  const projectExpenseTotal = useMemo(
    () => projectExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0),
    [projectExpenses]
  );
  const projectExpenseCurrency = projectExpenses[0]?.currency ?? 'EUR';

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

  const handleDeleteExpense = async (expenseId: string) => {
    if (!window.confirm(t('expense_delete_confirm') || 'Delete this invoice?')) {
      return;
    }
    try {
      await deleteExpense(expenseId);
    } catch (error) {
      // handled via toast
    }
  };

  const openInvoice = (url: string) => {
    window.open(url, '_blank', 'noopener');
  };

  // Get the current project from the projects context (will be updated automatically)
  const project = useMemo(() => {
    return projects.find(p => p.id === projectId);
  }, [projects, projectId]);

  // If project is not found, show error
  if (!project) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-background-dark border border-red-500/50 rounded-lg p-6 max-w-md mx-auto">
          <h2 className="text-lg font-semibold text-red-400 mb-2">Project Not Found</h2>
          <p className="text-gray-300 mb-4">The requested project could not be found.</p>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-brand-primary text-white rounded-md hover:brightness-110 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const projectTrips = trips;

  const stats = React.useMemo(() => {
    const totalKm = projectTrips.reduce((sum, trip) => sum + trip.distance, 0);
    
    const shootingDays = new Set(projectTrips.map(t => t.date));

    const EMISSION_FACTOR_G_PER_KM = 140;
    const totalCo2 = (totalKm * EMISSION_FACTOR_G_PER_KM) / 1000;

    return {
      totalKm,
      shootingDaysCount: shootingDays.size,
      kmPerDay: shootingDays.size > 0 ? totalKm / shootingDays.size : 0,
      totalTrips: projectTrips.length,
      totalCo2,
    };
  }, [projectTrips]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length > 20) {
      showToast(t('projects_alert_maxFiles', { count: 20 }), 'warning');
      return;
    }

    const fileNames = Array.from(files).map(f => f.name);
    setIsUploading(true);
    setUploadingFiles(fileNames);

    try {
      await addCallsheetsToProject(project.id, Array.from(files));
      showToast(files.length > 1 ? t('projects_alert_upload_success_multiple', { count: files.length }) : t('projects_alert_upload_success_single', { fileName: files[0].name }), 'success');
      
      // Clear the file input to allow uploading the same file again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      showToast(t('projects_alert_upload_error'), 'error');
    } finally {
      setIsUploading(false);
      setUploadingFiles([]);
    }
  };
  
  const handleViewFile = async (file: CallsheetFile) => {
    try {
      // Get the callsheet record with URL from database
      const { data, error } = await supabase
        .from('callsheets')
        .select('url')
        .eq('id', file.id)
        .single();

      if (error || !data?.url) {
        throw new Error('File URL not found');
      }

      // Open the file URL in a new tab
      window.open(data.url, '_blank');
    } catch (error) {
      showToast('Error retrieving file.', 'error');
    }
  };

  const handleProcessFile = async (file: CallsheetFile) => {
    if (!userProfile) return;
    setProcessingFileId(file.id);
    setIsProcessing(true);
    try {
      // Get the callsheet record with URL from database
      const { data: callsheetData, error: callsheetError } = await supabase
        .from('callsheets')
        .select('url, filename')
        .eq('id', file.id)
        .single();

      if (callsheetError || !callsheetData?.url) {
        throw new Error('Could not retrieve file information.');
      }

      // Extract file path from URL
      const urlParts = callsheetData.url.split('/callsheets/')
      if (urlParts.length < 2) {
        throw new Error('Invalid file URL format.');
      }
      const filePath = decodeURIComponent(urlParts[1]);

      // Download file from Supabase Storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('callsheets')
        .download(filePath);

      if (downloadError || !fileData) {
        throw new Error('Could not download file from storage.');
      }

      // Convert Blob to File object
      const downloadedFile = new File([fileData], callsheetData.filename, { type: fileData.type });
      const { tripData } = await processFileForTrip(downloadedFile, userProfile, DocumentType.CALLSHEET);
      
      addMultipleTrips([{
        ...tripData,
        projectId: project.id,
        reason: `${project.name} - ${tripData.reason}`,
      }]);
      
      showToast('Successfully extracted and created a new trip!', 'success');
    } catch(err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred during processing.';
      showToast(message, 'error');
    } finally {
      setIsProcessing(false);
      setProcessingFileId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 py-16 overflow-y-auto bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl bg-frost-glass border border-gray-700/60 rounded-lg shadow-2xl flex flex-col max-h-[88vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-start justify-between px-6 py-4 border-b border-gray-700/60">
          <div className="pr-8">
            <h2 className="text-lg font-semibold tracking-tight text-white">{project.name}</h2>
            <p className="text-xs text-gray-400 mt-1">{project.producer}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common_close')}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard title={t('projectDetail_stats_total_km')} value={`${stats.totalKm.toFixed(1)} km`} icon={<CarIcon className="w-6 h-6 text-brand-primary" />} />
            <StatCard title={t('projectDetail_stats_shooting_days')} value={stats.shootingDaysCount.toString()} icon={<LineChartIcon className="w-6 h-6 text-brand-secondary" />} />
            <StatCard title={t('projectDetail_stats_km_per_day')} value={`${stats.kmPerDay.toFixed(1)} km`} icon={<PieChartIcon className="w-6 h-6 text-blue-400" />} />
            <StatCard title={t('projectDetail_stats_co2')} value={`${stats.totalCo2.toFixed(1)} kg`} icon={<LeafIcon className="w-6 h-6 text-green-400" />} />
          </div>
          {/* Callsheets section */}
          <section className="bg-background-dark/60 border border-gray-700/50 rounded-lg p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h3 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
                <FileTextIcon className="w-5 h-5 text-gray-300" />
                {t('projects_callsheetsTitle')}
              </h3>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  multiple
                  className="hidden"
                  accept="image/*,application/pdf,.pdf,.txt,.eml,message/rfc822,.doc,.docx,.xls,.xlsx,.csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-brand-primary hover:brightness-110 text-white shadow disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                >
                  {isUploading ? (
                    <LoaderIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileTextIcon className="w-4 h-4" />
                  )}
                  {t('projects_uploadCallsheets', { count: 20 })}
                </button>
              </div>
            </div>
            <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {/* Show uploading files */}
              {uploadingFiles.map((fileName, index) => (
                <li
                  key={`uploading-${index}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-md animate-pulse"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <LoaderIcon className="w-4 h-4 text-blue-400 flex-shrink-0 animate-spin" />
                    <span className="text-xs text-blue-300 truncate" title={fileName}>{fileName}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-xs text-blue-400">Uploading...</span>
                  </div>
                </li>
              ))}
              
              {/* Show existing callsheets */}
              {(project.callsheets || []).map(file => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 bg-background-dark/70 border border-gray-700/40 rounded-md hover:border-gray-600/60 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileTextIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-200 truncate" title={file.name}>{file.name}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleProcessFile(file)}
                      disabled={isProcessing}
                      className="p-1.5 text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Extract Trip with AI"
                    >
                      {isProcessing && processingFileId === file.id ? (
                        <LoaderIcon className="w-4 h-4 animate-spin" />
                      ) : (
                        <SparklesIcon className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleViewFile(file)}
                      className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded-md transition-colors"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => { 
                        if (window.confirm(t('files_deleteConfirm'))) { 
                          try {
                            await deleteCallsheetFromProject(project.id, file.id);
                            showToast('Callsheet deleted successfully', 'success');
                          } catch (error) {
                            showToast('Error deleting callsheet', 'error');
                          }
                        } 
                      }}
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-md transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
              
              {/* Show empty state when no callsheets and not uploading */}
              {(project.callsheets || []).length === 0 && uploadingFiles.length === 0 && (
                <li className="text-center py-8">
                  <FileTextIcon className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No callsheets uploaded yet</p>
                  <p className="text-xs text-gray-600 mt-1">Upload documents to extract trips with AI</p>
                </li>
              )}
            </ul>
          </section>
          <section className="bg-background-dark/60 border border-gray-700/50 rounded-lg p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h3 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
                <FileTextIcon className="w-5 h-5 text-brand-secondary" />
                {t('expense_section_title_project') || 'Project invoices'}
              </h3>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
              >
                <UploadCloudIcon className="h-4 w-4" />
                {t('expense_attach_project_btn') || 'Attach invoice'}
              </button>
            </div>
            <p className="text-sm text-on-surface-secondary mb-3">
              {t('expense_section_total') || 'Total documented'}:{' '}
              <span className="font-semibold text-white">
                {formatCurrency(projectExpenseTotal, projectExpenseCurrency)}
              </span>
            </p>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {expensesLoading && (
                <p className="text-xs text-on-surface-secondary">
                  {t('expense_loading') || 'Loading invoices…'}
                </p>
              )}
              {!expensesLoading && projectExpenses.length === 0 && (
                <p className="text-xs text-on-surface-secondary italic">
                  {t('expense_list_empty_project') || 'No invoices uploaded for this project yet.'}
                </p>
              )}
              {!expensesLoading &&
                projectExpenses.map(expense => {
                  const categoryLabel =
                    expense.category === 'fuel'
                      ? t('expense_category_fuel') || 'Fuel'
                      : t('expense_category_maintenance') || 'Maintenance';
                  const invoiceDateLabel = expense.invoiceDate
                    ? formatDateForDisplay(expense.invoiceDate)
                    : null;
                  const linkedTrip = expense.tripId ? tripMap.get(expense.tripId) : undefined;
                  return (
                    <div
                      key={expense.id}
                      className="flex items-start justify-between rounded-md border border-glass bg-background-dark/70 px-3 py-2"
                    >
                      <div className="flex flex-1 gap-3">
                        <FileTextIcon className="mt-1 h-4 w-4 text-brand-secondary" />
                        <div className="space-y-1 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-white">
                              {formatCurrency(expense.amount, expense.currency)}
                            </span>
                            <span className="rounded-sm bg-brand-secondary/20 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-brand-secondary">
                              {categoryLabel}
                            </span>
                            {invoiceDateLabel && (
                              <span className="text-on-surface-secondary">{invoiceDateLabel}</span>
                            )}
                          </div>
                          {linkedTrip && (
                            <p className="text-on-surface-secondary">
                              {t('expense_linked_trip') || 'Trip'}:{' '}
                              {formatDateForDisplay(linkedTrip.date)}
                            </p>
                          )}
                          {expense.description && (
                            <p className="text-on-surface-secondary">{expense.description}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => openInvoice(expense.url)}
                            className="text-[11px] font-medium text-brand-primary transition hover:text-white"
                          >
                            {t('expense_open_document') || 'View invoice'}
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="ml-3 rounded-md p-1 text-on-surface-secondary transition hover:text-red-400 disabled:opacity-50"
                        aria-label={t('expense_delete_btn') || 'Delete invoice'}
                        disabled={expensesLoading}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
            </div>
          </section>
        </main>
      </div>
      <ExpenseUploadModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        defaultProjectId={projectId}
      />
    </div>
  );
};


const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-background-dark p-4 rounded-lg">
        <h4 className="text-sm font-medium text-on-surface-dark-secondary">{title}</h4>
        <div className="flex items-center gap-2 mt-1">
            {icon}
            <p className="text-xl font-bold text-white">{value}</p>
        </div>
    </div>
);
export default ProjectDetailModal;
