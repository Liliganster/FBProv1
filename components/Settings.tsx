import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, AiModelInfo, View, PersonalizationSettings } from '../types';
import { SaveIcon, LockIcon, XIcon, UserCircleIcon, SparklesIcon, TrashIcon, LoaderIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import useToast from '../hooks/useToast';
import useUnsavedChanges from '../hooks/useUnsavedChanges';
import { fetchOpenRouterModels } from '../services/aiService';
import { getRateForCountry, getPassengerSurchargeForCountry } from '../services/taxService';
import useUserProfile from '../hooks/useUserProfile';
import { useAuth } from '../hooks/useAuth';
import { databaseService } from '../services/databaseService';
import LanguageSwitcher from './LanguageSwitcher';
import {
  LuPalette as Palette,
  LuLanguages as Languages,
  LuNewspaper as Newspaper,
  LuCircleHelp as HelpCircle,
  LuCloudUpload as UploadCloud,
  LuImageOff as ImageOff,
  LuFileText as FileText,
} from 'react-icons/lu';

type Tab = 'profile' | 'compliance' | 'api' | 'personalization' | 'language' | 'changelog' | 'help';

const SettingsView: React.FC<{ 
    setCurrentView: (view: View) => void;
    personalization: PersonalizationSettings;
    setPersonalization: React.Dispatch<React.SetStateAction<PersonalizationSettings>>;
    theme: 'light' | 'dark';
}> = ({ setCurrentView, personalization, setPersonalization, theme }) => {
    const { userProfile, setUserProfile } = useUserProfile();
    const { user, logout } = useAuth();
    const [localProfile, setLocalProfile] = useState<UserProfile | null>(userProfile);
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [passengerSurcharge, setPassengerSurcharge] = useState<number>(0);
    const [openRouterModels, setOpenRouterModels] = useState<AiModelInfo[]>([]);
    const [isFetchingOrModels, setIsFetchingOrModels] = useState(false);
    const [fetchOrModelsError, setFetchOrModelsError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('profile');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const showExtractorUi = (import.meta as any)?.env?.VITE_ENABLE_EXTRACTOR_UI === 'true';

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
            setIsFetchingOrModels(true);
            setFetchOrModelsError(null);
            setOpenRouterModels([]);
            try {
                // If user has entered an API key, pass it; otherwise allow server to use default key
                const models = await fetchOpenRouterModels(localProfile.openRouterApiKey || undefined);
                if (models.length === 0) {
                    setFetchOrModelsError(t('settings_api_or_no_models') || 'No models available. Please check your API key.');
                } else {
                    setOpenRouterModels(models);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
                console.error('[Settings] Error fetching OpenRouter models:', errorMessage);
                setFetchOrModelsError(errorMessage);
            } finally {
                setIsFetchingOrModels(false);
            }
        };
        fetchModels();
    }, [localProfile?.openRouterApiKey, t]);

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

    const openDeleteModal = () => {
        setDeleteConfirmation('');
        setIsDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        if (isDeletingAccount) return;
        setIsDeleteModalOpen(false);
        setDeleteConfirmation('');
    };

    const handleDeleteAccount = async () => {
        if (!user?.id) return;
        setIsDeletingAccount(true);
        try {
            await databaseService.deleteUserAccountData(user.id);
            showToast(t('settings_delete_account_success'), 'success');
            setIsDeleteModalOpen(false);
            setDeleteConfirmation('');
            await logout();
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : t('settings_delete_account_error') || 'Failed to delete account';
            showToast(message, 'error');
        } finally {
            setIsDeletingAccount(false);
        }
    };


    if (!localProfile) {
        return null; // Don't render if profile isn't loaded
    }

    const isDeleteConfirmationValid = deleteConfirmation.trim().toUpperCase() === 'DELETE';

    const renderTabContent = () => {
        switch (activeTab) {
            case 'profile':
                return (
                    <div className="space-y-6">
                        <section>
                            <h2 className="text-xl font-semibold bg-gradient-to-r from-white to-brand-primary bg-clip-text text-transparent">{t('settings_profile_title')}</h2>
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
                        <section className="border border-red-500/40 bg-red-500/10 rounded-md p-4">
                            <h3 className="text-lg font-semibold text-red-300 mb-2 flex items-center gap-2">
                                <TrashIcon className="w-5 h-5" />
                                {t('settings_delete_account_title')}
                            </h3>
                            <p className="text-sm text-on-surface-dark-secondary mb-4">
                                {t('settings_delete_account_description')}
                            </p>
                            <button
                                onClick={openDeleteModal}
                                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                            >
                                <TrashIcon className="w-4 h-4" />
                                {t('settings_delete_account_button')}
                            </button>
                        </section>
                    </div>
                );
            case 'compliance':
                return (
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2 bg-gradient-to-r from-white to-brand-primary bg-clip-text text-transparent">
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
                                        loadingText={t('settings_api_or_loading')}
                                        errorText={fetchOrModelsError || t('settings_api_or_enter_key')}
                                        noModelsText={t('settings_api_or_enter_key')}
                                        defaultOptionText={t('settings_api_or_select')}
                                    />
                                    <p className="text-xs text-on-surface-dark-secondary mt-1">{t('settings_api_or_info')}</p>
                                </ProviderConfigContainer>
                            </div>
                            
                            {showExtractorUi && (
                            <div className="space-y-2 p-4 border border-brand-primary/30 rounded-lg bg-brand-primary/5">
                                <h3 className="text-lg font-medium mb-2 text-on-surface-dark flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-brand-primary" />
                                </h3>
                                <p className="text-sm text-on-surface-dark-secondary mb-3">
                                    Extrae datos de hojas de rodaje automáticamente usando inteligencia artificial. Soporta PDFs, imágenes y texto.
                                </p>
                                <button
                                    className="inline-flex items-center gap-2 bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                                >
                                    <SparklesIcon className="w-4 h-4" />
                                </button>
                            </div>
                            )}
                        </div>
                    </div>
                );
            case 'personalization':
                return (
                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold bg-gradient-to-r from-white to-brand-primary bg-clip-text text-transparent">{t('settings_personalization_title')}</h2>
                        
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
                         <button onClick={resetPersonalization} className="text-sm text-green-500 hover:text-green-400 hover:underline mt-2">
                            {t('settings_personalization_reset_btn')}
                        </button>
                    </div>
                );
            case 'language':
                 return (
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold bg-gradient-to-r from-white to-brand-primary bg-clip-text text-transparent">{t('settings_language_title')}</h2>
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
        <div className="fixed inset-0 bg-gradient-overlay backdrop-blur-glass flex items-center justify-center p-4 z-50" onClick={handleClose}>
            <div className="bg-frost-glass no-border rounded-organic shadow-glass-lg w-full max-w-4xl max-h-[90vh] flex flex-col backdrop-blur-glass relative" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 flex-shrink-0">
                    <h2 className="text-xl font-bold bg-gradient-title bg-clip-text text-transparent">{t('settings_title')}</h2>
                    <button onClick={handleClose} className="text-on-surface-secondary hover:text-white hover:bg-gradient-surface rounded-smooth p-1 transition-all duration-200"><XIcon className="w-6 h-6" /></button>
                </header>
                
                <div className="flex-grow flex min-h-0">
                    <nav className="w-1/4 p-4 border-r border-glass flex-shrink-0 space-y-1">
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
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] text-on-surface-dark-secondary">
                          Build: {typeof __COMMIT_HASH__ !== 'undefined' && __COMMIT_HASH__ ? __COMMIT_HASH__.slice(0,7) : 'local'} @ {typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev'}
                        </span>
                        <button onClick={handleClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-smooth">{t('common_cancel')}</button>
                        <button onClick={handleSaveAllSettings} className="flex items-center bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-smooth transition-colors">
                            <SaveIcon className="w-5 h-5 mr-2"/>
                            {t('settings_saveAll')}
                        </button>
                    </div>
                </footer>

                {isDeleteModalOpen && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-surface-dark border border-red-500/40 rounded-lg shadow-lg w-full max-w-md p-6 space-y-4">
                            <h3 className="text-xl font-semibold text-red-300 flex items-center gap-2">
                                <TrashIcon className="w-5 h-5" />
                                {t('settings_delete_account_confirm_title')}
                            </h3>
                            <p className="text-sm text-on-surface-dark-secondary">
                                {t('settings_delete_account_confirm_body')}
                            </p>
                            <p className="text-xs text-red-300">
                                {t('settings_delete_account_confirm_instruction')}
                            </p>
                            <input
                                type="text"
                                value={deleteConfirmation}
                                onChange={(e) => setDeleteConfirmation(e.target.value)}
                                placeholder={t('settings_delete_account_confirm_placeholder')}
                                className="w-full bg-background-dark border border-red-500/50 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                disabled={isDeletingAccount}
                            />
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={closeDeleteModal}
                                    className="px-4 py-2 rounded-md border border-gray-600 text-sm text-on-surface-secondary hover:text-white transition-colors disabled:opacity-60"
                                    disabled={isDeletingAccount}
                                >
                                    {t('common_cancel')}
                                </button>
                                <button
                                    onClick={handleDeleteAccount}
                                    disabled={!isDeleteConfirmationValid || isDeletingAccount}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-sm font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isDeletingAccount ? (
                                        <>
                                            <LoaderIcon className="w-4 h-4 animate-spin" />
                                            {t('settings_delete_account_processing')}
                                        </>
                                    ) : (
                                        <>
                                            <TrashIcon className="w-4 h-4" />
                                            {t('settings_delete_account_confirm_button')}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
        </div>
    );
};

const TabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void; icon: React.ReactNode }> = ({ label, isActive, onClick, icon }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-sm font-medium ${
            isActive
                ? 'text-white'
                : 'text-on-surface-dark-secondary hover:bg-gray-700/50'
        }`}
        style={isActive ? { backgroundColor: 'rgba(26, 26, 26, 0.8)' } : undefined}
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
            className="w-full bg-background-dark border border-gray-600 rounded-md p-2 text-on-surface-dark placeholder-gray-500 focus:ring-2 focus:ring-brand-primary focus:outline-none disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed"
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
}> = ({ id, name, label, value, onChange, isLoading, error, models, disabled, loadingText, errorText, noModelsText, defaultOptionText }) => {
    const hasError = !!error;
    const isEmpty = !isLoading && !hasError && models.length === 0;
    // Keep the select interactive unless explicitly disabled or loading
    const isDisabled = !!disabled || !!isLoading;

    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-on-surface-dark-secondary mb-1">{label}</label>
            <select
                id={id}
                name={name}
                value={value || ''}
                onChange={onChange}
                disabled={isDisabled}
                className={`w-full bg-background-dark border rounded-md p-2 focus:ring-2 focus:ring-brand-primary focus:outline-none disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed ${
                    hasError ? 'border-red-500' : 'border-gray-600'
                }`}
            >
                {isLoading ? (
                    <option>{loadingText || 'Loading models...'}</option>
                ) : hasError ? (
                    <option>{errorText || 'Error loading models'}</option>
                ) : isEmpty ? (
                    <option>{noModelsText || 'No models available'}</option>
                ) : (
                    <>
                        {defaultOptionText && <option value="">{defaultOptionText}</option>}
                        {models.map(model => (
                            <option key={model.id} value={model.id}>{model.name || model.id}</option>
                        ))}
                    </>
                )}
            </select>
            {hasError && (
                <div className="mt-2 p-2 bg-red-900/20 border border-red-500/50 rounded text-xs text-red-300">
                    <p className="font-semibold">Error:</p>
                    <p>{error}</p>
                </div>
            )}
            {isEmpty && !disabled && (
                <p className="text-yellow-400 text-xs mt-1">Please enter a valid OpenRouter API key above.</p>
            )}
        </div>
    );
};

const ReadOnlyField: React.FC<{label: string, value: string}> = ({ label, value }) => (
    <div>
        <label className="block text-sm font-medium text-on-surface-dark-secondary mb-1">{label}</label>
        <div className="w-full bg-background-dark border border-gray-600 rounded-md p-2 text-on-surface-dark-secondary">
            {value}
        </div>
    </div>
);

export default SettingsView;
