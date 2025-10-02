
import React, { useState, useRef } from 'react';
import { Project, CallsheetFile, SpecialOrigin, UserProfile, Trip, DocumentType } from '../types';
import useTrips from '../hooks/useTrips';
import { XIcon, FileTextIcon, EyeIcon, TrashIcon, LoaderIcon, SparklesIcon, LeafIcon, LineChartIcon, UsersIcon, PieChartIcon, CarIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import useToast from '../hooks/useToast';
import { getFile } from '../services/dbService';
import { processFileForTrip } from '../services/aiService';
import useUserProfile from '../hooks/useUserProfile';
import useGoogleMapsScript from '../hooks/useGoogleMapsScript';

interface ProjectDetailModalProps {
  project: Project,
  trips: Trip[],
  onClose: () => void;
}

const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({ project, trips, onClose }) => {
  const { addCallsheetsToProject, deleteCallsheetFromProject, addMultipleTrips } = useTrips();
  const { userProfile } = useUserProfile();
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingFileId, setProcessingFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  const { showToast } = useToast();
  
  const { isLoaded: isMapsScriptLoaded, error: mapsScriptError } = useGoogleMapsScript({ apiKey: userProfile?.googleMapsApiKey });

  const projectTrips = trips;

  const stats = React.useMemo(() => {
    const totalKm = projectTrips.reduce((sum, trip) => sum + trip.distance, 0);
    
    const shootingDays = new Set(projectTrips.map(t => t.date));
    
    const transferTrips = projectTrips.filter(t => t.specialOrigin === SpecialOrigin.HOME || t.specialOrigin === SpecialOrigin.END_OF_CONTINUATION);

    const EMISSION_FACTOR_G_PER_KM = 140;
    const totalCo2 = (totalKm * EMISSION_FACTOR_G_PER_KM) / 1000;

    return {
      totalKm,
      shootingDaysCount: shootingDays.size,
      kmPerDay: shootingDays.size > 0 ? totalKm / shootingDays.size : 0,
      transferTripCount: transferTrips.length,
      totalTrips: projectTrips.length,
      totalCo2,
    };
  }, [projectTrips]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length > 5) {
      showToast(t('projects_alert_maxFiles', { count: 5 }), 'warning');
      return;
    }
    setIsUploading(true);
    try {
      await addCallsheetsToProject(project.id, Array.from(files));
      showToast(files.length > 1 ? t('projects_alert_upload_success_multiple', { count: files.length }) : t('projects_alert_upload_success_single', { fileName: files[0].name }), 'success');
    } catch (error) {
      showToast(t('projects_alert_upload_error'), 'error');
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleViewFile = async (file: CallsheetFile) => {
    try {
      const fileData = await getFile(file.id);
      if (fileData) {
        const url = URL.createObjectURL(fileData);
        window.open(url, '_blank');
      }
    } catch (error) {
      showToast('Error retrieving file.', 'error');
    }
  };

  const handleProcessFile = async (file: CallsheetFile) => {
    if (!userProfile) return;
     if (userProfile.googleMapsApiKey && !isMapsScriptLoaded) {
          const message = mapsScriptError ? `Failed to load Google Maps: ${mapsScriptError.message}` : 'Google Maps service is still loading. Please wait a moment and try again.';
          showToast(message, mapsScriptError ? 'error' : 'info');
          return;
      }
    setProcessingFileId(file.id);
    setIsProcessing(true);
    try {
      const fileData = await getFile(file.id);
      if (!fileData) {
        throw new Error('Could not retrieve file to process.');
      }
      const { tripData } = await processFileForTrip(fileData, userProfile, DocumentType.CALLSHEET);
      
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
        className="relative w-full max-w-5xl bg-background-dark/95 border border-gray-700/60 rounded-lg shadow-2xl flex flex-col max-h-[88vh] overflow-hidden"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            <StatCard title={t('projectDetail_stats_total_km')} value={`${stats.totalKm.toFixed(1)} km`} icon={<CarIcon className="w-6 h-6 text-brand-primary" />} />
            <StatCard title={t('projectDetail_stats_shooting_days')} value={stats.shootingDaysCount.toString()} icon={<LineChartIcon className="w-6 h-6 text-brand-secondary" />} />
            <StatCard title={t('projectDetail_stats_km_per_day')} value={`${stats.kmPerDay.toFixed(1)} km`} icon={<PieChartIcon className="w-6 h-6 text-blue-400" />} />
            <StatCard title={t('projectDetail_stats_transfers')} value={`${stats.transferTripCount} / ${stats.totalTrips}`} icon={<UsersIcon className="w-6 h-6 text-yellow-400" />} />
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
                  accept="image/*,application/pdf,.txt,.eml,message/rfc822"
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
                  {t('projects_uploadCallsheets', { count: 5 })}
                </button>
              </div>
            </div>
            <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
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
                      onClick={() => { if (window.confirm(t('files_deleteConfirm'))) { deleteCallsheetFromProject(project.id, file.id); } }}
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-md transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
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
