import React, { useState, useEffect } from 'react';
import useTranslation from '../hooks/useTranslation';
import useUserProfile from '../hooks/useUserProfile';
import { XIcon, SaveIcon, InfoIcon, CheckCircleIcon } from './Icons';

interface CO2AnalysisSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (settings: CO2Settings) => void;
  theme: 'light' | 'dark';
  personalization: any;
  initialSettings?: Partial<CO2Settings>;
}

interface CO2Settings {
  viewMode: 'projects_only' | 'all';
  sortBy: 'total_co2' | 'efficiency' | 'distance';
  timeRange: '30' | '90' | '365' | 'all';
  fuelEfficiency: number;
}

const CO2AnalysisSettings: React.FC<CO2AnalysisSettingsProps> = ({
  isOpen,
  onClose,
  onSave,
  theme,
  personalization,
  initialSettings
}) => {
  const { t } = useTranslation();
  const { userProfile, setUserProfile } = useUserProfile();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [settings, setSettings] = useState<CO2Settings>({
    viewMode: 'projects_only',
    sortBy: 'total_co2',
    timeRange: '30',
    fuelEfficiency: userProfile?.fuelConsumption || 8.5,
    ...initialSettings
  });

  useEffect(() => {
    if (userProfile?.fuelConsumption) {
      setSettings(prev => ({
        ...prev,
        fuelEfficiency: userProfile.fuelConsumption || 8.5
      }));
    }
  }, [userProfile?.fuelConsumption]);

  // Load saved settings on open
  useEffect(() => {
    if (isOpen && userProfile?.id) {
      const savedSettings = localStorage.getItem(`co2-analysis-settings-${userProfile.id}`);
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setSettings(prev => ({ ...prev, ...parsed }));
        } catch (error) {
          console.error('Error loading CO2 settings:', error);
        }
      }
    }
  }, [isOpen, userProfile?.id]);

  const handleSave = () => {
    // Validate settings
    if (settings.fuelEfficiency <= 0 || settings.fuelEfficiency > 50) {
      alert(t('co2_settings_fuel_efficiency_validation') || 'Fuel efficiency must be between 0.1 and 50 L/100km');
      return;
    }



    // Update user profile with new fuel efficiency if it changed
    if (userProfile && userProfile.fuelConsumption !== settings.fuelEfficiency) {
      setUserProfile({
        ...userProfile,
        fuelConsumption: settings.fuelEfficiency
      });
    }

    // Store CO2 analysis settings in localStorage for persistence
    if (userProfile?.id) {
      localStorage.setItem(`co2-analysis-settings-${userProfile.id}`, JSON.stringify(settings));
    }

    // Call parent callback if provided
    if (onSave) {
      onSave(settings);
    }

    setHasUnsavedChanges(false);
    onClose();
  };

  const handleInputChange = (field: keyof CO2Settings, value: string | number | string[]) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
    setHasUnsavedChanges(true);
  };



  const handleClose = () => {
    if (hasUnsavedChanges) {
      const confirmClose = confirm(t('co2_settings_unsaved_changes') || 'You have unsaved changes. Are you sure you want to close?');
      if (!confirmClose) return;
    }
    setHasUnsavedChanges(false);
    onClose();
  };

  if (!isOpen) return null;

  const modalStyle = {
    backgroundColor: `rgba(18, 18, 18, ${1 - personalization.uiTransparency})`,
    backdropFilter: `blur(${personalization.uiBlur}px)`,
    WebkitBackdropFilter: `blur(${personalization.uiBlur}px)`,
    border: '1px solid rgba(255,255,255,0.08)',
  };

  // Visual consistency with Settings modal: rely on predefined bg tokens and tailwind classes
  const panelBgClass = 'bg-background-dark/80';

  return (
    <div className="fixed inset-0 flex items-start justify-center z-50 p-4 pt-20 bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div
        style={modalStyle}
        className="bg-frost-glass rounded-lg shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col animate-fadeIn border border-gray-700/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-gray-700/70 bg-background-dark/70 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white">{t('co2_settings_title') || 'CO₂ Analysis Settings'}</h2>
              <p className="text-xs text-on-surface-dark-secondary mt-1">{t('co2_settings_subtitle') || 'Configure your CO₂ emissions analysis preferences'}</p>
            </div>
            <button
              onClick={handleClose}
              className="text-on-surface-dark-secondary hover:text-white p-2 rounded-md hover:bg-gray-700/40 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/60"
            >
              <XIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className={`flex-1 overflow-y-auto px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent min-h-0 ${panelBgClass}`}>
            {/* View Mode Setting */}
            <div className="space-y-2">
              <label className="block text-xs font-medium uppercase tracking-wide text-on-surface-dark-secondary mb-2">
                {t('co2_settings_view_mode') || 'View Mode'}
              </label>
              <select
                value={settings.viewMode}
                onChange={(e) => handleInputChange('viewMode', e.target.value)}
                className="w-full bg-background-dark border border-gray-600/70 rounded-md px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors hover:border-gray-500"
              >
                <option value="projects_only">{t('co2_settings_projects_only') || 'Projects Only'}</option>
                <option value="all">{t('co2_settings_all_trips') || 'All Trips'}</option>
              </select>
              <p className="text-xs text-on-surface-dark-secondary mt-1 leading-relaxed">
                {t('co2_settings_view_mode_desc') || 'Choose whether to show only project-related trips or all trips in the analysis'}
              </p>
            </div>

            {/* Sort By Setting */}
            <div className="space-y-2">
              <label className="block text-xs font-medium uppercase tracking-wide text-on-surface-dark-secondary mb-2">
                {t('co2_settings_sort_by') || 'Sort By'}
              </label>
              <select
                value={settings.sortBy}
                onChange={(e) => handleInputChange('sortBy', e.target.value)}
                className="w-full bg-background-dark border border-gray-600/70 rounded-md px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors hover:border-gray-500"
              >
                <option value="total_co2">{t('trips_col_emissions') || 'Total CO₂ Emissions'}</option>
                <option value="efficiency">{t('co2_settings_efficiency') || 'CO₂ Efficiency (kg/km)'}</option>
                <option value="distance">{t('trips_col_distance') || 'Distance'}</option>
              </select>
              <p className="text-xs text-on-surface-dark-secondary mt-1 leading-relaxed">
                {t('co2_settings_sort_by_desc') || 'Select the primary metric for ranking projects'}
              </p>
            </div>

            {/* Time Range Setting */}
            <div className="space-y-2">
              <label className="block text-xs font-medium uppercase tracking-wide text-on-surface-dark-secondary mb-2">
                {t('co2_settings_time_range') || 'Time Range'}
              </label>
              <select
                value={settings.timeRange}
                onChange={(e) => handleInputChange('timeRange', e.target.value)}
                className="w-full bg-background-dark border border-gray-600/70 rounded-md px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors hover:border-gray-500"
              >
                <option value="30">{t('co2_settings_30_days') || 'Last 30 days'}</option>
                <option value="90">{t('co2_settings_90_days') || 'Last 90 days'}</option>
                <option value="365">{t('co2_settings_365_days') || 'Last year'}</option>
                <option value="all">{t('co2_settings_all_time') || 'All time'}</option>
              </select>
              <p className="text-xs text-on-surface-dark-secondary mt-1 leading-relaxed">
                {t('co2_settings_time_range_desc') || 'Select the time period for CO₂ analysis'}
              </p>
            </div>

            {/* Fuel Efficiency Setting */}
            <div className="space-y-2">
              <label className="block text-xs font-medium uppercase tracking-wide text-on-surface-dark-secondary mb-2">
                {t('co2_settings_fuel_efficiency') || 'Fuel Efficiency (L/100km)'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={settings.fuelEfficiency}
                  onChange={(e) => handleInputChange('fuelEfficiency', parseFloat(e.target.value) || 0)}
                  step="0.1"
                  min="0.1"
                  max="50"
                  className={`w-full bg-background-dark border rounded-md px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors hover:border-gray-500 ${
                    settings.fuelEfficiency <= 0 || settings.fuelEfficiency > 50 ? 'border-red-500/70 focus:ring-red-500' : 'border-gray-600/70'
                  }`}
                  placeholder="8.5"
                />
                <span className="absolute right-3 top-2.5 text-on-surface-dark-secondary text-xs select-none">L/100km</span>
              </div>
              <p className="text-xs text-on-surface-dark-secondary mt-1 leading-relaxed">
                {t('co2_settings_fuel_efficiency_desc') || 'Average fuel consumption per 100km (used for CO₂ calculations)'}
              </p>
              {(settings.fuelEfficiency <= 0 || settings.fuelEfficiency > 50) && (
                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                  <InfoIcon className="w-4 h-4" />
                  {t('co2_settings_fuel_efficiency_validation') || 'Fuel efficiency must be between 0.1 and 50 L/100km'}
                </p>
              )}
            </div>





            {/* CO2 Information */}
            <div className="rounded-lg border border-gray-700/60 bg-background-dark/60 p-4 shadow-inner md:col-span-2">
              <h4 className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-2 tracking-wide">
                <InfoIcon className="w-4 h-4" />
                {t('co2_settings_info_title') || 'About CO₂ Calculations'}
              </h4>
              <p className="text-xs text-on-surface-dark-secondary leading-relaxed">
                {t('co2_settings_info_desc') || 'CO₂ emissions are calculated based on your vehicle\'s fuel efficiency and type. The analysis helps you understand the environmental impact of your trips and identify opportunities for more efficient travel.'}
              </p>
            </div>

        </div>

        {/* Fixed Footer with Action Buttons */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-700/70 bg-background-dark/70 backdrop-blur-sm">
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-on-surface-dark-secondary">
              {hasUnsavedChanges && (
                <>
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse shadow-sm"></div>
                  <span className="tracking-wide">{t('co2_settings_unsaved_indicator') || 'Unsaved changes'}</span>
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-brand-primary/60"
              >
                {t('common_cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 text-sm bg-brand-primary hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-md transition-all duration-200 flex items-center gap-2 font-medium shadow-md hover:shadow-brand-primary/20 focus:outline-none focus:ring-2 focus:ring-brand-primary/60"
                disabled={settings.fuelEfficiency <= 0 || settings.fuelEfficiency > 50}
              >
                <SaveIcon className="w-4 h-4 opacity-90" />
                <span className="tracking-wide">{t('co2_settings_save') || 'Save Settings'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Add animation keyframes to the global style
const styleElement = document.createElement('style');
styleElement.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slideIn {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out;
  }
  .animate-slideIn {
    animation: slideIn 0.3s ease-out;
  }
`;
if (!document.querySelector('[data-co2-modal-styles]')) {
  styleElement.setAttribute('data-co2-modal-styles', 'true');
  document.head.appendChild(styleElement);
}

export default CO2AnalysisSettings;
