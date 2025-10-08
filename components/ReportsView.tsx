import React, { useState } from 'react';
import useReports from '../hooks/useReports';
import useTrips from '../hooks/useTrips';
import { Report, PersonalizationSettings } from '../types';
import ReportDetailView from './ReportDetailView';
import GenerateReportModal from './GenerateReportModal';
import { PlusIcon, TrashIcon, FileTextIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import { formatDateForDisplay } from '../i18n/translations';
import useUserProfile from '../hooks/useUserProfile';

interface ReportsViewProps {
    personalization: PersonalizationSettings;
    theme: 'light' | 'dark';
}

const ReportsView: React.FC<ReportsViewProps> = ({ personalization, theme }) => {
  const { reports, addReport, deleteReport, deleteMultipleReports } = useReports();
  const { trips, projects } = useTrips();
  const { t } = useTranslation();
  const { userProfile } = useUserProfile();

  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);

  const handleSaveReport = (report: Omit<Report, 'id'>) => {
    addReport(report);
  };
  
  const handleDeleteReport = (reportId: string) => {
    if (window.confirm(t('reports_deleteConfirm'))) {
      deleteReport(reportId);
    }
  };
  
  const handleSelectReport = (id: string) => {
    setSelectedReportIds(prev =>
      prev.includes(id) ? prev.filter(reportId => reportId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedReportIds(reports.map(r => r.id));
    } else {
      setSelectedReportIds([]);
    }
  };

  const handleDeleteSelected = () => {
    if (window.confirm(t('reports_delete_selected_confirm', { count: selectedReportIds.length }))) {
      deleteMultipleReports(selectedReportIds);
      setSelectedReportIds([]);
    }
  };

  const isAllSelected = reports.length > 0 && selectedReportIds.length === reports.length;
  
  const contentStyle = {
    backgroundColor: theme === 'dark'
        ? `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`
        : `rgba(243, 244, 246, ${1 - personalization.uiTransparency})`,
    backdropFilter: `blur(${personalization.uiBlur}px)`,
  };

  if (viewingReport) {
    return <ReportDetailView 
        report={viewingReport} 
        projects={projects} 
        onBack={() => setViewingReport(null)}
        personalization={personalization}
        theme={theme}
    />;
  }
  
  return (
    <div className={`${theme === 'dark' ? 'text-on-surface-dark' : 'text-gray-900'}`}>
      <div className="flex justify-between items-center mb-8">
        {selectedReportIds.length > 0 ? (
          <div className="flex items-center gap-4 w-full">
            <h2 className="text-xl font-semibold text-white">{t('reports_selected_count', { count: selectedReportIds.length })}</h2>
            <button
              onClick={handleDeleteSelected}
              className="flex items-center bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg transition-colors ml-auto"
            >
              <TrashIcon className="w-5 h-5 mr-2" />
              {t('reports_delete_selected_btn')}
            </button>
          </div>
        ) : (
          <>
            <div>
                <h1 className="text-3xl font-bold text-white">{t('reports_title')}</h1>
                {userProfile && <h2 className="text-lg font-semibold text-brand-primary">{userProfile.name}</h2>}
            </div>
            <button 
              onClick={() => setIsGeneratorOpen(true)} 
              className="flex items-center bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              {t('reports_generateNew')}
            </button>
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
                  disabled={reports.length === 0}
                  className="bg-background-dark border-gray-600 rounded text-brand-primary focus:ring-brand-primary focus:ring-2 h-5 w-5"
                />
              </th>
              <th className="p-4 text-sm font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('reports_col_generated')}</th>
              <th className="p-4 text-sm font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('reports_col_period')}</th>
              <th className="p-4 text-sm font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('reports_col_project')}</th>
              <th className="p-4 text-sm font-semibold text-on-surface-dark-secondary uppercase tracking-wider text-right">{t('reports_col_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {reports.length > 0 ? reports.map(report => {
              const isSelected = selectedReportIds.includes(report.id);
              return (
              <tr 
                key={report.id} 
                onClick={() => setViewingReport(report)}
                className={`${isSelected ? 'bg-brand-primary/20' : ''} hover:bg-gray-800/40 transition-colors cursor-pointer`}
              >
                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleSelectReport(report.id)}
                    className="bg-background-dark border-gray-600 rounded text-brand-primary focus:ring-brand-primary focus:ring-2 h-5 w-5"
                  />
                </td>
                <td className="p-4 whitespace-nowrap">{formatDateForDisplay(report.generationDate)}</td>
                <td className="p-4 whitespace-nowrap">{`${formatDateForDisplay(report.startDate)} - ${formatDateForDisplay(report.endDate)}`}</td>
                <td className="p-4 whitespace-nowrap">{report.projectName}</td>
                <td className="p-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setViewingReport(report)} className="text-blue-400 hover:text-blue-300 mr-4 font-semibold">{t('reports_viewBtn')}</button>
                  <button onClick={() => handleDeleteReport(report.id)} className="text-red-400 hover:text-red-300"><TrashIcon className="w-5 h-5"/></button>
                </td>
              </tr>
              );
            }) : (
              <tr>
                <td colSpan={5} className="text-center p-8 text-on-surface-dark-secondary">
                  <div className="flex flex-col items-center">
                    <FileTextIcon className="w-12 h-12 mb-2 text-gray-600"/>
                    {t('reports_noReports')}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {isGeneratorOpen && (
        <GenerateReportModal
          trips={trips}
          projects={projects}
          onSave={handleSaveReport}
          onClose={() => setIsGeneratorOpen(false)}
        />
      )}
    </div>
  );
};

export default ReportsView;