
import React, { useState } from 'react';
import useTranslation from '../hooks/useTranslation';
import useUserProfile from '../hooks/useUserProfile';
import useTrips from '../hooks/useTrips';
import { XIcon, MapPinIcon, CalendarIcon } from './Icons';
import { Button } from './Button';
import { SpecialOrigin, Trip, PersonalizationSettings } from '../types';
import TripEditorModal from './TripEditorModal';

interface EventActionModalProps {
  event: any;
  onClose: () => void;
  personalization?: PersonalizationSettings;
  theme?: 'light' | 'dark';
}

const EventActionModal: React.FC<EventActionModalProps> = ({ event, onClose, personalization, theme }) => {
  const { t } = useTranslation();
  const { userProfile } = useUserProfile();
  const { trips, projects, addTrip } = useTrips();
  const [isTripEditorOpen, setIsTripEditorOpen] = useState(false);

  const handleCreateTrip = () => {
    setIsTripEditorOpen(true);
  };

  const handleSaveTrip = (trip: Trip) => {
    addTrip(trip);
    setIsTripEditorOpen(false);
    onClose();
  };

  const getEventTime = () => {
    if (!event.start) return '';
    const start = event.start.dateTime ? new Date(event.start.dateTime) : null;
    const end = event.end.dateTime ? new Date(event.end.dateTime) : null;
    if (event.start.date) return t('calendar_event_allday');
    if (start && end) return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return '';
  }

  const initialTripData: Partial<Trip> = {
    date: (event.start.date || event.start.dateTime).split('T')[0],
    reason: event.summary || '',
    locations: [userProfile?.address || '', event.location || ''],
    specialOrigin: SpecialOrigin.HOME,
  };

  // Dynamic modal style based on personalization
  const modalStyle = personalization ? {
    backgroundColor: `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`,
    backdropFilter: `blur(${personalization.uiBlur}px)`,
    WebkitBackdropFilter: `blur(${personalization.uiBlur}px)`,
  } : {};

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 pt-20 z-50" onClick={onClose}>
        <div
          style={modalStyle}
          className="bg-frost-glass border border-gray-700/60 rounded-lg shadow-2xl w-full max-w-xs sm:max-w-md md:max-w-lg flex flex-col overflow-hidden animate-fadeIn"
          onClick={e => e.stopPropagation()}
        >
          <header className="px-6 py-4 border-b border-gray-700/70 flex items-center justify-between gap-4 bg-background-dark/70 backdrop-blur-sm">
            <h2 className="text-lg font-semibold tracking-tight text-white truncate">{event.summary}</h2>
            <Button variant="icon" onClick={onClose} className="text-on-surface-dark-secondary hover:text-white">
              <XIcon className="w-5 h-5" />
            </Button>
          </header>
          <main className="px-6 py-6 space-y-5 overflow-y-auto">
            <div className="flex items-center gap-3 text-sm">
              <CalendarIcon className="w-5 h-5 text-on-surface-dark-secondary" />
              <p className="text-on-surface-dark-secondary">{getEventTime()}</p>
            </div>
            {event.location && (
              <div className="flex items-center gap-3 text-sm">
                <MapPinIcon className="w-5 h-5 text-on-surface-dark-secondary" />
                <p className="text-on-surface-dark-secondary">{event.location}</p>
              </div>
            )}
            {event.description && <p className="text-xs text-on-surface-dark-secondary whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">{event.description}</p>}
          </main>
          <footer className="px-6 py-4 border-t border-gray-700/70 bg-background-dark/70 backdrop-blur-sm flex justify-end gap-3">
            <Button variant="primary" size="sm" onClick={handleCreateTrip}>
              {t('calendar_event_create_trip')}
            </Button>
          </footer>
        </div>
      </div>
      {isTripEditorOpen && userProfile && (
        <TripEditorModal
          trip={initialTripData as Trip}
          projects={projects}
          trips={trips}
          onSave={handleSaveTrip}
          onClose={() => {
            setIsTripEditorOpen(false);
            onClose();
          }}
          personalization={personalization}
          theme={theme}
        />
      )}
    </>
  );
};

export default EventActionModal;
