

import React, { useState, useMemo } from 'react';
import { Trip, Project, SpecialOrigin, UserProfile, DocumentType } from '../types';
import useTrips from '../hooks/useTrips';
import { XIcon, TrashIcon, UploadCloudIcon, CheckIcon, WarningIcon, FileCsvIcon, SparklesIcon, LoaderIcon, FileTextIcon, DriveIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import { formatDateForStorage } from '../i18n/translations';
import useToast from '../hooks/useToast';
import useUserProfile from '../hooks/useUserProfile';
import { normalizeSignature } from '../services/tripUtils';
import { processFileForTrip } from '../services/aiService';
import useGoogleMapsScript from '../hooks/useGoogleMapsScript';
import useGoogleCalendar from '../hooks/useGoogleCalendar';

interface BulkUploadModalProps {
  projects: Project[];
  onSave: (trips: Omit<Trip, 'id'>[]) => void;
  onClose: () => void;
}

type Mode = 'csv' | 'ai';
type Stage = 'upload' | 'review';
type DraftTrip = Omit<Trip, 'id'> & { warnings?: string[] };

const KNOWN_HEADERS = {
    date: ['date', 'datum', 'fecha'],
    projectName: ['projectname', 'projekt', 'proyecto', 'project'],
    reason: ['reason', 'zweck', 'motivo', 'beschreibung'],
    origin: ['origin', 'start', 'von', 'origen', 'abfahrt'],
    destination: ['destination', 'end', 'ziel', 'nach', 'destino', 'ankunft'],
    distance: ['distance', 'distanz', 'km', 'kilometer', 'distancia'],
};

const parseCsvLine = (line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let currentField = '';
    let inQuotedField = false;

    for (let i = 0; i < line.length; i++) {
        const char = line.charAt(i);

        if (inQuotedField) {
            if (char === '"') {
                if (i + 1 < line.length && line.charAt(i + 1) === '"') {
                    currentField += '"';
                    i++;
                } else {
                    inQuotedField = false;
                }
            } else {
                currentField += char;
            }
        } else {
            if (char === '"') {
                inQuotedField = true;
            } else if (char === delimiter) {
                result.push(currentField.trim());
                currentField = '';
            } else {
                currentField += char;
            }
        }
    }
    result.push(currentField.trim());
    return result;
};

const robustParseFloat = (numStr: string): number => {
    if (typeof numStr !== 'string' || !numStr) return NaN;
    let s = numStr.trim().replace(/\s/g, '');
    if (s.includes(',')) {
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes('.')) {
        const parts = s.split('.');
        if (parts.length > 2) {
            s = s.replace(/\./g, '');
        }
        else if (parts.length === 2 && parts[1].length === 3 && parts[0].length > 0) {
            s = s.replace(/\./g, '');
        }
    }
    const result = parseFloat(s);
    return isNaN(result) ? NaN : result;
};





const BulkUploadModal: React.FC<BulkUploadModalProps> = ({ projects, onSave, onClose }) => {
  const [mode, setMode] = useState<Mode>('csv');
  const [stage, setStage] = useState<Stage>('upload');
  const [draftTrips, setDraftTrips] = useState<DraftTrip[]>([]);
  const { userProfile } = useUserProfile();
  const { trips } = useTrips();
  const [newlyCreatedProjectNames, setNewlyCreatedProjectNames] = useState<string[]>([]);
  
  const [csvPastedText, setCsvPastedText] = useState('');

  const [aiFiles, setAiFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>(DocumentType.CALLSHEET);
  
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { isLoaded: isMapsScriptLoaded, error: mapsScriptError } = useGoogleMapsScript({ apiKey: userProfile?.googleMapsApiKey });
  const { showPicker, gapiClient, isSignedIn, signIn } = useGoogleCalendar();

  const findHeaderIndex = (headers: string[], validNames: string[]): number => {
    return headers.findIndex(h => validNames.includes(h.trim().toLowerCase()));
  };
  
  const resetState = () => {
    setStage('upload');
    setDraftTrips([]);
    setNewlyCreatedProjectNames([]);
    setCsvPastedText('');
    setAiFiles([]);
    setIsProcessing(false);
  };
  
  const handleModeChange = (newMode: Mode) => {
    resetState();
    setMode(newMode);
  };

  const handleAiFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const files = Array.from(event.target.files);
    setAiFiles(prev => [...prev, ...files].slice(0, 50));
  };
  
  const handleProcessAi = async () => {
      if (!userProfile) {
          showToast(t('report_alert_missingData'), 'error');
          return;
      }
      
      if (userProfile.googleMapsApiKey && !isMapsScriptLoaded) {
          const message = mapsScriptError ? `Failed to load Google Maps: ${mapsScriptError.message}` : 'Google Maps service is still loading. Please wait a moment and try again.';
          showToast(message, mapsScriptError ? 'error' : 'info');
          return;
      }
      
      setIsProcessing(true);
      
      const promises = aiFiles.map(file => 
        processFileForTrip(file, userProfile, documentType)
          .then(result => ({ status: 'fulfilled' as const, value: result }))
          .catch(error => ({ status: 'rejected' as const, reason: error, fileName: file.name }))
      );
      
      const results = await Promise.all(promises);

      const successfulExtractions: { tripData: Omit<Trip, 'id' | 'projectId'>; projectName: string }[] = [];
      let errorCount = 0;
      
      results.forEach((result) => {
          if (result.status === 'fulfilled') {
              successfulExtractions.push(result.value);
          } else {
              errorCount++;
              console.error(`Failed to process file ${result.fileName}:`, result.reason);
          }
      });

      if (errorCount > 0) {
          showToast(`Failed to process ${errorCount} files. Check console for details.`, 'error');
      }
      
      if (successfulExtractions.length > 0) {
          const reviewData = successfulExtractions.map(res => ({
            ...res.tripData,
            projectName: res.projectName,
            warnings: [],
          }));
          prepareForReview(reviewData);
      }
      
      setIsProcessing(false);
  };

    const handleDriveImport = () => {
        if (!isSignedIn) {
            signIn();
            return;
        }

        const pickerCallback = async (data: any) => {
            if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
                const docs = data[window.google.picker.Response.DOCUMENTS] as any[];
                if (!docs || docs.length === 0) return;

                showToast(`Importing ${docs.length} file(s) from Google Drive...`, 'info');
                setIsProcessing(true);

                const csvDocs = docs.filter(d => d.mimeType === 'text/csv' || d.name.toLowerCase().endsWith('.csv'));
                const otherDocs = docs.filter(d => !csvDocs.some(cd => cd.id === d.id));

                try {
                    if (csvDocs.length > 0) {
                        let csvTextToProcess = '';
                        for (const doc of csvDocs) {
                            const response = await gapiClient.drive.files.get({ fileId: doc.id, alt: 'media' });
                            csvTextToProcess += response.body + '\n\n';
                        }
                        setMode('csv');
                        parseAndProcessCSV(csvTextToProcess);
                        if (otherDocs.length > 0) {
                            showToast(`Processed ${csvDocs.length} CSV file(s). Other file types were ignored.`, 'info');
                        }
                    } else if (otherDocs.length > 0) {
                        const aiFilesToProcess: File[] = [];
                        for (const doc of otherDocs) {
                            const response = await gapiClient.drive.files.get({ fileId: doc.id, alt: 'media' });
                            const blob = new Blob([response.body], { type: doc.mimeType });
                            const file = new File([blob], doc.name, { type: doc.mimeType });
                            aiFilesToProcess.push(file);
                        }
                        setMode('ai');
                        setAiFiles(prev => [...prev, ...aiFilesToProcess].slice(0, 50));
                    }
                } catch (error) {
                    console.error("Error downloading from Drive:", error);
                    showToast("Failed to download files from Google Drive.", 'error');
                } finally {
                    setIsProcessing(false);
                }
            }
        };
        showPicker(pickerCallback);
    };

  const parseAndProcessCSV = (csvText: string) => {
    if (!userProfile) {
        showToast(t('report_alert_missingData'), 'error');
        return;
    }
    if (!csvText.trim()) return;
    
    const lines = csvText.trim().replace(/\r\n/g, '\n').split('\n');
    if (lines.length < 2) {
        showToast(t('bulk_alert_csv_parse_error'), 'error');
        return;
    }

    const headerLine = lines[0];
    const commaCount = (headerLine.match(/,/g) || []).length;
    const semicolonCount = (headerLine.match(/;/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    const headers = parseCsvLine(headerLine, delimiter).map(h => h.trim().toLowerCase());
    
    const dateIndex = findHeaderIndex(headers, KNOWN_HEADERS.date);
    const projectIndex = findHeaderIndex(headers, KNOWN_HEADERS.projectName);
    const originIndex = findHeaderIndex(headers, KNOWN_HEADERS.origin);
    const destinationIndex = findHeaderIndex(headers, KNOWN_HEADERS.destination);

    if ([dateIndex, projectIndex, originIndex, destinationIndex].some(i => i === -1)) {
        showToast(`${t('bulk_alert_csv_header_error')}. Required: date, projectName, origin, destination.`, 'error');
        return;
    }

    const reasonIndex = findHeaderIndex(headers, KNOWN_HEADERS.reason);
    const distanceIndex = findHeaderIndex(headers, KNOWN_HEADERS.distance);

    const knownIndices = [dateIndex, projectIndex, reasonIndex, originIndex, destinationIndex, distanceIndex].filter(i => i > -1);
    const stopIndices = headers.map((_, i) => i).filter(i => !knownIndices.includes(i));
    
    let data: (Omit<DraftTrip, 'projectId' | 'specialOrigin'> & { projectName: string })[] = [];
    let errorCount = 0;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const values = parseCsvLine(line, delimiter);
        const dateDisplay = values[dateIndex]?.trim();
        const projectName = values[projectIndex]?.trim();
        const date = formatDateForStorage(dateDisplay);

        if (!date || !projectName) {
            console.warn(`Skipping invalid CSV row ${i + 1} (missing date or project):`, line);
            errorCount++;
            continue;
        }
        
        const warnings: string[] = [];
        if (new Date(date) > new Date()) {
            warnings.push(t('bulk_warning_future_date'));
        }

        let distance = 0;
        if (distanceIndex > -1 && values[distanceIndex]?.trim()) {
            const distVal = robustParseFloat(values[distanceIndex]);
            if (!isNaN(distVal)) {
                distance = distVal;
                if (distVal <= 0) {
                    warnings.push(t('tripEditor_validation_distance_positive'));
                } else if (distVal > 1000) {
                    warnings.push(t('bulk_warning_improbable_distance'));
                }
            }
        }

        const reason = reasonIndex > -1 ? (values[reasonIndex]?.trim() || projectName) : projectName;
        const origin = values[originIndex]?.trim() ?? '';
        const destination = values[destinationIndex]?.trim() ?? '';
        const stops = stopIndices.map(idx => values[idx]?.trim() ?? '').filter(stop => stop);
        let locations = [origin, ...stops, destination];

        data.push({ date, projectName, reason, locations, distance, warnings });
    }
    
    if (errorCount > 0) {
        showToast(t('bulk_alert_csv_row_error', { count: errorCount }), 'warning');
    }
    if (data.length > 0) {
        prepareForReview(data);
    }
  };
  
  const prepareForReview = (data: (Omit<DraftTrip, 'projectId' | 'specialOrigin'> & { projectName: string })[]) => {
    if (!userProfile) return;

    const userHomeAddress = (userProfile.address && userProfile.city && userProfile.country)
      ? `${userProfile.address}, ${userProfile.city}, ${userProfile.country}`
      : null;

    let needsHomeAddress = false;
    
    data.forEach(row => {
        if (!row.locations[0] || (row.locations.length > 1 && !row.locations[row.locations.length - 1])) {
          needsHomeAddress = true;
        }
    });
    
    if (needsHomeAddress && !userHomeAddress) {
        showToast(t('tripEditor_alert_noHomeAddress'), 'error');
        return;
    }

    const existingTripSignatures = new Set(
        trips.map(t => normalizeSignature(t.date, t.locations))
    );
    const newTripSignatures = new Set<string>();
    const newProjectNames = new Set<string>();

    const newDraftTrips = data.map(row => {
        const { date, projectName, reason, locations: rawLocations, distance, warnings = [] } = row;
        
        let locations = [...rawLocations];
        if (userHomeAddress) {
          if (!locations[0]) locations[0] = userHomeAddress;
          if (locations.length > 1 && !locations[locations.length - 1]) {
            locations[locations.length - 1] = userHomeAddress;
          }
        }
        
        const signature = normalizeSignature(date, locations);
        if (existingTripSignatures.has(signature) || newTripSignatures.has(signature)) {
            warnings.push(t('bulk_warning_duplicate'));
        }
        newTripSignatures.add(signature);
        
        const existingProject = projects.find(p => p.name.toLowerCase() === projectName.toLowerCase());
        let projectId = existingProject ? existingProject.id : projectName;

        if (!existingProject && projectName) {
            newProjectNames.add(projectName);
        }

        return {
            date,
            locations: locations.length >= 2 ? locations : [userHomeAddress!, userHomeAddress!],
            reason,
            projectId,
            distance,
            warnings,
            specialOrigin: SpecialOrigin.HOME,
        };
    });
    
    setNewlyCreatedProjectNames(Array.from(newProjectNames));
    setDraftTrips(newDraftTrips);
    setStage('review');
  }

  const handleCsvFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => parseAndProcessCSV(e.target?.result as string);
    reader.onerror = () => showToast(t('bulk_alert_csv_parse_error'), 'error');
    reader.readAsText(file);
    event.target.value = '';
  };
  
  const handleProcessPastedCsv = () => {
    parseAndProcessCSV(csvPastedText);
  };

  const handleUpdateDraft = (index: number, updatedTrip: DraftTrip) => {
    setDraftTrips(prev => prev.map((trip, i) => i === index ? updatedTrip : trip));
  }
  
  const handleRemoveDraft = (index: number) => {
    setDraftTrips(prev => prev.filter((_, i) => i !== index));
  }
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if(e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files);
      setAiFiles(prev => [...prev, ...files].slice(0, 50));
    }
  };


  const tempNewProjectsForReview = newlyCreatedProjectNames.map(name => ({
      id: name,
      name: `${name} (New)`,
      producer: t('bulk_csv_default_producer')
  }));
  const allProjectOptions = [...projects, ...tempNewProjectsForReview];

  const ModeButton: React.FC<{ type: Mode, label: string, icon: React.ReactNode }> = ({ type, label, icon }) => (
    <button
      onClick={() => handleModeChange(type)}
      className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
        mode === type
          ? 'bg-brand-primary/20 text-brand-primary'
          : 'text-on-surface-dark-secondary hover:bg-gray-700/50'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  const mapsLoading = !!userProfile?.googleMapsApiKey && !isMapsScriptLoaded;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/60 backdrop-blur-sm">
      <div className="bg-background-dark/95 border border-gray-700/60 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
        <header className="px-6 py-4 border-b border-gray-700/70 flex items-center justify-between gap-4 bg-background-dark/70 backdrop-blur-sm">
          <h2 className="text-lg font-semibold tracking-tight text-white">{t('bulk_title')}</h2>
          <div className="flex items-center gap-2 bg-background-dark/60 p-1 rounded-md border border-gray-700/60">
              <ModeButton type="csv" label={t('bulk_mode_csv')} icon={<FileCsvIcon className="w-4 h-4" />} />
              <ModeButton type="ai" label="AI Extraction" icon={<SparklesIcon className="w-4 h-4" />} />
          </div>
          <button onClick={onClose} className="text-on-surface-dark-secondary hover:text-white p-2 rounded-md hover:bg-gray-700/40 focus:outline-none focus:ring-2 focus:ring-brand-primary/60"><XIcon className="w-5 h-5" /></button>
        </header>

        {stage === 'upload' ? (
          <main className="px-6 py-6 overflow-y-auto space-y-6">
              {mode === 'csv' && (
                <div className="space-y-6">
                  <div className="bg-background-dark/60 p-4 rounded-md border border-gray-700/60">
                    <h3 className="font-semibold text-sm uppercase tracking-wide mb-3 text-white/90">{t('bulk_csv_instructions_title')}</h3>
                    <ul className="space-y-2 list-disc list-inside text-xs text-on-surface-dark-secondary leading-relaxed">
                        <li>{t('bulk_csv_instructions_p1')}</li>
                        <li>{t('bulk_csv_instructions_p2')}</li>
                        <li>{t('bulk_csv_instructions_p3')}</li>
                    </ul>
                  </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <input type="file" accept=".csv,text/csv" onChange={handleCsvFileSelected} id="csv-upload" className="hidden" />
           <label htmlFor="csv-upload" className="bg-brand-primary hover:brightness-110 text-white font-medium text-sm py-2.5 px-4 rounded-md cursor-pointer inline-flex items-center justify-center gap-2 transition-colors shadow-sm">
                        <UploadCloudIcon className="w-5 h-5"/> {t('bulk_csv_upload_selectBtn')}
                     </label>
           <button onClick={handleDriveImport} disabled={isProcessing} className="bg-white hover:bg-gray-200 text-gray-800 font-medium text-sm py-2.5 px-4 rounded-md cursor-pointer inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-sm">
                         {isProcessing ? <LoaderIcon className="w-5 h-5 animate-spin"/> : <DriveIcon className="w-5 h-5 text-[#0F9D58]" />} {t('bulk_drive_upload_selectBtn')}
                     </button>
                  </div>
                  <div className="flex items-center">
                      <hr className="flex-grow border-gray-600" />
                      <span className="mx-4 text-on-surface-dark-secondary">{t('bulk_upload_or')}</span>
                      <hr className="flex-grow border-gray-600" />
                  </div>
                  <div>
            <label htmlFor="csv-paste-area" className="block text-xs font-medium uppercase tracking-wide text-on-surface-dark-secondary mb-2">{t('bulk_csv_paste_label')}</label>
            <textarea id="csv-paste-area" rows={8} className="w-full bg-background-dark border border-gray-600/70 rounded-md p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary resize-y min-h-[140px]" placeholder={t('bulk_csv_paste_placeholder')} value={csvPastedText} onChange={(e) => setCsvPastedText(e.target.value)} />
            <button onClick={handleProcessPastedCsv} disabled={!csvPastedText.trim()} className="mt-2 w-full bg-brand-secondary hover:brightness-110 text-white font-medium text-sm py-2.5 px-4 rounded-md disabled:opacity-50 transition-colors shadow-sm">
                          {t('bulk_csv_processPastedBtn')}
                      </button>
                  </div>
                </div>
              )}
              {mode === 'ai' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wide text-on-surface-dark-secondary mb-2">{t('bulk_document_type_label')}</label>
                    <div className="flex gap-1 rounded-md bg-background-dark/60 p-1 border border-gray-700/60">
                      <button 
                          onClick={() => setDocumentType(DocumentType.CALLSHEET)}
                          className={`w-full text-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                              documentType === DocumentType.CALLSHEET
                              ? 'bg-brand-primary text-white'
                              : 'text-on-surface-dark-secondary hover:bg-gray-700/50'
                          }`}
                      >
                          {t('bulk_document_type_callsheet')}
                      </button>
                      <button 
                          onClick={() => setDocumentType(DocumentType.EMAIL)}
                          className={`w-full text-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                              documentType === DocumentType.EMAIL
                              ? 'bg-brand-primary text-white'
                              : 'text-on-surface-dark-secondary hover:bg-gray-700/50'
                          }`}
                      >
                          {t('bulk_document_type_email')}
                      </button>
                    </div>
                  </div>
                  <div onDragOver={handleDragOver} onDrop={handleDrop} className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-brand-primary transition-colors" onClick={() => document.getElementById('ai-upload')?.click()}>
                      <UploadCloudIcon className="w-12 h-12 mx-auto text-gray-500 mb-2"/>
                      <h3 className="font-semibold text-lg text-white">Drag & drop your documents</h3>
                      <p className="text-on-surface-dark-secondary text-sm">or click to select files (Image, PDF, EML, TXT)</p>
                      <input type="file" multiple accept="image/*,application/pdf,.txt,.eml,message/rfc822" onChange={handleAiFileSelected} id="ai-upload" className="hidden" />
                  </div>
                   <button onClick={handleDriveImport} disabled={isProcessing} className="w-full bg-white hover:bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg cursor-pointer inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                        {isProcessing ? <LoaderIcon className="w-5 h-5 animate-spin"/> : <DriveIcon className="w-5 h-5 text-[#0F9D58]" />} {t('bulk_drive_upload_selectBtn')}
                  </button>
                  {aiFiles.length > 0 && (
                    <div className="max-h-60 overflow-y-auto space-y-2 bg-background-dark p-2 rounded-md">
                      {aiFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-surface-dark p-2 rounded">
                           <div className="flex items-center gap-2 truncate">
                             <FileTextIcon className="w-5 h-5 text-gray-400"/>
                             <span className="text-sm truncate">{file.name}</span>
                           </div>
                           <button onClick={() => setAiFiles(prev => prev.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-400"><TrashIcon className="w-4 h-4"/></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
          </main>
        ) : ( // Review Stage
          <main className="px-6 py-6 overflow-y-auto">
              <h3 className="font-semibold text-lg mb-4">{t('bulk_review_title', { count: draftTrips.length })}</h3>
              <div className="space-y-4">
              {draftTrips.map((draft, index) => (
                  <div key={index} className="bg-background-dark p-4 rounded-lg grid grid-cols-12 gap-4 relative items-center">
                      {draft.warnings && draft.warnings.length > 0 && (
                        <div className="absolute -left-3 top-1/2 -translate-y-1/2" title={draft.warnings.join('\n')}>
                            <WarningIcon className="w-6 h-6 text-yellow-400" />
                        </div>
                      )}
                      <button onClick={() => handleRemoveDraft(index)} className="absolute top-2 right-2 text-red-400 hover:text-red-300"><TrashIcon className="w-4 h-4" /></button>
                      <input type="date" value={draft.date} onChange={e => handleUpdateDraft(index, {...draft, date: e.target.value})} className="bg-surface-dark p-2 rounded col-span-2"/>
                      <div className="bg-surface-dark p-2 rounded col-span-5 truncate" title={draft.locations.join(' → ')}>
                         {draft.locations.join(' → ')}
                      </div>
                      <select value={draft.projectId} onChange={e => handleUpdateDraft(index, {...draft, projectId: e.target.value})} className="bg-surface-dark p-2 rounded col-span-3">
                           <option value="" disabled>{t('bulk_review_projectPlaceholder')}</option>
                           {allProjectOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <input type="number" min="0.01" step="0.1" value={draft.distance} placeholder={t('bulk_review_distancePlaceholder')} onChange={e => handleUpdateDraft(index, {...draft, distance: parseFloat(e.target.value) || 0})} className="bg-surface-dark p-2 rounded col-span-2"/>
                  </div>
              ))}
              </div>
          </main>
        )}

  <footer className="px-6 py-4 border-t border-gray-700/70 bg-background-dark/70 backdrop-blur-sm flex justify-end gap-3">
          {stage === 'upload' ? (
              <>
                  <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/60 mr-3">{t('common_cancel')}</button>
                 {mode === 'ai' && (
                    <button onClick={handleProcessAi} disabled={isProcessing || aiFiles.length === 0 || mapsLoading} className="flex items-center justify-center bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50 w-48">
                        {isProcessing ? (
                            <><LoaderIcon className="w-5 h-5 mr-2 animate-spin"/> Processing...</>
                        ) : mapsLoading ? (
                            <><LoaderIcon className="w-5 h-5 mr-2 animate-spin"/> Loading Maps...</>
                        ) : (
                            <><SparklesIcon className="w-5 h-5 mr-2" /> {`Process ${aiFiles.length} files`}</>
                        )}
                    </button>
                 )}
              </>
          ) : ( // Review Stage
               <>
                  <button onClick={() => setStage('upload')} className="bg-gray-700 hover:bg-gray-600 text-white font-medium text-sm py-2.5 px-4 rounded-md mr-3 transition-colors">{t('common_back')}</button>
                  <button onClick={() => onSave(draftTrips)} className="flex items-center justify-center bg-brand-primary hover:brightness-110 text-white font-medium text-sm py-2.5 px-6 rounded-md transition-colors">
                    <CheckIcon className="w-5 h-5 mr-2" /> {t('bulk_review_saveBtn', { count: draftTrips.length })}
                 </button>
               </>
          )}
        </footer>
      </div>
    </div>
  );
};

export default BulkUploadModal;