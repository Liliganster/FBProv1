import React, { useState, useEffect, useRef } from 'react';
import { Trip, Project, SpecialOrigin, UserProfile, PersonalizationSettings } from '../types';
import { getStaticMapUrlViaBackend, calculateDistanceViaBackend, getCountryCode } from '../services/googleMapsService';
import { XIcon, LoaderIcon, RouteIcon, PlusIcon, TrashIcon, HomeIcon, MapPinIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import useGoogleMapsScript from '../hooks/useGoogleMapsScript';
import useToast from '../hooks/useToast';
import useUserProfile from '../hooks/useUserProfile';
import useUnsavedChanges from '../hooks/useUnsavedChanges';
import { getRateForCountry } from '../services/taxService';
import useGoogleCalendar from '../hooks/useGoogleCalendar';
import { isDuplicateTrip, findDuplicateTrips } from '../services/tripUtils';
import { Button } from './Button';

declare global {
  interface Window {
    google: any;
  }
}

interface TripEditorModalProps {
  trip: Trip | null;
  projects: Project[];
  trips: Trip[];
  onSave?: (trip: Trip) => void; // Made optional since ledger handles persistence
  onClose: () => void;
  personalization?: PersonalizationSettings;
  theme?: 'light' | 'dark';
}

const TripEditorModal: React.FC<TripEditorModalProps> = ({ trip, projects, trips, onSave, onClose, personalization, theme }) => {
  const { userProfile } = useUserProfile();
  const { isSignedIn, createCalendarEvent } = useGoogleCalendar();
  const [formData, setFormData] = useState<Partial<Trip>>({
    date: new Date().toISOString().split('T')[0],
    locations: ['', ''],
    distance: 0,
    reason: '',
    projectId: '',
    specialOrigin: SpecialOrigin.HOME,
    passengers: 0,
    ratePerKm: undefined,
    editJustification: '',
    ...trip,
  });

  // Track initial data for unsaved changes detection
  const [initialFormData, setInitialFormData] = useState<Partial<Trip>>(formData);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isCalculatingDist, setIsCalculatingDist] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [distanceWarning, setDistanceWarning] = useState('');
  const [isRateManuallySet, setIsRateManuallySet] = useState(false);
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [suggestions, setSuggestions] = useState<{ index: number; options: any[] } | null>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);
  const autocompleteService = useRef<any | null>(null);
  const sessionToken = useRef<any | null>(null);
  const [staticMapUrl, setStaticMapUrl] = useState<string>('');
  const [isStaticMapLoading, setIsStaticMapLoading] = useState<boolean>(false);
  
  const { t } = useTranslation();
  const { showToast } = useToast();
  
  const { isLoaded: isMapsScriptLoaded, error: mapsScriptError } = useGoogleMapsScript();
  
  // Initialize unsaved changes tracker
  const { hasUnsavedChanges, markAsSaved, checkUnsavedChanges, resetInitialData } = useUnsavedChanges(
    initialFormData,
    formData,
    {
      enableBeforeUnload: true,
      confirmationMessage: t('common_unsaved_changes_warning')
    }
  );

  // Only show unsaved changes warning if user has actually interacted AND there are changes
  const shouldWarnAboutUnsavedChanges = hasUnsavedChanges && (hasUserInteracted || !!trip?.id);

  useEffect(() => {
    if (trip) {
        const newFormData = { passengers: 0, ...trip };
        setFormData(newFormData);
        setInitialFormData(newFormData);
        resetInitialData(newFormData);
        if (trip.ratePerKm !== undefined) {
            setIsRateManuallySet(true);
        }
    } else {
        // Reset for new trip
        const newFormData = {
          date: new Date().toISOString().split('T')[0],
          locations: ['', ''],
          distance: 0,
          reason: '',
          projectId: '',
          specialOrigin: SpecialOrigin.HOME,
          passengers: 0,
          ratePerKm: undefined,
          editJustification: '',
        };
        setFormData(newFormData);
        setInitialFormData(newFormData);
        resetInitialData(newFormData);
    }
  }, [trip, resetInitialData]);

  useEffect(() => {
    if (isRateManuallySet || trip || !userProfile) return; 

    const selectedProject = projects.find(p => p.id === formData.projectId);
    
    if (userProfile) {
        const defaultRate = selectedProject?.ratePerKm ?? userProfile.ratePerKm ?? getRateForCountry(userProfile.country);
        if (formData.ratePerKm !== defaultRate) {
            setFormData(prev => ({ ...prev, ratePerKm: defaultRate }));
        }
    }
  }, [formData.projectId, projects, userProfile, isRateManuallySet, trip, formData.ratePerKm]);
  
  useEffect(() => {
    if (isMapsScriptLoaded && window.google && window.google.maps && window.google.maps.places) {
      try {
        autocompleteService.current = new window.google.maps.places.AutocompleteService();
        sessionToken.current = new window.google.maps.places.AutocompleteSessionToken();
      } catch (error) {
        console.warn('AutocompleteService not available:', error);
        autocompleteService.current = null;
        sessionToken.current = null;
      }
    }
  }, [isMapsScriptLoaded]);

  useEffect(() => {
    let cancelled = false;
    const loadStaticMap = async () => {
      setIsStaticMapLoading(true);
      try {
        const locations = Array.isArray(formData.locations) ? formData.locations : [];
        const url = await getStaticMapUrlViaBackend(locations);
        if (!cancelled) {
          setStaticMapUrl(url);
        }
      } catch (error) {
        console.error('[TripEditor] Failed to load static map preview:', error);
        if (!cancelled) {
          const seed = Array.isArray(formData.locations) && formData.locations[0] ? formData.locations[0] : 'trip';
          setStaticMapUrl(`https://picsum.photos/seed/${encodeURIComponent(seed)}/800/200`);
        }
      } finally {
        if (!cancelled) {
          setIsStaticMapLoading(false);
        }
      }
    };
    loadStaticMap();
    return () => {
      cancelled = true;
    };
  }, [formData.locations]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setSuggestions(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getUserHomeAddress = (): string | null => {
    if (userProfile && userProfile.address && userProfile.city && userProfile.country) {
        return `${userProfile.address}, ${userProfile.city}, ${userProfile.country}`;
    }
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const isNumber = e.target.getAttribute('type') === 'number';

    // Mark that user has interacted with the form (but not for programmatic changes like rate auto-setting)
    if (!trip?.id) { // Only for new trips
      setHasUserInteracted(true);
    }

    if (name === 'distance') {
      const dist = parseFloat(value);
      if (dist <= 0 && value !== '') {
        setDistanceWarning(t('tripEditor_validation_distance_positive'));
      } else if (dist > 1000) {
        setDistanceWarning(t('tripEditor_alert_improbable_distance'));
      } else {
        setDistanceWarning('');
      }
    }

    setFormData(prev => ({ ...prev, [name]: isNumber ? (value === '' ? undefined : parseFloat(value)) : value }));
  };

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsRateManuallySet(true);
    if (!trip?.id) {
      setHasUserInteracted(true);
    }
    handleChange(e);
  };
  
  const handleSpecialOriginChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSpecialOrigin = e.target.value as SpecialOrigin;
    const homeAddress = getUserHomeAddress();

    if ([SpecialOrigin.HOME, SpecialOrigin.END_OF_CONTINUATION].includes(newSpecialOrigin) && !homeAddress) {
        showToast(t('tripEditor_alert_noHomeAddress'), 'warning');
        e.target.value = formData.specialOrigin || SpecialOrigin.HOME;
        return;
    }

    // Only mark as interacted for new trips
    if (!trip?.id) {
      setHasUserInteracted(true);
    }
    
    const sortedTrips = [...trips]
      .filter(t => t.id !== trip?.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const previousTrip = sortedTrips.find(t => new Date(t.date) <= new Date(formData.date!));
    const previousTripLastLocation = previousTrip?.locations[previousTrip.locations.length - 1];

    setFormData(prev => {
        let newLocations = [...(prev.locations || ['', ''])];
        
        switch (newSpecialOrigin) {
            case SpecialOrigin.HOME:
                newLocations[0] = homeAddress || '';
                break;
            case SpecialOrigin.CONTINUATION:
                newLocations[0] = previousTripLastLocation || '';
                break;
            case SpecialOrigin.END_OF_CONTINUATION:
                newLocations[0] = previousTripLastLocation || '';
                if (newLocations.length < 2) {
                    newLocations.push(homeAddress || '');
                } else {
                    newLocations[newLocations.length - 1] = homeAddress || '';
                }
                break;
        }
        return { ...prev, specialOrigin: newSpecialOrigin, locations: newLocations };
    });
};

  const handleLocationChange = (index: number, value: string) => {
    // Only mark as interacted for new trips
    if (!trip?.id) {
      setHasUserInteracted(true);
    }
    
    const newLocations = [...(formData.locations || [])];
    newLocations[index] = value;
    setFormData(prev => ({ ...prev, locations: newLocations }));

    if (autocompleteService.current && value.trim()) {
      const regionCode = getCountryCode(userProfile?.country);
      autocompleteService.current.getPlacePredictions(
        {
          input: value,
          sessionToken: sessionToken.current!,
          componentRestrictions: regionCode ? { country: regionCode } : undefined,
        },
        (predictions, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSuggestions({ index, options: predictions });
          } else {
            setSuggestions(null);
          }
        }
      );
    } else {
      setSuggestions(null);
    }
  }

  const handleSuggestionClick = (index: number, prediction: any) => {
    // Only mark as interacted for new trips
    if (!trip?.id) {
      setHasUserInteracted(true);
    }
    
    const newLocations = [...(formData.locations || [])];
    newLocations[index] = prediction.description;
    setFormData(prev => ({ ...prev, locations: newLocations }));
    setSuggestions(null);
    if (window.google) {
      sessionToken.current = new window.google.maps.places.AutocompleteSessionToken();
    }
  };


  const handleAddLocation = (index: number) => {
    // Only mark as interacted for new trips
    if (!trip?.id) {
      setHasUserInteracted(true);
    }
    
    const newLocations = [...(formData.locations || [])];
    newLocations.splice(index + 1, 0, '');
    setFormData(prev => ({...prev, locations: newLocations}));
  }

  const handleRemoveLocation = (index: number) => {
    if ((formData.locations?.length || 0) <= 2) {
      showToast(t('tripEditor_alert_minLocations'), 'warning');
      return;
    }
    
    // Only mark as interacted for new trips
    if (!trip?.id) {
      setHasUserInteracted(true);
    }
    
    const newLocations = [...(formData.locations || [])];
    newLocations.splice(index, 1);
    setFormData(prev => ({...prev, locations: newLocations}));
  }
  
  const handleCalculateDistance = async () => {
      let locationsForCalc = [...(formData.locations || ['', ''])];
      const needsHomeAddress = !locationsForCalc[0]?.trim() || (locationsForCalc.length > 1 && !locationsForCalc[locationsForCalc.length - 1]?.trim());

      if (needsHomeAddress) {
          const homeAddress = getUserHomeAddress();
          if (!homeAddress) {
              showToast(t('tripEditor_alert_noHomeAddress'), 'warning');
              return;
          }
          if (!locationsForCalc[0]?.trim()) locationsForCalc[0] = homeAddress;
          if (locationsForCalc.length > 1 && !locationsForCalc[locationsForCalc.length - 1]?.trim()) {
              locationsForCalc[locationsForCalc.length - 1] = homeAddress;
          }
      }

      const finalLocationsForCalc = locationsForCalc.filter((loc, index) => {
          if (index === 0 || index === locationsForCalc.length - 1) return true;
          return loc.trim() !== '';
      });

      if (finalLocationsForCalc.length < 2) {
          showToast(t('tripEditor_alert_minLocationsDistance'), 'warning');
          return;
      }

      setIsCalculatingDist(true);
      try {
        const regionCode = getCountryCode(userProfile?.country);
        const distance = await calculateDistanceViaBackend(finalLocationsForCalc, regionCode);
        if (distance !== null) {
          if (!trip?.id) {
            setHasUserInteracted(true);
          }
          setFormData(prev => ({ ...prev, distance }));
          if (distance > 1000) {
            setDistanceWarning(t('tripEditor_alert_improbable_distance'));
          } else {
            setDistanceWarning('');
          }
        } else {
          showToast(t('tripEditor_alert_distanceError'), 'error');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : t('tripEditor_alert_distanceError');
        showToast(message, 'error');
      } finally {
        setIsCalculatingDist(false);
      }
  }

  // Auto-calculate distance when origin and destination are filled
  const lastCalcKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const locs = Array.isArray(formData.locations) ? formData.locations.map(l => (l || '').trim()) : [];
    if (locs.length < 2) return;
    const origin = locs[0];
    const destination = locs[locs.length - 1];
    if (!origin || !destination) return;

    // Build a key to detect same calculation inputs (avoid loops)
    const calcKey = `${origin}__${locs.slice(1, -1).filter(Boolean).join('|')}__${destination}`;
    if (lastCalcKeyRef.current === calcKey) return;

    // Debounce a bit to wait for user typing to settle
    const timeout = setTimeout(async () => {
      try {
        await handleCalculateDistance();
        lastCalcKeyRef.current = calcKey;
      } catch {
        // ignore – UI already shows toast on failure
      }
    }, 700);

    return () => clearTimeout(timeout);
  }, [formData.locations]);

  // Helper function to determine which fields changed between trips
  const getChangedFields = (originalTrip: Trip, updatedTrip: Trip): string[] => {
    const changedFields: string[] = [];
    
    if (originalTrip.date !== updatedTrip.date) changedFields.push('date');
    if (JSON.stringify(originalTrip.locations) !== JSON.stringify(updatedTrip.locations)) changedFields.push('locations');
    if (originalTrip.distance !== updatedTrip.distance) changedFields.push('distance');
    if (originalTrip.projectId !== updatedTrip.projectId) changedFields.push('projectId');
    if (originalTrip.reason !== updatedTrip.reason) changedFields.push('reason');
    if (originalTrip.specialOrigin !== updatedTrip.specialOrigin) changedFields.push('specialOrigin');
    if (originalTrip.passengers !== updatedTrip.passengers) changedFields.push('passengers');
    if (originalTrip.ratePerKm !== updatedTrip.ratePerKm) changedFields.push('ratePerKm');
    
    return changedFields;
  };

  const handleSave = async () => {
    let locationsToSave = [...(formData.locations || ['', ''])];
    const needsHomeAddress = !locationsToSave[0]?.trim() || (locationsToSave.length > 1 && !locationsToSave[locationsToSave.length - 1]?.trim());

    if (needsHomeAddress) {
        const homeAddress = getUserHomeAddress();
        if (!homeAddress) {
            showToast(t('tripEditor_alert_noHomeAddress'), 'warning');
            return;
        }
        if (!locationsToSave[0]?.trim()) locationsToSave[0] = homeAddress;
        if (locationsToSave.length > 1 && !locationsToSave[locationsToSave.length - 1]?.trim()) {
            locationsToSave[locationsToSave.length - 1] = homeAddress;
        }
    }
    
    const finalLocations = locationsToSave
      .map(loc => loc.trim())
      .filter((loc, index, arr) => {
        if (index === 0 || index === arr.length - 1) {
          return true;
        }
        return loc !== '';
      });
      
    const validationErrors: string[] = [];
    const isEditingExistingTrip = !!trip?.id;
    
    if (!formData.date) {
        validationErrors.push(t('tripEditor_form_date'));
    }
    if (!formData.projectId) {
        validationErrors.push(t('tripEditor_form_project'));
    }
    if (finalLocations.length < 2 || !finalLocations[0] || !finalLocations[finalLocations.length - 1]) {
        validationErrors.push(t('tripEditor_validation_locations'));
    }
    if (!formData.distance || formData.distance <= 0) {
        validationErrors.push(t('tripEditor_validation_distance_positive'));
    }
    if (isEditingExistingTrip && (!formData.editJustification || formData.editJustification.trim() === '')) {
        validationErrors.push(t('tripEditor_validation_editJustification'));
    }

    if (validationErrors.length > 0) {
        const errorString = validationErrors.join(', ');
        showToast(`${t('tripEditor_validation_prefix')}: ${errorString}`, 'error');
        return;
    }

    // Check for duplicate trips (same date + same route)
    const tripToCheck = { date: formData.date!, locations: finalLocations };
    const isDuplicate = isDuplicateTrip(tripToCheck, trips, trip?.id);
    
    if (isDuplicate) {
        const duplicateTrips = findDuplicateTrips(tripToCheck, trips, trip?.id);
        
        const confirmed = window.confirm(
            `${t('tripEditor_warning_duplicate')}\n\n` +
            `Fecha: ${formData.date}\n` +
            `Ruta: ${finalLocations.join(' → ')}\n\n` +
            `${duplicateTrips.length > 1 ? 
                `Se encontraron ${duplicateTrips.length} viajes similares` : 
                `Se encontró 1 viaje similar`}\n\n` +
            `${t('tripEditor_duplicate_confirmation')}`
        );
        
        if (!confirmed) {
            return;
        }
    }

    const finalFormData = { ...formData, locations: finalLocations };
    if (finalFormData.ratePerKm === undefined || isNaN(Number(finalFormData.ratePerKm))) {
        delete finalFormData.ratePerKm;
    } else {
        finalFormData.ratePerKm = Number(finalFormData.ratePerKm);
    }

    const finalTrip = { 
        id: formData.id || `trip-${Date.now()}-${Math.random()}`, 
        ...finalFormData 
    } as Trip;
    
    try {
        // Call onSave callback which will handle persistence via Supabase context
        if (onSave) {
            onSave(finalTrip);
        }
        
        if (isEditingExistingTrip) {
            showToast(t('tripEditor_trip_updated_success'), 'success');
        } else {
            showToast(t('tripEditor_trip_created_success'), 'success');
        }
        
        // Mark as saved after successful save
        markAsSaved();

        // Handle calendar integration
        if (addToCalendar && isSignedIn) {
            try {
                const projectName = projects.find(p => p.id === finalTrip.projectId)?.name || 'Trip';
                await createCalendarEvent(finalTrip, projectName);
                showToast(t('toast_calendar_event_success'), 'success');
            } catch (error) {
                console.error('Failed to create calendar event:', error);
                showToast(t('toast_calendar_event_error'), 'error');
            }
        }
        
        // Close modal after successful save
        onClose();
        
    } catch (error) {
        console.error('Failed to save trip:', error);
        showToast(error instanceof Error ? error.message : 'Failed to save trip', 'error');
    }
  };

  const handleClose = async () => {
    // Only check for unsaved changes if user has actually interacted OR it's an existing trip
    if (shouldWarnAboutUnsavedChanges) {
      const shouldClose = await checkUnsavedChanges();
      if (shouldClose) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (index !== dragIndex) {
          setDragOverIndex(index);
      }
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === dropIndex) {
          setDragIndex(null);
          setDragOverIndex(null);
          return;
      }
      
      const totalLocations = formData.locations?.length || 0;
      if (dropIndex === 0 || dropIndex === totalLocations - 1) {
          setDragIndex(null);
          setDragOverIndex(null);
          return;
      }

      // Only mark as interacted for new trips
      if (!trip?.id) {
        setHasUserInteracted(true);
      }

      const locations = [...(formData.locations || [])];
      const draggedItem = locations.splice(dragIndex, 1)[0];
      locations.splice(dropIndex, 0, draggedItem);
      
      setFormData(prev => ({...prev, locations}));
      setDragIndex(null);
      setDragOverIndex(null);
  };

  const handleDragEnd = () => {
      setDragIndex(null);
      setDragOverIndex(null);
  };
  
  const specialOriginOptions = Object.values(SpecialOrigin).map(so => ({
      value: so,
      label: t(`specialOrigin_${so.toLowerCase()}`)
  }));

  // Dynamic modal style based on personalization
  const modalStyle = personalization ? {
    backgroundColor: `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`,
    backdropFilter: `blur(${personalization.uiBlur}px)`,
    WebkitBackdropFilter: `blur(${personalization.uiBlur}px)`,
  } : {};

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-16 overflow-y-auto bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div style={modalStyle} className="relative w-full max-w-2xl bg-frost-glass border border-gray-700/60 rounded-lg shadow-2xl flex flex-col max-h-[88vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between px-6 py-4 border-b border-gray-700/60">
          <div className="flex items-center gap-3 pr-6">
            <h2 className="text-lg font-semibold tracking-tight text-white">{trip ? t('tripEditor_title_edit') : t('tripEditor_title_add')}</h2>
          </div>
          <Button
            variant="icon"
            onClick={handleClose}
            aria-label={t('common_close')}
            title={t('common_close')}
          >
            <XIcon className="w-5 h-5" />
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-6">
          <>
              <div className="relative mb-6 h-40 w-full">
                <img
                  src={staticMapUrl || `https://picsum.photos/seed/${encodeURIComponent(formData.locations?.[0] || 'trip')}/800/200`}
                  alt={t('tripEditor_mapAlt')}
                  loading="lazy"
                  decoding="async"
                  className="rounded-lg h-full w-full object-cover bg-gray-800 ring-1 ring-gray-700/60"
                />
                {isStaticMapLoading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 backdrop-blur-sm">
                    <LoaderIcon className="w-6 h-6 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <InputField label={t('tripEditor_form_date')} type="date" name="date" value={formData.date} onChange={handleChange} />
                  
                  <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-300/90 mb-1">{t('tripEditor_form_project')}</label>
                      <select name="projectId" value={formData.projectId || ''} onChange={handleChange} className="w-full bg-background-dark/70 border border-gray-600/70 rounded-md px-3 py-2 text-sm text-on-surface-dark focus:outline-none focus:ring-2 focus:ring-brand-primary/50">
                          <option value="" disabled>{t('tripEditor_form_project_placeholder')}</option>
                          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                  </div>

          <div className="md:col-span-2 space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-300/90 mb-1">{t('tripEditor_form_locations')}</label>
                      {formData.locations?.map((location, index) => {
                         const isOrigin = index === 0;
                         const isDestination = index === formData.locations!.length - 1;
                         const isIntermediate = !isOrigin && !isDestination;
                         const isOriginDisabled = isOrigin && (
                              formData.specialOrigin === SpecialOrigin.CONTINUATION ||
                              formData.specialOrigin === SpecialOrigin.END_OF_CONTINUATION
                         );
                         const isDestinationDisabled = isDestination && (
                              formData.specialOrigin === SpecialOrigin.END_OF_CONTINUATION
                         );
                         const homeAddressExists = !!getUserHomeAddress();
                         const showOriginHint = isOrigin && !location.trim() && !isOriginDisabled && homeAddressExists;
                         const showDestinationHint = isDestination && !location.trim() && !isDestinationDisabled && homeAddressExists;

                         const isBeingDragged = dragIndex === index;
                         let dropIndicatorClass = '';
                         if (dragOverIndex === index && dragIndex !== null) {
                             if (dragIndex < dragOverIndex) {
                                 dropIndicatorClass = 'border-b-2 border-brand-primary';
                             } else {
                                 dropIndicatorClass = 'border-t-2 border-brand-primary';
                             }
                         }
                         
                         let placeholder = '';
                         if (isOrigin) {
                            placeholder = t('tripEditor_form_origin_placeholder');
                         } else if (isDestination) {
                            placeholder = t('tripEditor_form_destination_placeholder');
                         } else {
                            placeholder = t('tripEditor_form_stop_placeholder');
                         }
                         
                         const showSuggestions = suggestions && suggestions.index === index;

                         return (
                            <React.Fragment key={index}>
                              <div
                                className={`relative flex items-center gap-2 border-t-2 border-b-2 border-transparent transition-all duration-150 ${isBeingDragged ? 'opacity-30' : 'opacity-100'} ${dropIndicatorClass}`}
                                draggable={isIntermediate}
                                onDragStart={isIntermediate ? (e) => handleDragStart(e, index) : undefined}
                                onDragEnter={isIntermediate ? (e) => handleDragEnter(e, index) : undefined}
                                onDragLeave={isIntermediate ? handleDragLeave : undefined}
                                onDragOver={handleDragOver}
                                onDrop={isIntermediate ? (e) => handleDrop(e, index) : undefined}
                                onDragEnd={handleDragEnd}
                              >
                                  {isIntermediate ? (
                                    <MapPinIcon className="w-5 h-5 text-on-surface-dark-secondary cursor-grab flex-shrink-0" />
                                  ) : (
                                    <HomeIcon className={`w-5 h-5 flex-shrink-0 ${isOrigin ? 'text-brand-primary' : 'text-brand-secondary'}`} />
                                  )}
                                  <div className="relative w-full">
                                    <input 
                                      type="text"
                                      placeholder={placeholder}
                                      value={location}
                                      onChange={(e) => handleLocationChange(index, e.target.value)}
                                      disabled={isOriginDisabled || isDestinationDisabled}
                                      className="w-full bg-background-dark/70 border border-gray-600/70 rounded-md px-3 py-2 text-sm text-on-surface-dark placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                                      autoComplete="off"
                                      title={
                                        showOriginHint ? t('tripEditor_form_origin_empty_hint') :
                                        showDestinationHint ? t('tripEditor_form_destination_empty_hint') :
                                        undefined
                                      }
                                    />
                                  </div>
                                  <Button variant="icon" size="sm" onClick={() => handleAddLocation(index)} className="text-green-400 hover:text-green-300 bg-green-500/10" title={t('tripEditor_add_location')}>
                                    <PlusIcon className="w-5 h-5"/>
                                  </Button>
                                  <Button variant="icon" size="sm" onClick={() => handleRemoveLocation(index)} className="text-red-400 hover:text-red-300 bg-red-500/10" title={t('tripEditor_remove_location')}>
                                    <TrashIcon className="w-5 h-5"/>
                                  </Button>
                                  
                                  {showSuggestions && (
                                    <ul ref={suggestionsRef} className="absolute top-full left-8 right-16 mt-1 bg-background-dark/95 border border-gray-600/70 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto backdrop-blur-sm">
                                      {suggestions.options.map(prediction => (
                                        <li
                                          key={prediction.place_id}
                                          onClick={() => handleSuggestionClick(index, prediction)}
                                          className="px-3 py-2 text-xs text-gray-200 hover:bg-brand-primary/20 cursor-pointer transition-colors"
                                        >
                                          {prediction.description}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                              </div>
                            </React.Fragment>
                         );
                      })}
                  </div>
                  <div className="md:col-span-2">
                    <InputField label={t('tripEditor_form_reason')} name="reason" value={formData.reason} onChange={handleChange} />
                  </div>
                  <div>
                       <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-300/90 mb-1">{t('tripEditor_form_specialOrigin')}</label>
                      <select name="specialOrigin" value={formData.specialOrigin} onChange={handleSpecialOriginChange} className="w-full bg-background-dark/70 border border-gray-600/70 rounded-md px-3 py-2 text-sm text-on-surface-dark focus:outline-none focus:ring-2 focus:ring-brand-primary/50">
                          {specialOriginOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                  </div>
                  <InputField label={t('tripEditor_form_passengers')} type="number" name="passengers" value={formData.passengers} onChange={handleChange} min={0} />
                  {trip?.id && (
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-300/90 mb-1">{t('tripEditor_form_editJustification')}</label>
                      <textarea
                        name="editJustification"
                        value={formData.editJustification || ''}
                        onChange={handleChange}
                        placeholder={t('tripEditor_form_editJustification_placeholder')}
                        rows={3}
                        className="w-full bg-background-dark/70 border border-gray-600/70 rounded-md px-3 py-2 text-sm text-on-surface-dark placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 resize-none"
                        required
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        {t('tripEditor_validation_editJustification')}
                      </p>
                    </div>
                  )}
                  <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-300/90 mb-1">{t('tripEditor_form_distance')}</label>
                      <div className="flex items-center">
                        <input type="number" min="0.01" step="0.1" name="distance" value={formData.distance || ''} onChange={handleChange} className="w-full bg-background-dark/70 border border-gray-600/70 rounded-md px-3 py-2 text-sm text-on-surface-dark placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/50" />
                        <Button variant="ghost" size="sm" onClick={handleCalculateDistance} disabled={isCalculatingDist} className="ml-2 bg-brand-primary/15 text-brand-primary hover:bg-brand-primary/25" title={t('tripEditor_calculate_distance')}>
                          {isCalculatingDist ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <RouteIcon className="w-5 h-5"/>}
                        </Button>
                      </div>
                       {distanceWarning && <p className="text-yellow-400 text-[11px] mt-1">{distanceWarning}</p>}
                       {mapsScriptError && <p className="text-red-400 text-[11px] mt-1">Error loading Google Maps script.</p>}
                  </div>
                  <div>
                    <InputField label={t('rate_per_km_trip')} name="ratePerKm" type="number" value={formData.ratePerKm} onChange={handleRateChange} placeholder={t('rate_per_km_trip_placeholder')} />
                  </div>
                  {isSignedIn && (
                    <div className="md:col-span-2 flex items-center gap-2 pt-2">
                        <input
                            type="checkbox"
                            id="addToCalendar"
                            checked={addToCalendar}
                            onChange={(e) => setAddToCalendar(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-500 bg-background-dark text-brand-primary focus:ring-brand-primary focus:outline-none"
                            disabled={!isSignedIn}
                        />
                        <label
                          htmlFor="addToCalendar"
                          className={`text-xs font-medium ${!isSignedIn ? 'text-gray-500 cursor-not-allowed' : 'text-gray-300 cursor-pointer'}`}
                          title={!isSignedIn ? 'Sign in to Google Calendar first' : undefined}
                        >
                          {t('tripEditor_form_addToCalendar')}
                        </label>
                    </div>
                )}
              </div>
          </>
        </main>
        <footer className="flex justify-between items-center px-6 py-4 border-t border-gray-700/60 bg-background-dark/40">
          <div className="flex items-center gap-2">
            {shouldWarnAboutUnsavedChanges && (
              <>
                <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-orange-400 font-medium">
                  {t('common_unsaved_indicator')}
                </span>
              </>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleClose}
            >
              {t('common_cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
            >
              {t('tripEditor_saveBtn')}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
};

const InputField: React.FC<{label: string, name: string, value?: string | number, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void, type?: string, disabled?: boolean, min?: number, placeholder?: string}> = ({ label, name, value, onChange, type = 'text', disabled = false, min, placeholder }) => (
  <div className="space-y-1.5">
    <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-300/90">{label}</label>
    <input
      type={type}
      name={name}
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled}
      min={min}
      placeholder={placeholder}
      step="0.01"
      className="w-full bg-background-dark/70 border border-gray-600/70 rounded-md px-3 py-2 text-sm text-on-surface-dark placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
    />
  </div>
);

export default React.memo(TripEditorModal);
