import React, { useState, useEffect } from 'react';
import useTranslation from '../hooks/useTranslation';
import useToast from '../hooks/useToast';
import useUserProfile from '../hooks/useUserProfile';
import { UserProfile, PersonalizationSettings } from '../types';
import { LuSave as SaveIcon, LuX as X } from 'react-icons/lu';

interface VehicleSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    personalization: PersonalizationSettings;
}

const VehicleInputField: React.FC<{
    label: string;
    name: string;
    value?: string | number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    placeholder?: string;
}> = ({ label, name, value, onChange, type = 'text', placeholder }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-2">
            {label}
        </label>
        <input
            type={type}
            id={name}
            name={name}
            value={value ?? ''}
            onChange={onChange}
            placeholder={placeholder}
            step={type === 'number' ? '0.01' : undefined}
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-white focus:ring-2 focus:ring-brand-primary focus:outline-none"
        />
    </div>
);

const VehicleSettingsModal: React.FC<VehicleSettingsModalProps> = ({ isOpen, onClose, personalization }) => {
    const { t } = useTranslation();
    const { userProfile, setUserProfile } = useUserProfile();
    const { showToast } = useToast();
    const [vehicleForm, setVehicleForm] = useState<UserProfile | null>(null);

    useEffect(() => {
        if (isOpen && userProfile) {
            setVehicleForm({ ...userProfile });
        }
    }, [isOpen, userProfile]);

    const handleVehicleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (!vehicleForm) return;
        const { name, value } = e.target;
        const type = 'type' in e.target ? e.target.type : 'text';
        const finalValue = type === 'number' ? (value === '' ? undefined : parseFloat(value)) : value;

        setVehicleForm(prev => {
            if (!prev) return null;
            return { ...prev, [name]: finalValue as any };
        });
    };

    const handleSaveVehicleSettings = async () => {
        if (vehicleForm) {
            try {
                await setUserProfile(vehicleForm);
                showToast(t('settings_alert_saveSuccess'), 'success');
                onClose();
            } catch (error) {
                console.error("Failed to save vehicle settings:", error);
                showToast("Error saving settings", "error");
            }
        }
    };

    if (!isOpen || !vehicleForm) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div
                style={{
                    backgroundColor: `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`,
                    backdropFilter: `blur(${personalization.uiBlur}px)`,
                }}
                className="bg-frost-glass rounded-organic shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative z-10"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white">{t('settings_vehicle_title')}</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Tipo de Vehículo */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('settings_vehicle_type')}
                                </label>
                                <select
                                    name="vehicleType"
                                    value={vehicleForm.vehicleType || ''}
                                    onChange={handleVehicleFormChange}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-white focus:ring-2 focus:ring-brand-primary focus:outline-none"
                                >
                                    <option value="">{t('settings_vehicle_type_select')}</option>
                                    <option value="combustion">{t('settings_vehicle_type_combustion')}</option>
                                    <option value="electric">{t('settings_vehicle_type_electric')}</option>
                                </select>
                            </div>

                            {/* Campos específicos para combustión */}
                            {vehicleForm.vehicleType === 'combustion' && (
                                <>
                                    <VehicleInputField
                                        label={t('settings_vehicle_fuel_consumption')}
                                        name="fuelConsumption"
                                        type="number"
                                        value={vehicleForm.fuelConsumption}
                                        onChange={handleVehicleFormChange}
                                        placeholder="l/100km"
                                    />
                                    <VehicleInputField
                                        label={t('settings_vehicle_fuel_price')}
                                        name="fuelPrice"
                                        type="number"
                                        value={vehicleForm.fuelPrice}
                                        onChange={handleVehicleFormChange}
                                        placeholder="€/l"
                                    />
                                </>
                            )}

                            {/* Campos específicos para eléctrico */}
                            {vehicleForm.vehicleType === 'electric' && (
                                <>
                                    <VehicleInputField
                                        label={t('settings_vehicle_energy_consumption')}
                                        name="energyConsumption"
                                        type="number"
                                        value={vehicleForm.energyConsumption}
                                        onChange={handleVehicleFormChange}
                                        placeholder="kWh/100km"
                                    />
                                    <VehicleInputField
                                        label={t('settings_vehicle_energy_price')}
                                        name="energyPrice"
                                        type="number"
                                        value={vehicleForm.energyPrice}
                                        onChange={handleVehicleFormChange}
                                        placeholder="€/kWh"
                                    />
                                </>
                            )}
                        </div>

                        {/* Costos adicionales */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <VehicleInputField
                                label={t('settings_vehicle_maintenance_cost')}
                                name="maintenanceCostPerKm"
                                type="number"
                                value={vehicleForm.maintenanceCostPerKm}
                                onChange={handleVehicleFormChange}
                                placeholder="€/km"
                            />
                            <VehicleInputField
                                label={t('settings_vehicle_parking_cost')}
                                name="parkingCostPerKm"
                                type="number"
                                value={vehicleForm.parkingCostPerKm}
                                onChange={handleVehicleFormChange}
                                placeholder="€/km"
                            />
                            <VehicleInputField
                                label={t('settings_vehicle_tolls_cost')}
                                name="tollsCostPerKm"
                                type="number"
                                value={vehicleForm.tollsCostPerKm}
                                onChange={handleVehicleFormChange}
                                placeholder="€/km"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <VehicleInputField
                                label={t('settings_vehicle_fines_cost')}
                                name="finesCostPerKm"
                                type="number"
                                value={vehicleForm.finesCostPerKm}
                                onChange={handleVehicleFormChange}
                                placeholder="€/km"
                            />
                            <VehicleInputField
                                label={t('settings_vehicle_misc_cost')}
                                name="miscCostPerKm"
                                type="number"
                                value={vehicleForm.miscCostPerKm}
                                onChange={handleVehicleFormChange}
                                placeholder="€/km"
                            />
                        </div>

                        {/* Botones */}
                        <div className="flex justify-end gap-4 pt-6 border-t border-gray-700">
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                            >
                                {t('common_cancel')}
                            </button>
                            <button
                                onClick={handleSaveVehicleSettings}
                                className="px-6 py-2 bg-brand-primary hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
                            >
                                <SaveIcon size={16} />
                                {t('advanced_costing_save_settings_btn')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VehicleSettingsModal;
