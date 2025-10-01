import React, { useState } from 'react';
import { Project } from '../types';
import { XIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';

interface BatchEditModalProps {
  onClose: () => void;
  onSave: (updates: { projectId?: string; reason?: string }) => void;
  projects: Project[];
  selectedTripCount: number;
}

const BatchEditModal: React.FC<BatchEditModalProps> = ({ onClose, onSave, projects, selectedTripCount }) => {
  const [newProjectId, setNewProjectId] = useState('');
  const [newReason, setNewReason] = useState('');
  const { t } = useTranslation();

  const handleSave = () => {
    const updates: { projectId?: string; reason?: string } = {};
    if (newProjectId) updates.projectId = newProjectId;
    if (newReason.trim()) updates.reason = newReason.trim();
    
    if (Object.keys(updates).length > 0) {
      onSave(updates);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 bg-black/60 backdrop-blur-sm">
      <div className="bg-background-dark/95 border border-gray-700/60 rounded-lg shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-fadeIn">
        <header className="px-5 py-4 border-b border-gray-700/70 flex items-center justify-between bg-background-dark/70 backdrop-blur-sm">
          <h2 className="text-lg font-semibold tracking-tight text-white">
            {t('batch_edit_title', { count: selectedTripCount })}
          </h2>
          <button onClick={onClose} className="text-on-surface-dark-secondary hover:text-white p-2 rounded-md hover:bg-gray-700/40 focus:outline-none focus:ring-2 focus:ring-brand-primary/60">
            <XIcon className="w-5 h-5" />
          </button>
        </header>
        <main className="px-6 py-5 space-y-6">
          <div>
            <label htmlFor="batch-project" className="block text-xs font-medium uppercase tracking-wide text-on-surface-dark-secondary mb-2">
              {t('batch_edit_change_project')}
            </label>
            <select
              id="batch-project"
              value={newProjectId}
              onChange={(e) => setNewProjectId(e.target.value)}
              className="w-full bg-background-dark border border-gray-600/70 rounded-md px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-brand-primary focus:outline-none hover:border-gray-500"
            >
              <option value="">{t('batch_edit_project_placeholder')}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="batch-reason" className="block text-xs font-medium uppercase tracking-wide text-on-surface-dark-secondary mb-2">
              {t('batch_edit_change_reason')}
            </label>
            <input
              type="text"
              id="batch-reason"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder={t('batch_edit_reason_placeholder')}
              className="w-full bg-background-dark border border-gray-600/70 rounded-md px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-brand-primary focus:outline-none hover:border-gray-500"
            />
          </div>
        </main>
        <footer className="px-6 py-4 border-t border-gray-700/70 bg-background-dark/70 backdrop-blur-sm flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/60">
            {t('common_cancel')}
          </button>
          <button onClick={handleSave} className="px-5 py-2 text-sm bg-brand-primary hover:brightness-110 text-white rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/60">
            {t('batch_edit_save_btn')}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default BatchEditModal;