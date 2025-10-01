import React from 'react';
import { Trip, Project, UserProfile } from '../types';
import { XIcon, MapPinIcon } from './Icons';
import InteractiveMap from './InteractiveMap';
import useTranslation from '../hooks/useTranslation';
import { formatDateForDisplay } from '../i18n/translations';
import { getCountryCode } from '../services/googleMapsService';
import useUserProfile from '../hooks/useUserProfile';

interface TripDetailModalProps {
  trip: Trip;
  project: Project | undefined;
  onClose: () => void;
}

const TripDetailModal: React.FC<TripDetailModalProps> = ({ trip, project, onClose }) => {
  const { userProfile } = useUserProfile();
  const { t } = useTranslation();
  const regionCode = getCountryCode(userProfile?.country);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 py-16 overflow-y-auto bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl bg-background-dark/95 border border-gray-700/60 rounded-lg shadow-2xl flex flex-col h-[82vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-start justify-between px-6 py-4 border-b border-gray-700/60 flex-shrink-0">
          <h2 className="text-lg font-semibold tracking-tight text-white">{t('detail_title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('common_close')}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </header>
        <main className="flex-1 flex flex-col md:flex-row min-h-0">
          {/* Sidebar */}
          <div className="w-full md:w-1/3 px-6 py-6 space-y-4 overflow-y-auto border-r border-gray-700/60 bg-background-dark/60">
            <InfoItem label={t('detail_date')} value={formatDateForDisplay(trip.date)} />
            <InfoItem label={t('detail_project')} value={project?.name || t('detail_unknown')} />
            <InfoItem label={t('detail_driver')} value={userProfile?.name || t('detail_unknown')} />
            <InfoItem label={t('detail_reason')} value={trip.reason} />
            {trip.passengers && trip.passengers > 0 && (
              <InfoItem label={t('detail_passengers')} value={trip.passengers.toString()} />
            )}
            <div className="border-t border-gray-700/60 pt-4 mt-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-300/90 mb-3 flex items-center gap-2">
                <MapPinIcon className="w-4 h-4" />
                {t('detail_route')}
              </h3>
              <ol className="relative border-l border-gray-600/60 ml-2">
                {trip.locations.map((location, index) => (
                  <li key={index} className="mb-4 ml-4">
                    <div
                      className={`absolute w-3 h-3 ${
                        index === 0
                          ? 'bg-brand-primary'
                          : index === trip.locations.length - 1
                          ? 'bg-brand-secondary'
                          : 'bg-gray-500'
                      } rounded-full mt-1.5 -left-1.5 border border-background-dark`}
                    ></div>
                    <p className="text-xs text-gray-200 leading-snug">{location}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="border-t border-gray-700/60 pt-4 mt-4">
              <InfoItem label={t('detail_totalDistance')} value={`${trip.distance.toFixed(1)} km`} highlight />
            </div>
          </div>
          {/* Map area */}
          <div className="w-full md:w-2/3 flex-grow bg-background-dark">
            <InteractiveMap
              locations={trip.locations}
              apiKey={userProfile?.googleMapsApiKey}
              region={regionCode}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

const InfoItem: React.FC<{label: string, value: string, highlight?: boolean}> = ({label, value, highlight}) => (
    <div>
        <h3 className="text-sm font-medium text-on-surface-dark-secondary">{label}</h3>
        <p className={`text-lg ${highlight ? 'font-bold text-brand-primary' : 'text-white'}`}>{value}</p>
    </div>
);

export default TripDetailModal;