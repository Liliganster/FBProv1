import React, { useState } from 'react';
import { Report, Project, PersonalizationSettings } from '../types';
import { ArrowLeftIcon, DownloadIcon, PrintIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import useToast from '../hooks/useToast';
import { formatDateForDisplay } from '../i18n/translations';
import * as XLSX from 'xlsx';

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
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
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
          margin: 10mm;
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
            font-size: 8pt !important;
            line-height: 1.3 !important;
            padding: 10mm !important;
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
            font-size: 10pt !important;
            margin: 0 0 6px 0 !important;
            color: #000 !important;
          }
          
          .printable-content > div:first-child {
            margin-bottom: 10px !important;
            text-align: center !important;
          }
          
          .printable-content > div:first-child p {
            font-size: 8pt !important;
            margin: 0 !important;
            color: #000 !important;
          }
          
          /* Info del conductor */
          .printable-content > div:nth-child(2) {
            font-size: 8pt !important;
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
            font-size: 8pt !important;
            margin: 0 !important;
          }
          
          .printable-content table th {
            font-size: 8pt !important;
            font-weight: bold !important;
            padding: 4px 6px !important;
            background-color: #ffffff !important;
            text-align: left !important;
            color: #000 !important;
            border-bottom: 1px solid #000 !important;
          }
          
          .printable-content table td {
            font-size: 8pt !important;
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
            width: 15% !important;
          }
          
          .printable-content table th:nth-child(3),
          .printable-content table td:nth-child(3) {
            width: 15% !important;
          }
          
          .printable-content table th:nth-child(4),
          .printable-content table td:nth-child(4) {
            width: 40% !important;
          }
          
          .printable-content table th:nth-child(5),
          .printable-content table td:nth-child(5) {
            width: 10% !important;
            text-align: center !important;
            white-space: nowrap !important;
          }
          
          .printable-content table th:nth-child(6),
          .printable-content table td:nth-child(6) {
            width: 10% !important;
            white-space: nowrap !important;
            text-align: right !important;
          }
          
          .printable-content table tfoot td {
            font-size: 8pt !important;
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
            font-size: 7pt !important;
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

  const handleDownloadExcel = () => {
    try {
      // Crear los datos para el Excel
      const excelData = reportTrips.map(trip => {
        const project = getProjectInfo(trip.projectId);
        const projectNameDisplay = project ? project.name : t('report_unknownProject');
        const producerDisplay = project ? project.producer : t('detail_unknown');
        const passengers = typeof trip.passengers === 'number' ? trip.passengers : 0;
        
        return {
          [t('report_col_date')]: formatDateForDisplay(trip.date),
          [t('report_col_project')]: projectNameDisplay,
          [t('report_col_producer')]: producerDisplay,
          [t('report_col_route')]: trip.locations.join(' -> '),
          [t('report_col_passengers') || 'Pasajeros']: passengers,
          [t('report_col_distance')]: `${trip.distance.toFixed(1)} km`
        };
      });

      // Agregar fila de total
      excelData.push({
        [t('report_col_date')]: '',
        [t('report_col_project')]: '',
        [t('report_col_producer')]: '',
        [t('report_col_route')]: t('report_total_kms'),
        [t('report_col_passengers') || 'Pasajeros']: '',
        [t('report_col_distance')]: `${totalDistance.toFixed(1)} km`
      });

      // Crear el libro de trabajo
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Ajustar el ancho de las columnas
      const colWidths = [
        { wch: 12 }, // Fecha
        { wch: 25 }, // Proyecto
        { wch: 25 }, // Productor
        { wch: 50 }, // Ruta
        { wch: 12 }, // Pasajeros
        { wch: 15 }  // Distancia
      ];
      ws['!cols'] = colWidths;

      // Agregar información del header
      XLSX.utils.sheet_add_aoa(ws, [
        [t('report_preview_title')],
        [`${t('reports_period')}: ${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`],
        [`${t('report_preview_driver')}: ${driverSnapshot?.name}`],
        [`${t('report_preview_address')}: ${driverSnapshot?.address}, ${driverSnapshot?.city}`],
        [`${t('report_preview_licensePlate')}: ${licensePlate}`],
        [`${t('report_preview_project')}: ${mainProjectInfo ? mainProjectInfo.name : projectName}`],
        [''],
      ], { origin: 'A1' });

      // Ajustar las referencias de rango después de agregar las filas del header
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      range.e.r += 7;
      ws['!ref'] = XLSX.utils.encode_range(range);

      // Agregar la hoja al libro
      XLSX.utils.book_append_sheet(wb, ws, t('reports_title'));

      // Generar el nombre del archivo
      const fileName = `Informe_${projectName}_${formatDateForDisplay(startDate)}_${formatDateForDisplay(endDate)}.xlsx`.replace(/\//g, '-');

      // Descargar el archivo
      XLSX.writeFile(wb, fileName);

      showToast(t('report_excel_downloaded') || 'Informe descargado en Excel', 'success');
    } catch (error) {
      console.error('Error generating Excel:', error);
      showToast('Error al generar el archivo Excel', 'error');
    }
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
  const passengersLabel = t('report_col_passengers');

  return (
    <div>
      <div className="flex justify-between items-center mb-8 no-print">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('reports_viewTitle')}</h1>
          <p className="text-on-surface-dark-secondary">{t('reports_generated_on')}: {formatDateForDisplay(generationDate)}</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg h-[38px]">
            <ArrowLeftIcon className="w-5 h-5 mr-2" />
            {t('common_back')}
          </button>
          
          {/* Botón de descarga con menú desplegable */}
          <div className="relative">
            <button 
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              className="flex items-center bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg h-[38px]"
            >
              <DownloadIcon className="w-5 h-5 mr-2" />
              {t('report_downloadBtn_menu')}
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showDownloadMenu && (
              <>
                {/* Overlay para cerrar el menú al hacer clic fuera */}
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowDownloadMenu(false)}
                />
                
                {/* Menú desplegable */}
                <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-gray-800 border border-gray-700 z-20">
                  <button
                    onClick={() => {
                      handleDownloadExcel();
                      setShowDownloadMenu(false);
                    }}
                    className="w-full text-left px-4 py-3 text-white hover:bg-gray-700 rounded-t-lg flex items-center transition-colors"
                  >
                    <svg className="w-5 h-5 mr-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {t('report_download_excel')}
                  </button>
                  <button
                    onClick={() => {
                      handleDownloadPdf();
                      setShowDownloadMenu(false);
                    }}
                    className="w-full text-left px-4 py-3 text-white hover:bg-gray-700 flex items-center transition-colors"
                  >
                    <svg className="w-5 h-5 mr-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    {t('report_download_pdf')}
                  </button>
                  <button
                    onClick={() => {
                      handlePrint();
                      setShowDownloadMenu(false);
                    }}
                    className="w-full text-left px-4 py-3 text-white hover:bg-gray-700 rounded-b-lg flex items-center transition-colors"
                  >
                    <PrintIcon className="w-5 h-5 mr-3 text-blue-400" />
                    {t('report_printBtn')}
                  </button>
                </div>
              </>
            )}
          </div>
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
        <div className="overflow-hidden rounded-lg shadow-inner">
          <table className="w-full text-left text-sm">
            <thead className={tableHeaderClass}>
              <tr>
                <th className="p-2">{t('report_col_date')}</th>
                <th className="p-2">{t('report_col_project')}</th>
                <th className="p-2">{t('report_col_producer')}</th>
                <th className="p-2">{t('report_col_route')}</th>
                <th className="p-2 text-center">{passengersLabel && passengersLabel !== 'report_col_passengers' ? passengersLabel : 'Pasajeros'}</th>
                <th className="p-2 text-right">{t('report_col_distance')}</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${tableDividerClass}`}>
              {reportTrips.map(trip => {
                const project = getProjectInfo(trip.projectId);
                const projectNameDisplay = project ? project.name : t('report_unknownProject');
                const producerDisplay = project ? project.producer : t('detail_unknown');
                const passengers = typeof trip.passengers === 'number' ? trip.passengers : 0;
                return (
                  <tr key={trip.id} className="bg-transparent">
                    <td className="p-2 whitespace-nowrap">{formatDateForDisplay(trip.date)}</td>
                    <td className="p-2">{projectNameDisplay}</td>
                    <td className="p-2">{producerDisplay}</td>
                    <td className="p-2">{trip.locations.join(' -> ')}</td>
                    <td className="p-2 text-center">{passengers}</td>
                    <td className="p-2 text-right font-bold">{trip.distance.toFixed(1)} km</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className={`${tableFooterClass} font-bold`}>
              <tr>
                <td className="p-2" colSpan={5}>{t('report_total_kms')}</td>
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
