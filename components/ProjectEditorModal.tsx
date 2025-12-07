
import React, { useState, useEffect } from 'react';
import { Project, PersonalizationSettings } from '../types';
import { XIcon, LoaderIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import useToast from '../hooks/useToast';
import useTrips from '../hooks/useTrips';
import useUnsavedChanges from '../hooks/useUnsavedChanges';
import { Button } from './Button';

interface ProjectEditorModalProps {
  project: Project | null;
  onClose: () => void;
  personalization?: PersonalizationSettings;
  theme?: 'light' | 'dark';
}

const ProjectEditorModal: React.FC<ProjectEditorModalProps> = ({ project, onClose, personalization, theme }) => {
  const { addProject, updateProject } = useTrips();
  const [formState, setFormState] = useState({ name: '', producer: '', ratePerKm: '' as string | number });
  const [isSaving, setIsSaving] = useState(false);
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

  const handleSave = async () => {
    if (isSaving) return;

    if (!formState.name || !formState.producer) {
      showToast(t('projects_alert_fillFields'), 'error');
      return;
    }

    setIsSaving(true);
    try {
      const rateToSave = formState.ratePerKm === '' || isNaN(Number(formState.ratePerKm)) ? undefined : Number(formState.ratePerKm);

      if (project) {
        await updateProject({ ...(project as any), name: formState.name, producer: formState.producer, ratePerKm: rateToSave } as any);
      } else {
        await addProject({ name: formState.name, producer: formState.producer, ratePerKm: rateToSave } as any);
      }

      // Mark as saved after successful save
      markAsSaved();
      onClose();
    } catch (error) {
      console.error('Failed to save project:', error);
      showToast(t('common_error_unknown'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = async () => {
    const shouldClose = await checkUnsavedChanges();
    if (shouldClose) {
      onClose();
    }
  };

  const isEditing = !!project;

  // Dynamic modal style based on personalization
  const modalStyle = personalization ? {
    backgroundColor: `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`,
    backdropFilter: `blur(${personalization.uiBlur}px)`,
    WebkitBackdropFilter: `blur(${personalization.uiBlur}px)`,
  } : {};

  return (
    <div id="project-editor-modal" className="fixed inset-0 z-50 flex items-start justify-center px-4 py-16 overflow-y-auto bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div style={modalStyle} className="relative w-full max-w-lg bg-frost-glass border border-gray-700/60 rounded-lg shadow-2xl flex flex-col max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between px-6 py-4 border-b border-gray-700/60">
          <h2 id="project-editor-title" className="text-lg font-semibold tracking-tight text-white">
            {isEditing ? t('projectEditor_title_edit') : t('projectEditor_title_add')}
          </h2>
          <Button
            id="project-editor-close"
            variant="icon"
            onClick={handleClose}
            aria-label={t('common_close')}
            title={t('common_close')}
          >
            <XIcon className="w-5 h-5" />
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-5">
            <InputField id="project-editor-name" label={t('projects_form_projectName')} name="name" value={formState.name} onChange={handleInputChange} />
            <InputField id="project-editor-producer" label={t('projects_form_producer')} name="producer" value={formState.producer} onChange={handleInputChange} />
            <InputField
              id="project-editor-rate"
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
        <footer className="flex justify-between items-center px-6 py-4 border-t border-gray-700/60 bg-background-dark/40" id="project-editor-actions">
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
            <Button
              id="project-editor-cancel"
              variant="secondary"
              size="sm"
              onClick={handleClose}
            >
              {t('common_cancel')}
            </Button>
            <Button
              id="project-editor-save"
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving && <LoaderIcon className="w-4 h-4 animate-spin mr-2" />}
              {isEditing ? t('projects_form_saveBtn') : t('projects_form_addBtn')}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
};

const InputField: React.FC<{
  id?: string,
  label: string,
  name: string,
  value: string,
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
  type?: string,
  placeholder?: string
}> = ({ id, label, name, value, onChange, type = 'text', placeholder }) => {
  const inputId = id || name;
  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-on-surface-dark-secondary mb-1">{label}</label>
      <input
        type={type}
        id={inputId}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-background-dark border border-gray-600 rounded-md p-2 text-on-surface-dark placeholder-gray-500 focus:ring-2 focus:ring-brand-primary focus:outline-none"
      />
    </div>
  );
};

export default ProjectEditorModal;
