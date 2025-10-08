
import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import { XIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import useToast from '../hooks/useToast';
import useTrips from '../hooks/useTrips';
import useUnsavedChanges from '../hooks/useUnsavedChanges';

interface ProjectEditorModalProps {
  project: Project | null;
  onClose: () => void;
}

const ProjectEditorModal: React.FC<ProjectEditorModalProps> = ({ project, onClose }) => {
  const { addProject, updateProject } = useTrips();
  const [formState, setFormState] = useState({ name: '', producer: '', ratePerKm: '' as string | number });
  const [initialFormState, setInitialFormState] = useState(formState);
  const { t } = useTranslation();
  const { showToast } = useToast();

  // Initialize unsaved changes tracker
  const { hasUnsavedChanges, markAsSaved, checkUnsavedChanges, resetInitialData } = useUnsavedChanges(
    initialFormState,
    formState,
    {
      enableBeforeUnload: true,
      confirmationMessage: t('common_unsaved_changes_warning')
    }
  );

  useEffect(() => {
    const newFormState = project 
      ? { name: project.name, producer: project.producer, ratePerKm: (project as any).ratePerKm ?? '' }
      : { name: '', producer: '', ratePerKm: '' };
    
    setFormState(newFormState);
    setInitialFormState(newFormState);
    resetInitialData(newFormState);
  }, [project, resetInitialData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormState(prev => ({ ...prev, [name]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value }));
  };

  const handleSave = () => {
    if (!formState.name || !formState.producer) {
      showToast(t('projects_alert_fillFields'), 'error');
      return;
    }

    const rateToSave = formState.ratePerKm === '' || isNaN(Number(formState.ratePerKm)) ? undefined : Number(formState.ratePerKm);

    if (project) {
      updateProject({ ...(project as any), name: formState.name, producer: formState.producer, ratePerKm: rateToSave } as any);
    } else {
      addProject({ name: formState.name, producer: formState.producer, ratePerKm: rateToSave } as any);
    }
    
    // Mark as saved after successful save
    markAsSaved();
    onClose();
  };

  const handleClose = async () => {
    const shouldClose = await checkUnsavedChanges();
    if (shouldClose) {
      onClose();
    }
  };

  const isEditing = !!project;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-16 overflow-y-auto bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-background-dark/95 border border-gray-700/60 rounded-lg shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
        <header className="flex items-start justify-between px-6 py-4 border-b border-gray-700/60">
          <h2 className="text-lg font-semibold tracking-tight text-white">
            {isEditing ? t('projectEditor_title_edit') : t('projectEditor_title_add')}
          </h2>
          <button
            onClick={handleClose}
            aria-label={t('common_close')}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-5">
            <InputField label={t('projects_form_projectName')} name="name" value={formState.name} onChange={handleInputChange} />
            <InputField label={t('projects_form_producer')} name="producer" value={formState.producer} onChange={handleInputChange} />
            <InputField
              label={t('rate_per_km_project')}
              name="ratePerKm"
              value={String(formState.ratePerKm)}
              onChange={handleInputChange}
              type="number"
              placeholder={t('rate_per_km_project_placeholder')}
            />
            <p className="text-[11px] leading-snug text-gray-400 pt-1">
              {t('projectEditor_hint_optionalRate') ?? ''}
            </p>
          </div>
        </main>
        <footer className="flex justify-between items-center px-6 py-4 border-t border-gray-700/60 bg-background-dark/40">
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
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2.5 rounded-md text-sm font-medium bg-gray-600/40 hover:bg-gray-600 text-gray-200 border border-gray-500/60 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            >
              {t('common_cancel')}
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2.5 rounded-md text-sm font-medium bg-brand-primary hover:brightness-110 text-white shadow focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
            >
              {isEditing ? t('projects_form_saveBtn') : t('projects_form_addBtn')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

const InputField: React.FC<{
  label: string,
  name: string,
  value: string,
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
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full bg-background-dark border border-gray-600 rounded-md p-2 text-on-surface-dark placeholder-gray-500 focus:ring-2 focus:ring-brand-primary focus:outline-none"
    />
  </div>
);

export default ProjectEditorModal;
