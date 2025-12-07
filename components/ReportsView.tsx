import React, { useState } from 'react';
import useReports from '../hooks/useReports';
import useTrips from '../hooks/useTrips';
import { Report, PersonalizationSettings } from '../types';
import ReportDetailView from './ReportDetailView';
import GenerateReportModal from './GenerateReportModal';
import { PlusIcon, TrashIcon, FileTextIcon } from './Icons';
import { Button } from './Button';
import useTranslation from '../hooks/useTranslation';
import { useMobile } from '../hooks/useMediaQuery';
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
  const isMobile = useMobile();

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
    backgroundColor: `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`,
    backdropFilter: `blur(${personalization.uiBlur}px)`,
    WebkitBackdropFilter: `blur(${personalization.uiBlur}px)`,
    border: '1px solid rgba(255, 255, 255, 0.08)',
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
    <div className="text-on-surface-dark" id="reports-view">
      <div className="flex justify-between items-center mb-8" id="reports-header">
        {selectedReportIds.length > 0 ? (
          <div className="flex items-center gap-4 w-full">
            <h2 className="text-base font-semibold text-white">{t('reports_selected_count', { count: selectedReportIds.length })}</h2>
            <button
              onClick={handleDeleteSelected}
              className="flex items-center bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg transition-colors ml-auto text-sm"
            >
              <TrashIcon className="w-5 h-5 mr-2" />
              {t('reports_delete_selected_btn')}
            </button>
          </div>
        ) : (
          <>
            <div>
                <h1 id="reports-title" className="text-[28px] font-bold text-white">{t('reports_title')}</h1>
                {userProfile && <h2 className="text-base font-semibold text-brand-primary">{userProfile.name}</h2>}
            </div>
            <Button 
              id="reports-generate-btn"
              variant="primary"
              onClick={() => setIsGeneratorOpen(true)} 
              className="h-[38px]"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              {t('reports_generateNew')}
            </Button>
          </>
        )}
      </div>

{isMobile ? (
        // Vista mobile con cards
        <div className="space-y-4">
          {reports.length > 0 ? (
            <>
              {selectedReportIds.length > 0 && (
                <div className="bg-frost-glass border-glass rounded-fluid p-4 mb-4 backdrop-blur-glass">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">{t('reports_selected_count', { count: selectedReportIds.length })}</span>
                    <button
                      onClick={handleDeleteSelected}
                      className="flex items-center bg-gradient-to-r from-red-600 to-red-700 hover:shadow-md hover:shadow-red-500/30 hover:scale-[1.02] text-white font-bold py-2 px-4 rounded-smooth transition-all duration-200 text-sm"
                    >
                      <TrashIcon className="w-4 h-4 mr-1" />
                      {t('reports_deleteSelected')}
                    </button>
                  </div>
                </div>
              )}
              {reports.map(report => {
                const isSelected = selectedReportIds.includes(report.id);
                return (
                  <div
                    key={report.id}
                    className={`bg-frost-glass border-glass rounded-fluid p-4 backdrop-blur-glass transition-all duration-200 ${
                      isSelected ? 'ring-2 ring-brand-primary bg-brand-primary/10' : 'hover:bg-gray-800/40'
                    }`}
                  >
                    {/* Header con checkbox y acciones */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectReport(report.id)}
                          className="bg-background-dark border-gray-600 rounded text-brand-primary focus:ring-brand-primary focus:ring-2 h-5 w-5"
                        />
                        <span className="text-on-surface-dark-secondary text-xs uppercase tracking-wider">{t('reports_col_generated')}</span>
                        <span className="text-white font-medium text-sm">{formatDateForDisplay(report.generationDate)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setViewingReport(report)} 
                          className="text-blue-400 hover:text-blue-300 font-semibold text-sm transition-colors"
                        >
                          {t('reports_viewBtn')}
                        </button>
                        <button 
                          onClick={() => handleDeleteReport(report.id)} 
                          className="p-1 text-red-400 hover:text-red-300 transition-colors"
                        >
                          <TrashIcon className="w-4 h-4"/>
                        </button>
                      </div>
                    </div>

                    {/* Contenido principal clickeable */}
                    <div className="cursor-pointer" onClick={() => setViewingReport(report)}>
                      {/* Período */}
                      <div className="mb-2">
                        <span className="text-on-surface-dark-secondary text-xs uppercase tracking-wider">{t('reports_col_period')}</span>
                        <p className="text-white text-sm">{`${formatDateForDisplay(report.startDate)} - ${formatDateForDisplay(report.endDate)}`}</p>
                      </div>

                      {/* Proyecto */}
                      <div>
                        <span className="text-on-surface-dark-secondary text-xs uppercase tracking-wider">{t('reports_col_project')}</span>
                        <p className="text-white font-medium text-sm">{report.projectName}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="bg-frost-glass border-glass rounded-fluid p-8 backdrop-blur-glass text-center">
              <div className="flex flex-col items-center">
                <FileTextIcon className="w-12 h-12 mb-2 text-gray-600"/>
                <p className="text-on-surface-dark-secondary">{t('reports_noReports')}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Vista desktop con tabla
        <div style={contentStyle} className="bg-frost-glass rounded-lg shadow-lg overflow-hidden" id="reports-table-wrapper">
          <table id="reports-table" className="w-full text-left">
            <thead className="bg-gray-700/50">
              <tr>
                <th id="reports-col-select" className="p-4 w-12">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    disabled={reports.length === 0}
                    className="bg-background-dark border-gray-600 rounded text-brand-primary focus:ring-brand-primary focus:ring-2 h-5 w-5"
                  />
                </th>
                <th id="reports-col-generated" className="p-4 text-[11px] font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('reports_col_generated')}</th>
                <th id="reports-col-period" className="p-4 text-[11px] font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('reports_col_period')}</th>
                <th id="reports-col-project" className="p-4 text-[11px] font-semibold text-on-surface-dark-secondary uppercase tracking-wider">{t('reports_col_project')}</th>
                <th id="reports-col-actions" className="p-4 text-[11px] font-semibold text-on-surface-dark-secondary uppercase tracking-wider text-right">{t('reports_col_actions')}</th>
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
                  <td className="p-4 whitespace-nowrap text-sm">{formatDateForDisplay(report.generationDate)}</td>
                  <td className="p-4 whitespace-nowrap text-sm">{`${formatDateForDisplay(report.startDate)} - ${formatDateForDisplay(report.endDate)}`}</td>
                  <td className="p-4 whitespace-nowrap text-sm">{report.projectName}</td>
                  <td className="p-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setViewingReport(report)} className="text-blue-400 hover:text-blue-300 mr-4 font-semibold text-sm">{t('reports_viewBtn')}</button>
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
      )}
      
      {isGeneratorOpen && (
        <GenerateReportModal
          trips={trips}
          projects={projects}
          onSave={handleSaveReport}
          onClose={() => setIsGeneratorOpen(false)}
          personalization={personalization}
          theme={theme}
        />
      )}
    </div>
  );
};

export default ReportsView;
