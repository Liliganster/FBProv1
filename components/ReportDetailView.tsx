import React from 'react';
import { Report, Project, PersonalizationSettings } from '../types';
import { ArrowLeftIcon, DownloadIcon, PrintIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import useToast from '../hooks/useToast';
import { formatDateForDisplay } from '../i18n/translations';

interface ReportDetailViewProps {
  report: Report;
  projects: Project[];
  onBack: () => void;
  personalization: PersonalizationSettings;
  theme: 'light' | 'dark';
}

const ReportDetailView: React.FC<ReportDetailViewProps> = ({ report, projects, onBack, personalization, theme }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  // FIX: Destructure userProfileSnapshot from report and alias it to driverSnapshot.
  const { userProfileSnapshot: driverSnapshot, trips: reportTrips, totalDistance, projectName, startDate, endDate, generationDate } = report;

  const getProjectInfo = (projectId: string): Project | undefined => {
    return projects.find(p => p.id === projectId);
  };

  const mainProjectInfo = report.projectId !== 'all' ? getProjectInfo(report.projectId) : null;

  const handlePrint = () => {
    const reportNode = document.querySelector('.printable-content');
    if (!reportNode) {
      showToast('Error: Report content not found.', 'error');
      return;
    }

    const printWindow = window.open('', '_blank', 'height=800,width=800');
    if (!printWindow) {
      showToast('Could not open print window. Please disable pop-up blockers.', 'warning');
      return;
    }
    
    const styleSheets = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
    const headContent = styleSheets.map(style => style.outerHTML).join('');
    const contentHTML = reportNode.outerHTML;

    const printOverrideStyles = `
      <style>
        /* Reset page margins to remove browser default headers/footers */
        @page {
          size: A4 landscape; /* Landscape orientation for wider tables */
          margin: 0;
        }

        @media print {
          .no-print {
            display: none !important;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            margin: 10mm 12mm !important; /* Reduced margins for more space */
          }
          
          /* Fix audit footer positioning - remove fixed position to avoid overlap */
          .audit-footer {
            position: static !important;
            margin-top: 15px !important;
            padding-top: 10px !important;
            border-top: 1px solid #666 !important;
            font-size: 6pt !important;
            color: #666 !important;
            page-break-inside: avoid;
            word-break: break-all !important;
            line-height: 1.2 !important;
          }
          
          /* Ensure table doesn't break awkwardly before footer */
          .printable-content table {
            margin-bottom: 20px !important;
            table-layout: auto !important;
            width: 100% !important;
          }
          
          /* Add page break control */
          .audit-footer {
            break-inside: avoid;
          }
          
          /* Reduce header sizes for print */
          .printable-content h3 {
            font-size: 14pt !important;
            margin-bottom: 8px !important;
          }
          
          .printable-content > div:first-child p {
            font-size: 8pt !important;
            margin-bottom: 6px !important;
          }
          
          /* Compact header info section */
          .printable-content > div:nth-child(2) {
            font-size: 7pt !important;
            margin-bottom: 10px !important;
            line-height: 1.3 !important;
          }
        }
        
        /* General styles for the print preview window */
        body {
          background-color: #ffffff !important;
          color: #000000 !important;
          font-family: Arial, sans-serif !important;
        }
        .printable-content {
          background-color: #ffffff !important; 
          border-radius: 0;
          box-shadow: none;
          padding: 0 !important;
        }
        /* Force black text on most elements */
        .printable-content,
        .printable-content p,
        .printable-content h3,
        .printable-content div {
           color: #000000 !important;
        }

        /* Table-specific styles - optimized for landscape A4 */
        .printable-content table {
          font-size: 7pt !important;
          border-collapse: collapse !important;
        }
        
        .printable-content table th,
        .printable-content table td {
          font-size: 7pt !important;
          padding: 3px 4px !important;
          color: #000000 !important;
          line-height: 1.2 !important;
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
        }
        
        /* Specific column widths */
        .printable-content table th:nth-child(1),
        .printable-content table td:nth-child(1) {
          width: 8% !important;
          white-space: nowrap !important;
        }
        
        .printable-content table th:nth-child(2),
        .printable-content table td:nth-child(2) {
          width: 12% !important;
        }
        
        .printable-content table th:nth-child(3),
        .printable-content table td:nth-child(3) {
          width: 12% !important;
        }
        
        .printable-content table th:nth-child(4),
        .printable-content table td:nth-child(4) {
          width: 60% !important;
          word-break: break-word !important;
        }
        
        .printable-content table th:nth-child(5),
        .printable-content table td:nth-child(5) {
          width: 8% !important;
          white-space: nowrap !important;
        }
        
        .printable-content table tfoot td {
          font-size: 8pt !important;
          font-weight: bold !important;
        }

        /* Keep brand color for important numbers */
        .text-brand-primary {
          color: #007aff !important;
        }

        /* Use a light grey for table headers/footers for better contrast on white */
        thead.bg-gray-700\\/50, tfoot.bg-gray-700\\/50 {
          background-color: #f0f0f0 !important;
        }
      </style>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title></title>
          ${headContent}
          ${printOverrideStyles}
        </head>
        <body>
          ${contentHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus(); 

    setTimeout(() => {
      try {
        printWindow.print();
        printWindow.close();
      } catch (e) {
        console.error("Print failed:", e);
        showToast('Printing was cancelled or failed.', 'error');
        printWindow.close();
      }
    }, 500);
  };

  const handleDownloadPdf = () => {
    showToast(t('report_saveAsPdf_toast'), 'info');
    handlePrint();
  };
  
  const licensePlate = driverSnapshot?.licensePlate || t('detail_unknown');

  const contentStyle = {
    backgroundColor: theme === 'dark'
        ? `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`
        : `rgba(243, 244, 246, ${1 - personalization.uiTransparency})`,
    backdropFilter: `blur(${personalization.uiBlur}px)`,
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8 no-print">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('reports_viewTitle')}</h1>
          <p className="text-on-surface-dark-secondary">{t('reports_generated_on')}: {formatDateForDisplay(generationDate)}</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">
            <ArrowLeftIcon className="w-5 h-5 mr-2" />
            {t('common_back')}
          </button>
          <button onClick={handleDownloadPdf} className="flex items-center bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">
            <DownloadIcon className="w-5 h-5 mr-2" />
            {t('report_downloadBtn')}
          </button>
          <button onClick={handlePrint} className="flex items-center bg-brand-secondary hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg">
            <PrintIcon className="w-5 h-5 mr-2" />
            {t('report_printBtn')}
          </button>
        </div>
      </div>
      
      <div style={contentStyle} className="bg-frost-glass printable-content p-6 rounded-lg">
        <div className="mb-4 text-center">
          <h3 className="text-2xl font-bold text-white">{t('report_preview_title')}</h3>
          <p className="text-on-surface-dark-secondary">
            {t('reports_period')}: {formatDateForDisplay(startDate)} - {formatDateForDisplay(endDate)}
          </p>
        </div>
        <div className="flex justify-between text-sm mb-4">
          <div>
            <p><span className="font-semibold text-on-surface-dark-secondary">{t('report_preview_driver')}:</span> {driverSnapshot?.name}</p>
            <p><span className="font-semibold text-on-surface-dark-secondary">{t('report_preview_address')}:</span> {`${driverSnapshot?.address}, ${driverSnapshot?.city}`}</p>
          </div>
          <div>
            <p><span className="font-semibold text-on-surface-dark-secondary">{t('report_preview_licensePlate')}:</span> {licensePlate}</p>
            {mainProjectInfo ? (
              <>
                <p><span className="font-semibold text-on-surface-dark-secondary">{t('report_preview_project')}:</span> {mainProjectInfo.name}</p>
                <p><span className="font-semibold text-on-surface-dark-secondary">{t('report_col_producer')}:</span> {mainProjectInfo.producer}</p>
              </>
            ) : (
              <p><span className="font-semibold text-on-surface-dark-secondary">{t('report_preview_project')}:</span> {projectName}</p>
            )}
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-700/50">
            <tr>
              <th className="p-2">{t('report_col_date')}</th>
              <th className="p-2">{t('report_col_project')}</th>
              <th className="p-2">{t('report_col_producer')}</th>
              <th className="p-2">{t('report_col_route')}</th>
              <th className="p-2 text-right">{t('report_col_distance')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {reportTrips.map(trip => {
                const project = getProjectInfo(trip.projectId);
                const projectNameDisplay = project ? project.name : t('report_unknownProject');
                const producerDisplay = project ? project.producer : t('detail_unknown');
                return (
                  <tr key={trip.id}>
                    <td className="p-2 whitespace-nowrap">{formatDateForDisplay(trip.date)}</td>
                    <td className="p-2">{projectNameDisplay}</td>
                    <td className="p-2">{producerDisplay}</td>
                    <td className="p-2">{trip.locations.join(' → ')}</td>
                    <td className="p-2 text-right font-bold text-brand-primary">{trip.distance.toFixed(1)} km</td>
                  </tr>
                );
              })}
          </tbody>
          <tfoot className="bg-gray-700/50 font-bold">
            <tr>
              <td className="p-2" colSpan={4}>{t('report_total_kms')}</td>
              <td className="p-2 text-right text-brand-primary text-base">
                {totalDistance.toFixed(1)} km
              </td>
            </tr>
          </tfoot>
        </table>

        {report.signature && (
            <div className="audit-footer mt-6 pt-4 border-t border-gray-600 text-xs text-on-surface-dark-secondary font-mono">
                <p><strong>{t('report_audit_signature_title')}</strong></p>
                <p><strong>{t('report_audit_signature')}:</strong> {report.signature}</p>
                <p><strong>{t('report_audit_chain_start')}:</strong> {report.firstTripHash}</p>
                <p><strong>{t('report_audit_chain_end')}:</strong> {report.lastTripHash}</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default ReportDetailView;