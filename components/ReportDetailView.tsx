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

    // Clone the node to manipulate it for printing without affecting the UI
    const clone = reportNode.cloneNode(true) as HTMLElement;

    // Remove inline styles
    clone.style.cssText = '';

    // Helper to recursively remove dark mode classes
    const removeDarkClasses = (element: Element) => {
      element.classList.remove(
        'bg-gray-700/50',
        'text-white',
        'divide-gray-700/50',
        'bg-transparent',
        'text-on-surface-dark-secondary',
        'bg-background-dark',
        'backdrop-blur-sm'
      );
      // Force text color to black for all elements
      if (element instanceof HTMLElement) {
        element.style.color = 'black';
        element.style.borderColor = '#ccc';
      }
      Array.from(element.children).forEach(removeDarkClasses);
    };
    removeDarkClasses(clone);

    const printWindow = window.open('', '_blank', 'height=800,width=800');
    if (!printWindow) {
      showToast('Could not open print window. Please disable pop-up blockers.', 'warning');
      return;
    }

    const styleSheets = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
    const headContent = styleSheets.map(style => style.outerHTML).join('');
    const contentHTML = clone.outerHTML;

    const printOverrideStyles = `
      <style>
        @page {
          size: A4;
          margin: 11mm;
        }

        /* Force white background and black text everywhere */
        html, body {
          background-color: #ffffff !important;
          background: #ffffff !important;
          color: #000000 !important;
          height: auto !important;
          overflow: visible !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            text-shadow: none !important;
            box-shadow: none !important;
          }
          
          .no-print {
            display: none !important;
          }
          
          body {
            font-family: Arial, sans-serif !important;
            font-size: 11pt !important;
            line-height: 1.3 !important;
          }
          
          .printable-content {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
          }

          /* Force all text to be black and backgrounds transparent (except headers) */
          .printable-content * {
            color: #000 !important;
            background-color: transparent !important;
          }
          
          /* Headers */
          .printable-content h3 {
            font-size: 14pt !important;
            margin: 0 0 6px 0 !important;
            color: #000 !important;
          }
          
          .printable-content > div:first-child {
            margin-bottom: 10px !important;
            text-align: center !important;
          }
          
          .printable-content > div:first-child p {
            font-size: 11pt !important;
            margin: 0 !important;
            color: #000 !important;
          }
          
          /* Info del conductor */
          .printable-content > div:nth-child(2) {
            font-size: 11pt !important;
            margin-bottom: 12px !important;
            line-height: 1.4 !important;
          }
          
          .printable-content > div:nth-child(2) p {
            margin: 0 0 3px 0 !important;
            color: #000 !important;
          }
          
          /* Tabla */
          .printable-content table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 11pt !important;
            margin: 0 !important;
          }
          
          .printable-content table th {
            font-size: 11pt !important;
            font-weight: bold !important;
            padding: 4px 6px !important;
            background-color: #ffffff !important;
            text-align: left !important;
            color: #000 !important;
            border-bottom: 1px solid #000 !important;
          }
          
          .printable-content table td {
            font-size: 11pt !important;
            padding: 4px 6px !important;
            vertical-align: top !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            color: #000 !important;
          }
          
          .printable-content tbody tr {
            border-bottom: 1px solid #e0e0e0 !important;
          }
          
          /* Anchos de columna */
          .printable-content table th:nth-child(1),
          .printable-content table td:nth-child(1) {
            width: 10% !important;
            white-space: nowrap !important;
          }
          
          .printable-content table th:nth-child(2),
          .printable-content table td:nth-child(2) {
            width: 13% !important;
          }
          
          .printable-content table th:nth-child(3),
          .printable-content table td:nth-child(3) {
            width: 13% !important;
          }
          
          .printable-content table th:nth-child(4),
          .printable-content table td:nth-child(4) {
            width: 56% !important;
          }
          
          .printable-content table th:nth-child(5),
          .printable-content table td:nth-child(5) {
            width: 8% !important;
            white-space: nowrap !important;
            text-align: right !important;
          }
          
          .printable-content table tfoot td {
            font-size: 11pt !important;
            font-weight: bold !important;
            padding: 6px !important;
            background-color: #ffffff !important;
            color: #000 !important;
            border-top: 2px solid #000 !important;
          }
          
          /* Footer de auditoría */
          .audit-footer {
            margin-top: 20px !important;
            padding-top: 12px !important;
            border-top: 1px solid #ccc !important;
            font-size: 9pt !important;
            line-height: 1.3 !important;
            color: #666 !important;
            page-break-inside: avoid !important;
            word-break: break-all !important;
          }
          
          .audit-footer p {
            margin: 3px 0 !important;
            color: #666 !important;
          }
        }
        
        /* Estilos generales para vista previa */
        body {
          background-color: #ffffff !important;
          color: #000000 !important;
          font-family: Arial, sans-serif !important;
        }
        
        .printable-content {
          background-color: #ffffff !important;
          color: #000000 !important;
        }
        
        .text-brand-primary {
          color: #000 !important;
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

  const transparency = 1 - personalization.uiTransparency;
  const contentStyle = {
    backgroundColor: `rgba(30, 30, 30, ${transparency})`,
    color: '#e5e7eb',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 16px 50px rgba(0,0,0,0.3)',
    backdropFilter: `blur(${personalization.uiBlur}px)`,
    WebkitBackdropFilter: `blur(${personalization.uiBlur}px)`,
  };

  const tableHeaderClass = 'bg-gray-700/50 text-white';
  const tableDividerClass = 'divide-gray-700/50';
  const tableFooterClass = 'bg-gray-700/50 text-white';

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

      <div
        style={contentStyle}
        className="printable-content p-6 md:p-8 rounded-xl"
      >
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
        <div className="overflow-hidden rounded-lg border border-gray-500/20 shadow-inner">
          <table className="w-full text-left text-sm">
            <thead className={tableHeaderClass}>
              <tr>
                <th className="p-2">{t('report_col_date')}</th>
                <th className="p-2">{t('report_col_project')}</th>
                <th className="p-2">{t('report_col_producer')}</th>
                <th className="p-2">{t('report_col_route')}</th>
                <th className="p-2 text-right">{t('report_col_distance')}</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${tableDividerClass}`}>
              {reportTrips.map(trip => {
                const project = getProjectInfo(trip.projectId);
                const projectNameDisplay = project ? project.name : t('report_unknownProject');
                const producerDisplay = project ? project.producer : t('detail_unknown');
                return (
                  <tr key={trip.id} className="bg-transparent">
                    <td className="p-2 whitespace-nowrap">{formatDateForDisplay(trip.date)}</td>
                    <td className="p-2">{projectNameDisplay}</td>
                    <td className="p-2">{producerDisplay}</td>
                    <td className="p-2">{trip.locations.join(' -> ')}</td>
                    <td className="p-2 text-right font-bold">{trip.distance.toFixed(1)} km</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className={`${tableFooterClass} font-bold`}>
              <tr>
                <td className="p-2" colSpan={4}>{t('report_total_kms')}</td>
                <td className="p-2 text-right text-base">
                  {totalDistance.toFixed(1)} km
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

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
