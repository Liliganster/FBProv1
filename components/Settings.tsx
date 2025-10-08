import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, AiModelInfo, View, PersonalizationSettings } from '../types';
import { SaveIcon, LockIcon, XIcon, UserCircleIcon, SparklesIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import useToast from '../hooks/useToast';
import useUnsavedChanges from '../hooks/useUnsavedChanges';
import { fetchOpenRouterModels } from '../services/aiService';
import { getRateForCountry, getPassengerSurchargeForCountry } from '../services/taxService';
import useUserProfile from '../hooks/useUserProfile';
import { useAuth } from '../hooks/useAuth';
import LanguageSwitcher from './LanguageSwitcher';
import {
  LuPalette as Palette,
  LuLanguages as Languages,
  LuNewspaper as Newspaper,
  LuCircleHelp as HelpCircle,
  LuCloudUpload as UploadCloud,
  LuImageOff as ImageOff,
} from 'react-icons/lu';

type Tab = 'profile' | 'compliance' | 'api' | 'personalization' | 'language' | 'changelog' | 'help';

const SettingsView: React.FC<{ 
    setCurrentView: (view: View) => void;
    personalization: PersonalizationSettings;
    setPersonalization: React.Dispatch<React.SetStateAction<PersonalizationSettings>>;
    theme: 'light' | 'dark';
}> = ({ setCurrentView, personalization, setPersonalization, theme }) => {
    const { userProfile, setUserProfile } = useUserProfile();
    const { user } = useAuth();
    const [localProfile, setLocalProfile] = useState<UserProfile | null>(userProfile);
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [passengerSurcharge, setPassengerSurcharge] = useState<number>(0);
    const [openRouterModels, setOpenRouterModels] = useState<AiModelInfo[]>([]);
    const [isFetchingOrModels, setIsFetchingOrModels] = useState(false);
    const [fetchOrModelsError, setFetchOrModelsError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('profile');
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize unsaved changes tracker for profile data
    const { hasUnsavedChanges, markAsSaved, checkUnsavedChanges, resetInitialData } = useUnsavedChanges(
        userProfile || null,
        localProfile,
        {
            enableBeforeUnload: true,
            confirmationMessage: t('common_unsaved_changes_warning')
        }
    );

    useEffect(() => {
        setLocalProfile(userProfile);
        resetInitialData(userProfile);
        if (userProfile) {
            setPassengerSurcharge(getPassengerSurchargeForCountry(userProfile.country));
        }
    }, [userProfile, resetInitialData]);
    
    useEffect(() => {
        if (!localProfile) return;
        const fetchModels = async () => {
            if (localProfile.openRouterApiKey) {
                setIsFetchingOrModels(true);
                setFetchOrModelsError(null);
                setOpenRouterModels([]);
                try {
                    const models = await fetchOpenRouterModels(localProfile.openRouterApiKey);
                    setOpenRouterModels(models);
                } catch (error) {
                    setFetchOrModelsError(error instanceof Error ? error.message : "An unknown error occurred.");
                } finally {
                    setIsFetchingOrModels(false);
                }
            } else {
                setOpenRouterModels([]);
                setFetchOrModelsError(null);
            }
        };
        fetchModels();
    }, [localProfile?.openRouterApiKey]);

    const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string; type?: string } }) => {
        if (!localProfile) return;
        const { name, value } = e.target;
        const type = 'type' in e.target ? e.target.type : 'text';
        const finalValue = type === 'number' ? (value === '' ? undefined : parseFloat(value)) : value;
        
        setLocalProfile(prev => {
            if (!prev) return null;
            const newProfile = { ...prev, [name]: finalValue as any };
            if (name === 'country') {
                newProfile.ratePerKm = getRateForCountry(value);
                setPassengerSurcharge(getPassengerSurchargeForCountry(value));
            }
            return newProfile;
        });
    };
    
    const handlePersonalizationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setPersonalization(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) : value
        }));
    };

    const handleSaveAllSettings = () => {
        if (localProfile && user) {
            setUserProfile(localProfile);
            markAsSaved(); // Mark as saved after successful save
            showToast(t('settings_alert_saveSuccess'), 'success');
            onClose();
        }
    };
    
    const onClose = () => setCurrentView('dashboard');
    
    const handleClose = async () => {
        const shouldClose = await checkUnsavedChanges();
        if (shouldClose) {
            onClose();
        }
    };
    
    const resetPersonalization = () => {
        setPersonalization({ backgroundImage: '', uiTransparency: 0.2, uiBlur: 16, backgroundBlur: 0 });
    };

    const PRESET_BACKGROUNDS = [
        { id: 'road', url: 'https://images.unsplash.com/photo-1478860409698-8707f313ee8b?q=80&w=1920&auto=format&fit=crop', alt: 'Winding mountain road' },
        { id: 'city', url: 'https://images.unsplash.com/photo-1519817914152-22d216bb9170?q=80&w=1920&auto=format&fit=crop', alt: 'Cityscape at night with light trails' },
        { id: 'forest', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1920&auto=format&fit=crop', alt: 'Sunlight filtering through a forest road' },
    ];
    
    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                showToast(t('toast_error_file_too_large') || 'Archivo demasiado grande (máx 2MB)', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setPersonalization(prev => ({ ...prev, backgroundImage: reader.result as string }));
                showToast('Imagen cargada correctamente', 'success');
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePresetClick = (url: string) => {
        setPersonalization(prev => ({ ...prev, backgroundImage: url }));
    };

    const handleRemoveImage = () => {
        setPersonalization(prev => ({ ...prev, backgroundImage: '' }));
    };


    if (!localProfile) {
        return null; // Don't render if profile isn't loaded
    }

    const renderTabContent = () => {
        switch (activeTab) {
            case 'profile':
                return (
                    <div className="space-y-6">
                        <section>
                            <h2 className="text-xl font-semibold text-white">{t('settings_profile_title')}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <InputField label={t('settings_profile_fullName')} name="name" value={localProfile.name} onChange={handleProfileChange} />
                                <InputField label={t('settings_profile_uid')} name="uid" value={localProfile.uid} onChange={handleProfileChange} />
                                <InputField label={t('settings_profile_licensePlate')} name="licensePlate" value={localProfile.licensePlate} onChange={handleProfileChange} />
                                <InputField label={t('rate_per_km')} name="ratePerKm" type="number" value={localProfile.ratePerKm} onChange={handleProfileChange} />
                                <ReadOnlyField label={t('passenger_surcharge_rate')} value={`€ ${passengerSurcharge.toFixed(2)} / km`} />
                                <div className="md:col-span-2">
                                   <InputField label={t('settings_profile_address')} name="address" value={localProfile.address} onChange={handleProfileChange} />
                                </div>
                                <InputField label={t('settings_profile_city')} name="city" value={localProfile.city} onChange={handleProfileChange} />
                                <InputField label={t('settings_profile_country')} name="country" value={localProfile.country} onChange={handleProfileChange} />
                            </div>
                        </section>
                    </div>
                );
            case 'compliance':
                return (
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                            {t('settings_tab_compliance')}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            <div>
                               <InputField 
                                    label={t('settings_compliance_lock_label')} 
                                    name="lockedUntilDate" 
                                    type="date"
                                    value={localProfile.lockedUntilDate} 
                                    onChange={handleProfileChange} 
                               />
                            </div>
                            <div className="text-sm text-on-surface-dark-secondary bg-background-dark p-4 rounded-lg mt-1 md:mt-6">
                                <p className="font-semibold">{t('settings_compliance_lock_info_title')}</p>
                                <p>{t('settings_compliance_lock_info_desc')}</p>
                            </div>
                        </div>
                    </div>
                );
            case 'api':
                return (
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-white">{t('settings_api_title')}</h2>
                        <div className="space-y-6">
                            <div className="space-y-2 p-4 border border-gray-700 rounded-lg">
                                <h3 className="text-lg font-medium mb-2 text-on-surface-dark">{t('settings_api_ai_title')}</h3>
                                <ProviderConfigContainer>
                                    <InputField 
                                        label={t('settings_api_or_key')}
                                        name="openRouterApiKey" 
                                        value={localProfile.openRouterApiKey} 
                                        onChange={handleProfileChange} 
                                        placeholder="sk-or-..."
                                        type="password"
                                    />
                                    <ModelSelect
                                        id="openRouterModel"
                                        name="openRouterModel"
                                        label={t('settings_api_or_model')}
                                        value={localProfile.openRouterModel}
                                        onChange={handleProfileChange}
                                        isLoading={isFetchingOrModels}
                                        error={fetchOrModelsError}
                                        models={openRouterModels}
                                        disabled={!localProfile.openRouterApiKey}
                                        loadingText={t('settings_api_or_loading')}
                                        errorText={fetchOrModelsError || t('settings_api_or_enter_key')}
                                        noModelsText={t('settings_api_or_enter_key')}
                                        defaultOptionText={t('settings_api_or_select')}
                                    />
                                    <p className="text-xs text-on-surface-dark-secondary mt-1">{t('settings_api_or_info')}</p>
                                </ProviderConfigContainer>
                            </div>
                        </div>
                    </div>
                );
            case 'personalization':
                return (
                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold text-white">{t('settings_personalization_title')}</h2>
                        
                        <div>
                            <label className="block text-sm font-medium text-on-surface-dark-secondary mb-2">{t('settings_personalization_bg_image_label')}</label>
                            {personalization.backgroundImage && (
                                <div className="mb-4">
                                    <p className="text-xs text-on-surface-dark-secondary mb-2">Vista previa actual:</p>
                                    <div 
                                        className="w-full h-20 rounded-lg border border-gray-600 bg-cover bg-center"
                                        style={{
                                            backgroundImage: `url(${personalization.backgroundImage})`,
                                            filter: personalization.backgroundBlur > 0 ? `blur(${personalization.backgroundBlur}px)` : 'none'
                                        }}
                                    />
                                </div>
                            )}
                            <div className="flex flex-col sm:flex-row gap-4">
                                <button onClick={handleUploadClick} className="flex items-center justify-center gap-2 bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                                    <UploadCloud size={18}/>
                                    {t('settings_personalization_upload_image_btn') || 'Subir Imagen'}
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp" />
                                {personalization.backgroundImage && (
                                    <button onClick={handleRemoveImage} className="flex items-center justify-center gap-2 bg-red-600/80 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                                        <ImageOff size={18}/>
                                        {t('settings_personalization_remove_image_btn')}
                                    </button>
                                )}
                            </div>
                        </div>
            
                        <div>
                             <h3 className="text-sm font-medium text-on-surface-dark-secondary mb-2">{t('settings_personalization_presets_title')}</h3>
                             <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                {PRESET_BACKGROUNDS.map(bg => {
                                    const isSelected = personalization.backgroundImage === bg.url;
                                    return (
                                        <div 
                                            key={bg.id} 
                                            onClick={() => handlePresetClick(bg.url)} 
                                            className={`relative aspect-video rounded-md overflow-hidden cursor-pointer group border-2 transition-all ${isSelected ? 'border-brand-primary' : 'border-transparent hover:border-gray-500'}`}
                                            title={bg.alt}
                                        >
                                            <img src={bg.url} alt={bg.alt} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        </div>
                                    )
                                })}
                             </div>
                        </div>
                        
                        <hr className="border-gray-700/50"/>
            
                        <SliderField
                            label={t('settings_personalization_transparency_label')}
                            name="uiTransparency"
                            value={personalization.uiTransparency}
                            onChange={handlePersonalizationChange}
                            min={0} max={0.9} step={0.05}
                            displayValue={`${Math.round(personalization.uiTransparency * 100)}%`}
                        />
                        <SliderField
                            label={t('settings_personalization_blur_label')}
                            name="uiBlur"
                            value={personalization.uiBlur}
                            onChange={handlePersonalizationChange}
                            min={0} max={32} step={1}
                            displayValue={`${personalization.uiBlur}px`}
                        />
                        <SliderField
                            label={t('settings_personalization_bg_blur_label')}
                            name="backgroundBlur"
                            value={personalization.backgroundBlur}
                            onChange={handlePersonalizationChange}
                            min={0} max={20} step={1}
                            displayValue={`${personalization.backgroundBlur}px`}
                        />
                         <button onClick={resetPersonalization} className="text-sm text-brand-primary hover:underline mt-2">
                            {t('settings_personalization_reset_btn')}
                        </button>
                    </div>
                );
            case 'language':
                 return (
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-white">{t('settings_language_title')}</h2>
                        <LanguageSwitcher />
                    </div>
                );
            case 'changelog':
                 return (
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-white">{t('settings_changelog_title')}</h2>
                        <p className="text-on-surface-dark-secondary">{t('settings_changelog_empty')}</p>
                    </div>
                );
            case 'help':
                 return (
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-white">{t('settings_help_title')}</h2>
                        <p className="text-on-surface-dark-secondary">{t('settings_help_empty')}</p>
                    </div>
                );
            default:
                return null;
        }
    };

    const contentStyle = {
        backgroundColor: theme === 'dark'
            ? `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`
            : `rgba(243, 244, 246, ${1 - personalization.uiTransparency})`,
        backdropFilter: `blur(${personalization.uiBlur}px)`,
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={handleClose}>
            <div style={contentStyle} className="rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-700/50 flex-shrink-0">
                    <h2 className="text-xl font-bold text-white">{t('settings_title')}</h2>
                    <button onClick={handleClose} className="text-gray-400 hover:text-white"><XIcon className="w-6 h-6" /></button>
                </header>
                
                <div className="flex-grow flex min-h-0">
                    <nav className="w-1/4 p-4 border-r border-gray-700/50 flex-shrink-0 space-y-1">
                        <TabButton
                            label={t('settings_tab_profile')}
                            isActive={activeTab === 'profile'}
                            onClick={() => setActiveTab('profile')}
                            icon={<UserCircleIcon className="w-5 h-5" />}
                        />
                        <TabButton
                            label={t('settings_tab_compliance')}
                            isActive={activeTab === 'compliance'}
                            onClick={() => setActiveTab('compliance')}
                            icon={<LockIcon className="w-5 h-5" />}
                        />
                        <TabButton
                            label={t('settings_tab_api')}
                            isActive={activeTab === 'api'}
                            onClick={() => setActiveTab('api')}
                            icon={<SparklesIcon className="w-5 h-5" />}
                        />
                        <div className="pt-2 mt-2 border-t border-gray-700/50" />
                        <TabButton
                            label={t('settings_tab_personalization')}
                            isActive={activeTab === 'personalization'}
                            onClick={() => setActiveTab('personalization')}
                            icon={<Palette size={20} />}
                        />
                        <TabButton
                            label={t('settings_tab_language')}
                            isActive={activeTab === 'language'}
                            onClick={() => setActiveTab('language')}
                            icon={<Languages size={20} />}
                        />
                        <div className="pt-2 mt-2 border-t border-gray-700/50" />
                        <TabButton
                            label={t('settings_tab_changelog')}
                            isActive={activeTab === 'changelog'}
                            onClick={() => setActiveTab('changelog')}
                            icon={<Newspaper size={20} />}
                        />
                        <TabButton
                            label={t('settings_tab_help')}
                            isActive={activeTab === 'help'}
                            onClick={() => setActiveTab('help')}
                            icon={<HelpCircle size={20} />}
                        />
                    </nav>

                    <main className="w-3/4 p-6 overflow-y-auto">
                        {renderTabContent()}
                    </main>
                </div>
                
                <footer className="flex justify-between items-center p-4 bg-transparent border-t border-gray-700/50 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        {hasUnsavedChanges && (
                            <>
                                <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                                <span className="text-xs text-orange-400 font-medium">
                                    {t('common_unsaved_indicator')}
                                </span>
                            </>
                        )}
                    </div>
                    <div className="flex gap-4">
                        <button onClick={handleClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">{t('common_cancel')}</button>
                        <button onClick={handleSaveAllSettings} className="flex items-center bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                            <SaveIcon className="w-5 h-5 mr-2"/>
                            {t('settings_saveAll')}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

const TabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void; icon: React.ReactNode }> = ({ label, isActive, onClick, icon }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-sm font-medium ${
            isActive
                ? 'bg-brand-primary/20 text-brand-primary'
                : 'text-on-surface-dark-secondary hover:bg-gray-700/50'
        }`}
    >
        {icon}
        {label}
    </button>
);

const ProviderConfigContainer: React.FC<{children: React.ReactNode}> = ({ children }) => (
    <div className="mt-2 space-y-2 p-3 bg-background-dark/50 rounded-md border border-gray-700/50">
        {children}
    </div>
);

const InputField: React.FC<{label: string, name: string, value?: string | number, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void, type?: string, placeholder?: string, disabled?: boolean}> = ({ label, name, value, onChange, type = 'text', placeholder, disabled = false }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-on-surface-dark-secondary mb-1">{label}</label>
        <input 
            type={type} 
            id={name}
            name={name} 
            value={value ?? ''} 
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            step={type === 'number' ? '0.01' : undefined}
            className="w-full bg-background-dark border border-gray-600 rounded-md p-2 text-on-surface-dark placeholder-gray-300 focus:ring-2 focus:ring-brand-primary focus:outline-none disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed"
        />
    </div>
);

const SliderField: React.FC<{ label: string; name: string; value: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; min: number; max: number; step: number; displayValue?: string; }> = ({ label, name, value, onChange, min, max, step, displayValue }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-on-surface-dark-secondary mb-1 flex justify-between">
            <span>{label}</span>
            <span className="font-mono">{displayValue || value}</span>
        </label>
        <input
            type="range"
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            min={min}
            max={max}
            step={step}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer range-thumb:bg-brand-primary"
            style={{ accentColor: 'var(--brand-primary, #007aff)'}}
        />
    </div>
);

const ModelSelect: React.FC<{
    id: string, name: string, label: string, value?: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void,
    isLoading?: boolean, error?: string | null, models: AiModelInfo[], disabled?: boolean,
    loadingText?: string, errorText?: string, noModelsText?: string, defaultOptionText?: string
}> = ({ id, name, label, value, onChange, isLoading, error, models, disabled, loadingText, errorText, noModelsText, defaultOptionText }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-on-surface-dark-secondary mb-1">{label}</label>
        <select
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            disabled={disabled || isLoading || !!error || models.length === 0}
            className="w-full bg-background-dark border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-brand-primary focus:outline-none disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
            {isLoading ? (
                <option>{loadingText || 'Loading...'}</option>
            ) : error ? (
                <option>{errorText || 'Error loading models'}</option>
            ) : models.length > 0 ? (
                <>
                    {defaultOptionText && <option value="">{defaultOptionText}</option>}
                    {models.map(model => (
                        <option key={model.id} value={model.id}>{model.name || model.id}</option>
                    ))}
                </>
            ) : (
                <option>{noModelsText || 'No models available'}</option>
            )}
        </select>
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
);

const ReadOnlyField: React.FC<{label: string, value: string}> = ({ label, value }) => (
    <div>
        <label className="block text-sm font-medium text-on-surface-dark-secondary mb-1">{label}</label>
        <div className="w-full bg-background-dark border border-gray-600 rounded-md p-2 text-on-surface-dark-secondary">
            {value}
        </div>
    </div>
);

export default SettingsView;
