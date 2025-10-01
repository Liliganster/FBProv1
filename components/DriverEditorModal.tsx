import React, { useState, useEffect, useRef } from 'react';
// FIX: Use UserProfile as Driver since Driver type was merged.
import { UserProfile as Driver } from '../types';
import { XIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import useToast from '../hooks/useToast';
import Avatar from './Avatar';
import { getRateForCountry, getPassengerSurchargeForCountry } from '../services/taxService';

interface DriverEditorModalProps {
  driver: Driver | null;
  onSave: (driver: Omit<Driver, 'id'> | Driver) => void;
  onClose: () => void;
}

const DriverEditorModal: React.FC<DriverEditorModalProps> = ({ driver, onSave, onClose }) => {
  const [formData, setFormData] = useState<Partial<Driver>>({
    name: '',
    licensePlate: '',
    uid: '',
    address: '',
    city: '',
    country: '',
    color: '#374151',
    profilePicture: '',
    ratePerKm: undefined,
  });
  const [passengerSurcharge, setPassengerSurcharge] = useState<number>(0);
  const { t } = useTranslation();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (driver) {
      setFormData({
        name: '',
        licensePlate: '',
        uid: '',
        address: '',
        city: '',
        country: '',
        color: '#374151',
        profilePicture: '',
        ratePerKm: undefined,
        ...driver,
      });
      setPassengerSurcharge(getPassengerSurchargeForCountry(driver.country));
    } else {
        const country = '';
        setFormData(prev => ({...prev, ratePerKm: getRateForCountry(country)}));
        setPassengerSurcharge(getPassengerSurchargeForCountry(country));
    }
  }, [driver]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => {
        const newFormData = {
            ...prev,
            [name]: type === 'number' ? (value === '' ? undefined : parseFloat(value)) : value
        };

        if (name === 'country') {
            newFormData.ratePerKm = getRateForCountry(value);
            setPassengerSurcharge(getPassengerSurchargeForCountry(value));
        }

        return newFormData;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        showToast('File size should not exceed 2MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, profilePicture: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!formData.name) {
      showToast(t('projects_alert_fillFields'), 'error');
      return;
    }
    onSave(formData as Driver);
  };

  const isEditing = !!driver;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-16 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl bg-background-dark/95 border border-gray-700/60 rounded-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        <header className="flex items-start justify-between px-6 py-4 border-b border-gray-700/60">
          <h2 className="text-lg font-semibold text-white tracking-tight">
            {isEditing ? t('driverEditor_title_edit') : t('driverEditor_title_add')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-colors"
            aria-label={t('common_close')}
          >
            <XIcon className="w-5 h-5" />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col md:flex-row gap-10">
            {/* Left column: avatar + color */}
            <div className="w-full md:w-1/3 space-y-6 flex-shrink-0">
              <div className="space-y-3">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-300/90">{t('driverEditor_profile_picture')}</label>
                <div className="flex justify-center">
                  <div
                    className="relative cursor-pointer group"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {/* FIX: Use 'profile' prop instead of 'driver' for Avatar component */}
                    <Avatar profile={formData} className="w-32 h-32 ring-2 ring-gray-700/60 rounded-full" />
                    <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <p className="text-white text-xs font-medium tracking-wide">Change</p>
                    </div>
                  </div>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="color" className="block text-[11px] font-semibold uppercase tracking-wide text-gray-300/90">{t('driverEditor_color')}</label>
                <input
                  type="color"
                  id="color"
                  name="color"
                  value={formData.color || '#374151'}
                  onChange={handleChange}
                  className="w-full h-12 p-1 bg-background-dark/70 border border-gray-600/70 rounded-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                />
              </div>
              <div className="pt-1 text-[11px] text-gray-400 leading-snug">
                <p>{t('driverEditor_hint_autorate') ?? ''}</p>
              </div>
            </div>
            {/* Right column: form fields */}
            <div className="w-full md:w-2/3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <InputField label={t('driverEditor_name')} name="name" value={formData.name} onChange={handleChange} />
                </div>
                <InputField label={t('driverEditor_uid')} name="uid" value={formData.uid} onChange={handleChange} />
                <InputField label={t('driverEditor_license_plate')} name="licensePlate" value={formData.licensePlate} onChange={handleChange} />
                <div className="md:col-span-2">
                  <InputField label={t('driverEditor_address')} name="address" value={formData.address} onChange={handleChange} />
                </div>
                <InputField label={t('driverEditor_city')} name="city" value={formData.city} onChange={handleChange} />
                <InputField label={t('driverEditor_country')} name="country" value={formData.country} onChange={handleChange} />
                <InputField label={t('rate_per_km')} name="ratePerKm" type="number" value={formData.ratePerKm} onChange={handleChange} />
                <ReadOnlyField label={t('passenger_surcharge_rate')} value={`€ ${passengerSurcharge.toFixed(2)} / km`} />
              </div>
            </div>
          </div>
        </main>
        <footer className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700/60 bg-background-dark/40">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-md text-sm font-medium bg-gray-600/40 hover:bg-gray-600 text-gray-200 border border-gray-500/60 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
          >
            {t('common_cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2.5 rounded-md text-sm font-medium bg-brand-primary hover:brightness-110 text-white shadow focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
          >
            {isEditing ? t('driverEditor_save_btn') : t('driverEditor_add_btn')}
          </button>
        </footer>
      </div>
    </div>
  );
};

const InputField: React.FC<{
  label: string,
  name: string,
  value?: string | number,
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
  type?: string,
  placeholder?: string
}> = ({ label, name, value, onChange, type = 'text', placeholder }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-on-surface-dark-secondary mb-1">{label}</label>
    <input
      type={type}
      id={name}
      name={name}
      value={value ?? ''}
      onChange={onChange}
      placeholder={placeholder}
      step={type === 'number' ? '0.01' : undefined}
      className="w-full bg-background-dark border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-brand-primary focus:outline-none"
    />
  </div>
);

const ReadOnlyField: React.FC<{ label: string; value: string; }> = ({ label, value }) => (
    <div>
        <label className="block text-sm font-medium text-on-surface-dark-secondary mb-1">{label}</label>
        <div className="w-full bg-background-dark border border-gray-600 rounded-md p-2 text-on-surface-dark-secondary">
            {value}
        </div>
    </div>
);


export default DriverEditorModal;