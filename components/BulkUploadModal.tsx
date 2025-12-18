import React, { useState, useMemo } from 'react';
import { Trip, Project, SpecialOrigin, UserProfile, DocumentType, PersonalizationSettings } from '../types';
import useTrips from '../hooks/useTrips';
import { XIcon, TrashIcon, UploadCloudIcon, CheckIcon, WarningIcon, FileCsvIcon, SparklesIcon, LoaderIcon, FileTextIcon, DriveIcon, EyeIcon } from './Icons';
import { Button } from './Button';
import useTranslation from '../hooks/useTranslation';
import { formatDateForStorage } from '../i18n/translations';
import useToast from '../hooks/useToast';
import useUserProfile from '../hooks/useUserProfile';
import { normalizeSignature } from '../services/tripUtils';
import { processFileForTrip, processFileForTripUniversal } from '../services/aiService';
import useGoogleMapsScript from '../hooks/useGoogleMapsScript';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../hooks/useAuth';
import databaseService from '../services/databaseService';
import useGoogleCalendar from '../hooks/useGoogleCalendar';

interface BulkUploadModalProps {
  projects: Project[];
  onSave: (trips: Omit<Trip, 'id'>[], source: Mode) => void;
  onClose: () => void;
  personalization?: PersonalizationSettings;
  theme?: 'light' | 'dark';
}

type Mode = 'csv' | 'ai';
type Stage = 'upload' | 'review';
type DraftTrip = Omit<Trip, 'id'> & { warnings?: string[]; sourceFile?: File };

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





const BulkUploadModal: React.FC<BulkUploadModalProps> = ({ projects, onSave, onClose, personalization, theme }) => {
  const [mode, setMode] = useState<Mode>('csv');
  const [stage, setStage] = useState<Stage>('upload');
  const [draftTrips, setDraftTrips] = useState<DraftTrip[]>([]);
  const { userProfile } = useUserProfile();
  const { trips, getAiQuota } = useTrips();
  const [newlyCreatedProjects, setNewlyCreatedProjects] = useState<Map<string, string>>(new Map());

  const [csvPastedText, setCsvPastedText] = useState('');

  const [aiFiles, setAiFiles] = useState<File[]>([]);
  const [aiText, setAiText] = useState<string>("");
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isDriveProcessing, setIsDriveProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isBusy = isAiProcessing || isDriveProcessing || isSaving;

  const [aiExtractMode, setAiExtractMode] = useState<'direct' | 'agent' | 'vision'>('vision');
  const [documentType, setDocumentType] = useState<DocumentType>(DocumentType.CALLSHEET);

  const { t } = useTranslation();
  const { showToast } = useToast();
  const { isLoaded: isMapsScriptLoaded, error: mapsScriptError } = useGoogleMapsScript();
  const { showPicker, gapiClient, isSignedIn, signIn } = useGoogleCalendar();
  const { projects: projectsCtx, fetchProjects, addCallsheetsToProject } = useProjects();
  const { user } = useAuth();

  const findHeaderIndex = (headers: string[], validNames: string[]): number => {
    return headers.findIndex(h => validNames.includes(h.trim().toLowerCase()));
  };

  const resetState = () => {
    setStage('upload');
    setDraftTrips([]);
    setNewlyCreatedProjects(new Map());
    setCsvPastedText('');
    setAiFiles([]);
    setIsAiProcessing(false);
    setIsDriveProcessing(false);
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

    setIsAiProcessing(true);

    try {
      const hasTextOnly = aiFiles.length === 0 && aiText.trim().length > 0;
      const itemsToProcess = hasTextOnly ? 1 : aiFiles.length;

      console.log(`[BulkUpload] Starting AI extraction for ${itemsToProcess} item(s) in ${aiExtractMode} mode`);

      // VERIFICAR CUOTA ANTES DE PROCESAR
      const currentQuota = await getAiQuota();

      // Si el plan tiene límite y ya no tiene extracciones restantes, no procesar
      if (currentQuota.limit !== null && currentQuota.remaining !== null && currentQuota.remaining === 0) {
        const errorMsg = `Has alcanzado el límite de tu plan (${currentQuota.used}/${currentQuota.limit} extracciones usadas). No se puede procesar con IA. Actualiza tu plan o usa importación CSV.`;
        showToast(errorMsg, 'error');
        setIsAiProcessing(false);
        return;
      }

      console.log(`[BulkUpload] Quota check passed: ${currentQuota.remaining} days remaining`);

      const attemptProcess = async (params: { file?: File; text?: string }, name: string) => {
        try {
          const primary = await processFileForTripUniversal(params, userProfile, documentType, aiExtractMode);
          console.log(`[BulkUpload] Processed (${aiExtractMode}) ${name}:`, primary);
          return { status: 'fulfilled' as const, value: primary };
        } catch (reason: any) {
          const code = reason?.code || (reason instanceof Error ? reason.message : String(reason));
          // Auto-fallback to Agent (OCR) when direct path reports missing text layer or Vision fails
          const needsOcr = String(code).toLowerCase().includes('requires_ocr') || String(code).toLowerCase().includes('no text layer');

          // Enhanced Fallback Logic:
          // 1. If Direct mode fails due to no text layer -> fallback to Agent
          // 2. If Vision mode fails (any reason) -> fallback to Agent (as requested: "vuelve a tirar con el OCR")
          if ((aiExtractMode === 'direct' && needsOcr) || (aiExtractMode === 'vision')) {
            try {
              console.log(`[BulkUpload] Fallback triggering for ${name}. Original mode: ${aiExtractMode}, specific error: ${code}`);
              const secondary = await processFileForTripUniversal(params, userProfile, documentType, 'agent');
              console.log(`[BulkUpload] Fallback to Agent (OCR) succeeded for ${name}:`, secondary);
              return { status: 'fulfilled' as const, value: secondary };
            } catch (fallbackReason) {
              console.error(`[BulkUpload] Fallback to Agent (OCR) failed for ${name}:`, fallbackReason);
              return { status: 'rejected' as const, reason: fallbackReason, fileName: name };
            }
          }
          console.error(`[BulkUpload] Failed to process ${name}:`, reason);
          return { status: 'rejected' as const, reason, fileName: name };
        }
      };

      const results = hasTextOnly
        ? await Promise.all([attemptProcess({ text: aiText }, 'pasted-text')])
        : await Promise.all(aiFiles.map((file, idx) => attemptProcess({ file }, `${idx + 1}/${aiFiles.length}: ${file.name}`)));

      const successfulExtractions: { tripData: Omit<Trip, 'id' | 'projectId'>; projectName: string, productionCompany: string }[] = [];
      const successfulFiles: (File | undefined)[] = [];
      const errors: { fileName: string; error: string }[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulExtractions.push(result.value);
          const sourceFile = hasTextOnly ? undefined : aiFiles[index];
          successfulFiles.push(sourceFile);
        } else {
          const errorMsg = result.reason?.code === 'requires_ocr'
            ? t('bulk_alert_requires_ocr')
            : result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
          errors.push({ fileName: result.fileName || 'unknown', error: errorMsg });
        }
      });

      console.log(`[BulkUpload] Extraction complete: ${successfulExtractions.length} successful, ${errors.length} failed`);

      if (errors.length > 0) {
        const errorDetails = errors.map(e => `${e.fileName}: ${e.error}`).join('\n');
        showToast(`Failed to process ${errors.length} file(s):\n${errorDetails}`, 'error');
      }

      if (successfulExtractions.length > 0) {
        const reviewData = successfulExtractions.map((res, idx) => ({
          ...res.tripData,
          projectName: res.projectName,
          productionCompany: res.productionCompany,
          warnings: [],
          sourceFile: successfulFiles[idx],
        }));
        prepareForReview(reviewData);
        showToast(`Successfully extracted ${successfulExtractions.length} trip(s)`, 'success');
      } else if (errors.length > 0) {
        showToast('No files were successfully processed. Please check the errors above.', 'error');
      }
    } catch (error) {
      console.error('[BulkUpload] Unexpected error during AI processing:', error);
      showToast(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setIsAiProcessing(false);
    }
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
        setIsDriveProcessing(true);

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
          setIsDriveProcessing(false);
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

      const reason = reasonIndex > -1 ? (values[reasonIndex]?.trim() || 'Trabajo') : 'Trabajo';
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

  const prepareForReview = (data: (Omit<DraftTrip, 'projectId' | 'specialOrigin'> & { projectName: string, productionCompany?: string })[]) => {
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
    const newProjects = new Map<string, string>();

    const newDraftTrips = data.map(row => {
      const { date, projectName, reason, locations: rawLocations, distance, warnings = [], productionCompany, sourceFile } = row;

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
        newProjects.set(projectName, productionCompany || '');
      }

      return {
        date,
        locations: locations.length >= 2 ? locations : [userHomeAddress!, userHomeAddress!],
        reason,
        projectId,
        distance,
        warnings,
        specialOrigin: SpecialOrigin.HOME,
        sourceFile,
      };
    });

    setNewlyCreatedProjects(newProjects);
    setDraftTrips(newDraftTrips);
    setStage('review');
  }

  const handleConfirmSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      // Build mapping from project name (normalized) to ID
      const normalizeName = (s: string) => (s || '').trim().toLowerCase();
      const nameToId = new Map<string, string>();

      console.log('[BulkUpload] Starting handleConfirmSave');
      console.log('[BulkUpload] Existing projects from props:', projects);
      console.log('[BulkUpload] Existing projects from context:', projectsCtx);
      console.log('[BulkUpload] New projects to create:', Array.from(newlyCreatedProjects.entries()));
      console.log('[BulkUpload] Draft trips before mapping:', draftTrips);

      // Include existing projects from props and context
      (projects || []).forEach(p => {
        const key = normalizeName(p.name);
        nameToId.set(key, p.id);
      });
      (projectsCtx || []).forEach(p => {
        const key = normalizeName(p.name);
        if (!nameToId.has(key)) {
          nameToId.set(key, p.id);
        }
      });

      // Create missing projects directly via DB to obtain IDs immediately
      if (!user?.id) {
        showToast('User not authenticated', 'error');
        return;
      }

      for (const [rawName, producer] of newlyCreatedProjects.entries()) {
        const name = (rawName || '').trim();
        const key = normalizeName(name);
        if (!key) {
          console.warn(`[BulkUpload] Skipping empty project name`);
          continue;
        }
        if (!nameToId.has(key)) {
          try {
            console.log(`[BulkUpload] Creating project in DB: "${name}" with producer: "${producer}"`);
            const inserted = await databaseService.createProject(user.id, { name, producer });
            console.log(`[BulkUpload] Project created successfully:`, inserted);
            // Update local map with newly created project ID
            nameToId.set(key, inserted.id);
          } catch (e) {
            console.error('[BulkUpload] Failed to create project', name, e);
            showToast(`Failed to create project "${name}"`, 'error');
          }
        }
      }

      console.log('[BulkUpload] Final nameToId mapping:', Array.from(nameToId.entries()));

      // Helper to check if string is a valid UUID
      const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      // Map placeholder projectId (name) to real IDs
      const updatedDrafts = draftTrips.map((trip, index) => {
        const mapped = { ...trip };
        const originalProjectId = mapped.projectId;

        // If projectId is already a valid UUID, no need to map it
        if (isUUID(originalProjectId)) {
          console.log(`[BulkUpload] Trip ${index}: Already has UUID "${originalProjectId}", skipping mapping`);
          return mapped;
        }

        const key = normalizeName(mapped.projectId);

        if (key && nameToId.has(key)) {
          const realId = nameToId.get(key)!;
          mapped.projectId = realId;
          console.log(`[BulkUpload] Trip ${index}: Mapped "${originalProjectId}" -> "${realId}"`);
        } else {
          console.warn(`[BulkUpload] Trip ${index}: Could not find mapping for "${originalProjectId}" (key: "${key}")`);
          console.warn(`[BulkUpload] Available keys in nameToId:`, Array.from(nameToId.keys()));
        }
        return mapped;
      });

      console.log('[BulkUpload] Updated drafts after mapping:', updatedDrafts);

      // Upload source documents to project (callsheets) when available
      // and associate them with the corresponding trips
      const filesByProject: Record<string, { file: File, tripIndex: number }[]> = {};
      updatedDrafts.forEach((trip, index) => {
        if (trip.projectId && trip.sourceFile) {
          if (!filesByProject[trip.projectId]) filesByProject[trip.projectId] = [];
          filesByProject[trip.projectId].push({ file: trip.sourceFile, tripIndex: index });
        }
      });

      // Map to store callsheet info by trip index
      const tripCallsheetMap = new Map<number, { id: string, name: string, url: string }>();

      for (const [projectId, fileData] of Object.entries(filesByProject)) {
        try {
          const files = fileData.map(fd => fd.file);
          const uploadedCallsheets = await addCallsheetsToProject(projectId, files);
          console.log(`[BulkUpload] Uploaded ${uploadedCallsheets.length} file(s) to project ${projectId}:`, uploadedCallsheets);

          // Associate uploaded callsheets with their corresponding trips
          fileData.forEach((fd, index) => {
            const callsheet = uploadedCallsheets[index];
            if (callsheet && callsheet.url) {
              tripCallsheetMap.set(fd.tripIndex, {
                id: callsheet.id,
                name: callsheet.name,
                url: callsheet.url
              });
              console.log(`[BulkUpload] Mapped callsheet to trip ${fd.tripIndex}:`, {
                id: callsheet.id,
                name: callsheet.name,
                url: callsheet.url
              });
            }
          });
        } catch (e: any) {
          console.error(`[BulkUpload] Failed to upload documents for project ${projectId}:`, e);
          const msg = e?.message || 'Error desconocido';
          showToast(`Error adjuntando documentos: ${msg}`, 'error');
        }
      }

      // Remove transient sourceFile and add callsheet info to trips
      const sanitizedDrafts = updatedDrafts.map(({ sourceFile, ...rest }, index) => {
        const callsheetInfo = tripCallsheetMap.get(index);
        if (callsheetInfo) {
          return {
            ...rest,
            sourceDocumentId: callsheetInfo.id,
            sourceDocumentName: callsheetInfo.name,
            sourceDocumentUrl: callsheetInfo.url
          };
        }
        return rest;
      });

      console.log('[BulkUpload] Calling onSave with mode:', mode);
      console.log('[BulkUpload] Number of trips to save:', sanitizedDrafts.length);
      console.log('[BulkUpload] Trip dates:', sanitizedDrafts.map(t => t.date));

      await onSave(sanitizedDrafts, mode);

      // Refresh projects to show uploaded callsheets in project list
      try {
        await fetchProjects();
        console.log('[BulkUpload] Projects refreshed after saving trips and callsheets');
      } catch (e) {
        console.warn('[BulkUpload] Failed to refresh projects:', e);
      }
    } catch (error) {
      console.error('[BulkUpload] handleConfirmSave error:', error);
      showToast('Error saving trips', 'error');
    } finally {
      setIsSaving(false);
    }
  };

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
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files);
      setAiFiles(prev => [...prev, ...files].slice(0, 50));
    }
  };


  const tempNewProjectsForReview = Array.from(newlyCreatedProjects.entries()).map(([name, producer]) => ({
    id: name,
    name: `${name} (New)`,
    producer: producer || t('bulk_csv_default_producer')
  }));
  const allProjectOptions = [...projects, ...tempNewProjectsForReview];

  const ModeButton: React.FC<{ type: Mode, label: string, icon: React.ReactNode }> = ({ type, label, icon }) => (
    <Button
      type="button"
      variant={mode === type ? 'primary' : 'ghost'}
      onClick={() => handleModeChange(type)}
      className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === type
        ? 'bg-brand-primary/20 text-brand-primary'
        : 'text-on-surface-dark-secondary hover:bg-gray-700/50'
        }`}
    >
      {icon}
      {label}
    </Button>
  );

  const mapsLoading = !isMapsScriptLoaded && !mapsScriptError;

  // Dynamic modal style based on personalization
  const modalStyle = personalization ? {
    backgroundColor: `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`,
    backdropFilter: `blur(${personalization.uiBlur}px)`,
    WebkitBackdropFilter: `blur(${personalization.uiBlur}px)`,
  } : {};

  return (
    <div id="bulk-modal" className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div style={modalStyle} className="bg-frost-glass border border-gray-700/60 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-gray-700/70 flex items-center justify-between gap-4 bg-background-dark/70 backdrop-blur-sm">
          <h2 id="bulk-modal-title" className="text-lg font-semibold tracking-tight text-white">{t('bulk_title')}</h2>
          <div id="bulk-mode-toggle" className="flex items-center gap-2 bg-background-dark/60 p-1 rounded-md border border-gray-700/60">
            <ModeButton type="csv" label={t('bulk_mode_csv')} icon={<FileCsvIcon className="w-4 h-4" />} />
            <ModeButton type="ai" label="AI Extraction" icon={<SparklesIcon className="w-4 h-4" />} />
          </div>
          <Button id="bulk-modal-close" variant="icon" onClick={onClose} className="text-on-surface-dark-secondary hover:text-white">
            <XIcon className="w-5 h-5" />
          </Button>
        </header>

        {stage === 'upload' ? (
          <main className="px-6 py-6 overflow-y-auto space-y-6">
            {mode === 'csv' && (
              <div className="space-y-6" id="bulk-csv-section">
                <div className="bg-background-dark/60 p-4 rounded-md border border-gray-700/60">
                  <h3 id="bulk-csv-instructions" className="font-semibold text-sm uppercase tracking-wide mb-3 text-white/90">{t('bulk_csv_instructions_title')}</h3>
                  <ul className="space-y-2 list-disc list-inside text-xs text-on-surface-dark-secondary leading-relaxed">
                    <li>{t('bulk_csv_instructions_p1')}</li>
                    <li>{t('bulk_csv_instructions_p2')}</li>
                    <li>{t('bulk_csv_instructions_p3')}</li>
                  </ul>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label id="bulk-csv-file" htmlFor="csv-upload" className="bg-brand-primary hover:brightness-110 text-white font-medium text-sm py-2.5 px-4 rounded-md cursor-pointer inline-flex items-center justify-center gap-2 transition-colors shadow-sm">
                    <UploadCloudIcon className="w-5 h-5" /> {t('bulk_csv_upload_selectBtn')}
                    <input type="file" accept=".csv,text/csv" onChange={handleCsvFileSelected} id="csv-upload" className="hidden" />
                  </label>
                  <Button id="bulk-drive-btn" onClick={handleDriveImport} disabled={isBusy} variant="secondary" className="inline-flex items-center justify-center gap-2">
                    {isDriveProcessing ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <DriveIcon className="w-5 h-5 text-[#0F9D58]" />} {t('bulk_drive_upload_selectBtn')}
                  </Button>
                </div>
                <div className="flex items-center">
                  <hr className="flex-grow border-gray-600" />
                  <span className="mx-4 text-on-surface-dark-secondary">{t('bulk_upload_or')}</span>
                  <hr className="flex-grow border-gray-600" />
                </div>
                <div id="bulk-csv-paste">
                  <label htmlFor="csv-paste-area" className="block text-xs font-medium uppercase tracking-wide text-on-surface-dark-secondary mb-2">{t('bulk_csv_paste_label')}</label>
                  <textarea id="csv-paste-area" rows={8} className="w-full bg-background-dark border border-gray-600/70 rounded-md p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary resize-y min-h-[140px]" placeholder={t('bulk_csv_paste_placeholder')} value={csvPastedText} onChange={(e) => setCsvPastedText(e.target.value)} />
                  <Button id="bulk-csv-process" onClick={handleProcessPastedCsv} disabled={!csvPastedText.trim()} variant="secondary" className="mt-2 w-full">
                    {t('bulk_csv_processPastedBtn')}
                  </Button>
                </div>
              </div>
            )}
            {mode === 'ai' && (
              <div className="space-y-4" id="bulk-ai-section">
                <div id="bulk-ai-doc-type">
                  <label className="block text-xs font-medium uppercase tracking-wide text-on-surface-dark-secondary mb-2">{t('bulk_document_type_label')}</label>
                  <div className="flex gap-1 rounded-md bg-background-dark/60 p-1 border border-gray-700/60">
                    <Button
                      type="button"
                      variant={documentType === DocumentType.CALLSHEET ? 'primary' : 'ghost'}
                      onClick={() => setDocumentType(DocumentType.CALLSHEET)}
                      className={`w-full text-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${documentType === DocumentType.CALLSHEET
                        ? 'bg-brand-primary text-white'
                        : 'text-on-surface-dark-secondary hover:bg-gray-700/50'
                        }`}
                    >
                      {t('bulk_document_type_callsheet')}
                    </Button>
                    <Button
                      type="button"
                      variant={documentType === DocumentType.EMAIL ? 'primary' : 'ghost'}
                      onClick={() => setDocumentType(DocumentType.EMAIL)}
                      className={`w-full text-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${documentType === DocumentType.EMAIL
                        ? 'bg-brand-primary text-white'
                        : 'text-on-surface-dark-secondary hover:bg-gray-700/50'
                        }`}
                    >
                      {t('bulk_document_type_email')}
                    </Button>
                  </div>
                </div>
                <div id="bulk-ai-mode">
                  <label className="block text-xs font-medium uppercase tracking-wide text-on-surface-dark-secondary mb-2">{t('bulk_extraction_mode_label')}</label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={aiExtractMode === 'direct' ? 'primary' : 'secondary'}
                      aria-pressed={aiExtractMode === 'direct'}
                      onClick={() => setAiExtractMode('direct')}
                      className="flex-1 flex items-center justify-between gap-2"
                      title={t('bulk_extraction_mode_direct_description')}
                    >
                      <span className="text-xs font-medium">{t('bulk_extraction_mode_direct')}</span>
                      {aiExtractMode === 'direct' ? (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white">
                          <CheckIcon className="w-3 h-3 text-brand-primary" />
                        </span>
                      ) : (
                        <span className="inline-block w-4 h-4 rounded-full border border-gray-400" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant={aiExtractMode === 'agent' ? 'primary' : 'secondary'}
                      aria-pressed={aiExtractMode === 'agent'}
                      onClick={() => setAiExtractMode('agent')}
                      className="flex-1 flex items-center justify-between gap-2"
                      title={t('bulk_extraction_mode_agent_description')}
                    >
                      <span className="text-xs font-medium">{t('bulk_extraction_mode_agent')}</span>
                      {aiExtractMode === 'agent' ? (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white">
                          <CheckIcon className="w-3 h-3 text-brand-primary" />
                        </span>
                      ) : (
                        <span className="inline-block w-4 h-4 rounded-full border border-gray-400" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant={aiExtractMode === 'vision' ? 'primary' : 'secondary'}
                      aria-pressed={aiExtractMode === 'vision'}
                      onClick={() => setAiExtractMode('vision')}
                      className="flex-1 flex items-center justify-between gap-2"
                      title="New Multimodal Vision (Best for scanned PDFs)"
                    >
                      <span className="text-xs font-medium">Vision (Beta)</span>
                      {aiExtractMode === 'vision' ? (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white">
                          <CheckIcon className="w-3 h-3 text-brand-primary" />
                        </span>
                      ) : (
                        <span className="inline-block w-4 h-4 rounded-full border border-gray-400" />
                      )}
                    </Button>
                  </div>
                  <p className="mt-1 text-[10px] text-on-surface-dark-secondary">{t('bulk_extraction_mode_selected', { mode: aiExtractMode === 'vision' ? 'Vision' : (aiExtractMode === 'direct' ? t('bulk_extraction_mode_direct') : t('bulk_extraction_mode_agent')) })}</p>
                </div>
                {documentType === DocumentType.EMAIL && (
                  <div id="bulk-ai-paste">
                    <label className="block text-xs font-medium uppercase tracking-wide text-on-surface-dark-secondary mb-2">{t('bulk_ai_paste_label')}</label>
                    <textarea
                      id="bulk-ai-textarea"
                      rows={8}
                      className="w-full bg-background-dark border border-gray-600/70 rounded-md p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary resize-y min-h-[140px]"
                      placeholder={t('bulk_ai_paste_placeholder')}
                      value={aiText}
                      onChange={(e) => setAiText(e.target.value)}
                    />
                  </div>
                )}
                <div id="bulk-ai-drop" onDragOver={handleDragOver} onDrop={handleDrop} className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-brand-primary transition-colors" onClick={() => document.getElementById('ai-upload')?.click()}>
                  <UploadCloudIcon className="w-12 h-12 mx-auto text-gray-500 mb-2" />
                  <h3 className="font-semibold text-lg text-white">{t('bulk_ai_drag_drop_title')}</h3>
                  <p className="text-on-surface-dark-secondary text-sm">{t('bulk_ai_drag_drop_subtitle')}</p>
                  <input type="file" multiple accept="image/*,application/pdf,.txt,.eml,message/rfc822" onChange={handleAiFileSelected} id="ai-upload" className="hidden" />
                </div>
                <Button id="bulk-ai-drive-secondary" onClick={handleDriveImport} disabled={isBusy} variant="secondary" className="w-full inline-flex items-center justify-center gap-2">
                  {isDriveProcessing ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <DriveIcon className="w-5 h-5 text-[#0F9D58]" />} {t('bulk_drive_upload_selectBtn')}
                </Button>
                {aiFiles.length > 0 && (
                  <div className="max-h-60 overflow-y-auto space-y-2 bg-background-dark p-2 rounded-md">
                    {aiFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-surface-dark p-2 rounded">
                        <div className="flex items-center gap-2 truncate">
                          <FileTextIcon className="w-5 h-5 text-gray-400" />
                          <span className="text-sm truncate">{file.name}</span>
                        </div>
                        <Button variant="icon" size="sm" onClick={() => setAiFiles(prev => prev.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-400"><TrashIcon className="w-4 h-4" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </main>
        ) : ( // Review Stage
          <main id="bulk-review-stage" className="px-6 py-6 overflow-y-auto">
            <h3 id="bulk-review-title" className="font-semibold text-lg mb-4">{t('bulk_review_title', { count: draftTrips.length })}</h3>
            <div className="space-y-4">
              {draftTrips.map((draft, index) => (
                <div key={index} id={index === 0 ? 'bulk-review-row' : undefined} className="bg-background-dark p-4 rounded-lg grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-4 relative items-center">
                  {draft.warnings && draft.warnings.length > 0 && (
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2" title={draft.warnings.join('\n')}>
                      <WarningIcon className="w-6 h-6 text-yellow-400" />
                    </div>
                  )}
                  <Button variant="icon" size="sm" onClick={() => handleRemoveDraft(index)} className="absolute top-2 right-2 text-red-400 hover:text-red-300"><TrashIcon className="w-4 h-4" /></Button>
                  <input type="date" value={draft.date} onChange={e => handleUpdateDraft(index, { ...draft, date: e.target.value })} className="bg-surface-dark p-2 rounded md:col-span-2" />
                  <div className="bg-surface-dark p-2 rounded md:col-span-5 truncate" title={draft.locations.join(' → ')}>
                    {draft.locations.join(' → ')}
                  </div>
                  <select id={index === 0 ? 'bulk-review-project' : undefined} value={draft.projectId} onChange={e => handleUpdateDraft(index, { ...draft, projectId: e.target.value })} className="bg-surface-dark p-2 rounded md:col-span-3">
                    <option value="" disabled>{t('bulk_review_projectPlaceholder')}</option>
                    {allProjectOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input id={index === 0 ? 'bulk-review-distance' : undefined} type="number" min="0.01" step="0.1" value={draft.distance} placeholder={t('bulk_review_distancePlaceholder')} onChange={e => handleUpdateDraft(index, { ...draft, distance: parseFloat(e.target.value) || 0 })} className="bg-surface-dark p-2 rounded md:col-span-2" />
                </div>
              ))}
            </div>
          </main>
        )}

        <footer id="bulk-footer" className="px-6 py-4 border-t border-gray-700/70 bg-background-dark/70 backdrop-blur-sm flex justify-end gap-3">
          {stage === 'upload' ? (
            <>
              <Button id="bulk-cancel" onClick={onClose} variant="secondary" className="mr-3">{t('common_cancel')}</Button>
              {mode === 'ai' && (
                <Button id="bulk-ai-process" onClick={handleProcessAi} disabled={isBusy || (aiFiles.length === 0 && aiText.trim().length === 0)} variant="primary" className="flex items-center justify-center w-auto min-w-60">
                  {isAiProcessing ? (
                    <><LoaderIcon className="w-5 h-5 mr-2 animate-spin" /> {t('bulk_ai_processing', { mode: aiExtractMode === 'vision' ? 'Vision' : (aiExtractMode === 'direct' ? t('bulk_extraction_mode_direct') : t('bulk_extraction_mode_agent')) })}</>
                  ) : mapsLoading ? (
                    <><LoaderIcon className="w-5 h-5 mr-2 animate-spin" /> {t('bulk_ai_loading_maps')}</>
                  ) : aiFiles.length > 0 ? (
                    <><SparklesIcon className="w-5 h-5 mr-2" /> {t('bulk_ai_process_files', { count: aiFiles.length, plural: aiFiles.length > 1 ? 's' : '', mode: aiExtractMode === 'vision' ? 'Vision' : (aiExtractMode === 'direct' ? t('bulk_extraction_mode_direct') : t('bulk_extraction_mode_agent')) })}</>
                  ) : (
                    <><SparklesIcon className="w-5 h-5 mr-2" /> {t('bulk_ai_process_text', { mode: aiExtractMode === 'vision' ? 'Vision' : (aiExtractMode === 'direct' ? t('bulk_extraction_mode_direct') : t('bulk_extraction_mode_agent')) })}</>
                  )}
                </Button>
              )}
            </>
          ) : ( // Review Stage
            <>
              <Button id="bulk-review-back" onClick={() => setStage('upload')} variant="secondary" className="mr-3">{t('common_back')}</Button>
              <Button id="bulk-review-save" onClick={handleConfirmSave} disabled={isSaving} variant="primary" className="flex items-center justify-center">
                {isSaving ? <LoaderIcon className="w-5 h-5 mr-2 animate-spin" /> : <CheckIcon className="w-5 h-5 mr-2" />}
                {isSaving ? t('common_saving') : t('bulk_review_saveBtn', { count: draftTrips.length })}
              </Button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
};

export default React.memo(BulkUploadModal);
