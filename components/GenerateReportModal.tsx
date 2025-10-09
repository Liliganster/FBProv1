import React, { useState, useEffect, useMemo } from 'react';
import { Trip, Project, Report } from '../types';
import { XIcon, CheckIcon, WarningIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import useToast from '../hooks/useToast';
import useUserProfile from '../hooks/useUserProfile';
import { generateHash } from '../services/complianceService';

interface GenerateReportModalProps {
  trips: Trip[];
  projects: Project[];
  onSave: (report: Omit<Report, 'id'>) => void;
  onClose: () => void;
}

type Stage = 'setup' | 'audit' | 'generating';
type AuditWarning = { message: string, count: number };

const GenerateReportModal: React.FC<GenerateReportModalProps> = ({ trips, projects, onSave, onClose }) => {
  const [projectId, setProjectId] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stage, setStage] = useState<Stage>('setup');
  const [auditWarnings, setAuditWarnings] = useState<AuditWarning[]>([]);
  const [tripsForReport, setTripsForReport] = useState<Trip[]>([]);
  const { userProfile } = useUserProfile();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const userProjects = useMemo(() => {
    if (!userProfile) return [];
    
    const userProjectIds = new Set(trips.map(trip => trip.projectId));
    
    return projects.filter(project => userProjectIds.has(project.id));
  }, [projects, trips, userProfile]);

  useEffect(() => {
    if (trips.length > 0) {
      const sorted = [...trips].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setStartDate(sorted[0].date);
      setEndDate(sorted[sorted.length-1].date);
    } else {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDayOfMonth);
      setEndDate(today.toISOString().split('T')[0]);
    }
  }, [trips]);

  const runAudit = () => {
     if (!userProfile) {
      showToast(t('report_alert_missingData'), 'warning');
      return;
    }
    
    const filteredTrips = trips.filter(trip => {
      const tripDate = new Date(trip.date);
      const start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);

      const isAfterStart = !startDate || tripDate >= start;
      const isBeforeEnd = !endDate || tripDate <= end;
      const isCorrectProject = projectId === 'all' || trip.projectId === projectId;
      return isAfterStart && isBeforeEnd && isCorrectProject;
    });

    const sortedTrips = filteredTrips.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setTripsForReport(sortedTrips);
    
    const warnings: { [key: string]: number } = {};
    sortedTrips.forEach(trip => {
      if (!trip.reason?.trim()) {
        warnings.missingReason = (warnings.missingReason || 0) + 1;
      }
      if (trip.distance === 0) {
        warnings.zeroDistance = (warnings.zeroDistance || 0) + 1;
      }
    });
    
    const warningsArray: AuditWarning[] = [];
    if (warnings.missingReason) {
        warningsArray.push({ message: t('report_audit_missing_reasons'), count: warnings.missingReason });
    }
    if (warnings.zeroDistance) {
        warningsArray.push({ message: t('report_audit_zero_distance'), count: warnings.zeroDistance });
    }

    setAuditWarnings(warningsArray);
    setStage('audit');
  };

  const handleGenerateAndSave = async () => {
    if (!userProfile || tripsForReport.length === 0) return;
    setStage('generating');
    
    const totalDistance = tripsForReport.reduce((sum, trip) => sum + trip.distance, 0);
    const projectName = projectId === 'all' ? t('report_filter_allProjects') : projects.find(p => p.id === projectId)?.name || t('report_unknownProject');
    
    const generationDate = new Date().toISOString();

    const tripHashes = tripsForReport.map(t => t.hash || '').join('');
    const reportSignature = await generateHash(`${generationDate}${startDate}${endDate}${totalDistance}${tripHashes}`);

    const newReport: Omit<Report, 'id'> = {
      generationDate,
      startDate,
      endDate,
      projectId,
      projectName,
      totalDistance,
      trips: tripsForReport,
      userProfileSnapshot: userProfile,
      signature: reportSignature,
      firstTripHash: tripsForReport[0].hash,
      lastTripHash: tripsForReport[tripsForReport.length - 1].hash,
    };
    
    onSave(newReport);
    onClose();
  };
  
  const renderSetup = () => (
     <>
  <main className="px-6 py-6 space-y-6 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-on-surface-dark-secondary mb-2">{t('report_filter_project')}</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full bg-background-dark border border-gray-600/70 rounded-md px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-brand-primary focus:outline-none hover:border-gray-500"
            >
              <option value="all">{t('report_filter_allProjects')}</option>
              {userProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-on-surface-dark-secondary mb-2">{t('report_filter_from')}</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-background-dark border border-gray-600/70 rounded-md px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-dark-secondary mb-2">{t('report_filter_to')}</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-background-dark border border-gray-600/70 rounded-md px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none"/>
            </div>
          </div>
        </main>
        <footer className="px-6 py-4 border-t border-gray-700/70 bg-background-dark/70 backdrop-blur-sm flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/60">{t('common_cancel')}</button>
          <button onClick={runAudit} disabled={!userProfile} className="px-5 py-2 text-sm bg-brand-primary hover:brightness-110 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-primary/60">{t('report_audit_run_btn')}</button>
        </footer>
     </>
  );
  
  const renderAudit = () => (
      <>
    <main className="px-6 py-6 space-y-4 overflow-y-auto">
      <h3 className="text-lg font-semibold tracking-tight text-white">{t('report_audit_title')}</h3>
      <p className="text-sm text-on-surface-dark-secondary">{t('report_audit_subtitle')}</p>
            {auditWarnings.length > 0 ? (
                <div className="bg-yellow-900/40 border border-yellow-700/60 text-yellow-200 p-4 rounded-lg space-y-2 text-sm">
                    {auditWarnings.map((warning, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <WarningIcon className="w-5 h-5 flex-shrink-0" />
                            <span>{warning.message} (x{warning.count})</span>
                        </div>
                    ))}
                </div>
            ) : (
                 <div className="bg-green-900/40 border border-green-700/60 text-green-200 p-4 rounded-lg flex items-center gap-2 text-sm">
                    <CheckIcon className="w-5 h-5"/>
                    <span>{t('report_audit_no_issues')}</span>
                </div>
            )}
        </main>
        <footer className="px-6 py-4 border-t border-gray-700/70 bg-background-dark/70 backdrop-blur-sm flex justify-between items-center gap-3">
          <button onClick={() => setStage('setup')} className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/60">{t('common_back')}</button>
          <button onClick={handleGenerateAndSave} className="px-5 py-2 text-sm bg-brand-primary hover:brightness-110 text-white rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/60">{auditWarnings.length > 0 ? t('report_generateBtn_anyway') : t('report_generateBtn')}</button>
        </footer>
      </>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 pt-20 z-50" onClick={onClose}>
      <div className="bg-frost-glass border border-gray-700/60 rounded-lg shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-gray-700/70 flex items-center justify-between gap-4 bg-background-dark/70 backdrop-blur-sm">
          <h2 className="text-lg font-semibold tracking-tight text-white">{t('report_title')}</h2>
          <button onClick={onClose} className="text-on-surface-dark-secondary hover:text-white p-2 rounded-md hover:bg-gray-700/40 focus:outline-none focus:ring-2 focus:ring-brand-primary/60"><XIcon className="w-5 h-5" /></button>
        </header>
        {stage === 'setup' && renderSetup()}
        {stage === 'audit' && renderAudit()}
      </div>
    </div>
  );
};

export default GenerateReportModal;