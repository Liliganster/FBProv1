import React, { useMemo, useState } from 'react';
import { LuPlus as Plus, LuArrowLeft as ArrowLeft, LuTrash2 as Trash2, LuPencilLine as Edit2 } from 'react-icons/lu';
import useTranslation from '../hooks/useTranslation';
import useRouteTemplates from '../hooks/useRouteTemplates';
import useUndoRedo from '../hooks/useUndoRedo';
import useToast from '../hooks/useToast';
import UndoToast from './UndoToast';
import { RouteTemplate } from '../types';
import { Button } from './Button';

interface RouteTemplatesViewProps {
  onBack: () => void;
  theme: 'light' | 'dark';
  personalization: { uiTransparency: number; uiBlur: number };
}

const categoryOrder: RouteTemplate['category'][] = ['business', 'commute', 'client', 'other'];

const RouteTemplatesView: React.FC<RouteTemplatesViewProps> = ({ onBack, theme, personalization }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { templates, createTemplate, updateTemplate, deleteTemplate } = useRouteTemplates();
  const { addAction, undo, getLastAction } = useUndoRedo();
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | RouteTemplate['category']>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<RouteTemplate | null>(null);
  const [form, setForm] = useState({
    name: '',
    category: 'business' as RouteTemplate['category'],
    startLocation: '',
    endLocation: '',
    distance: 0,
    estimatedTimeMinutes: 0,
    description: '',
  });

  const filtered = useMemo(() => {
    return (categoryFilter === 'all' ? templates : templates.filter(t => t.category === categoryFilter));
  }, [templates, categoryFilter]);

  const metrics = useMemo(() => {
    const total = filtered.length;
    const avgDistance = filtered.length > 0 ? filtered.reduce((s, t) => s + t.distance, 0) / filtered.length : 0;
    const mostUsed = filtered.sort((a, b) => b.uses - a.uses)[0];
    return { total, avgDistance, mostUsedName: mostUsed ? mostUsed.name : t('route_templates_none') };
  }, [filtered, t]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', category: 'business', startLocation: '', endLocation: '', distance: 0, estimatedTimeMinutes: 0, description: '' });
    setShowModal(true);
  };

  const openEdit = (tpl: RouteTemplate) => {
    setEditing(tpl);
    setForm({
      name: tpl.name,
      category: tpl.category,
      startLocation: tpl.startLocation,
      endLocation: tpl.endLocation,
      distance: tpl.distance,
      estimatedTimeMinutes: tpl.estimatedTimeMinutes || 0,
      description: tpl.description || '',
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!form.name.trim() || !form.startLocation.trim() || !form.endLocation.trim()) {
      showToast(t('projects_alert_fillFields'), 'error');
      return;
    }
    
    // Validate distance is greater than 0
    if (!form.distance || form.distance <= 0) {
      showToast(t('tripEditor_validation_distance_positive'), 'error');
      return;
    }
    
    if (editing) {
      updateTemplate(editing.id, { ...form });
    } else {
      createTemplate({ ...form });
    }
    setShowModal(false);
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (window.confirm(t('route_templates_deleteConfirm'))) {
      const templateToDelete = templates.find(t => t.id === templateId);
      if (templateToDelete) {
        deleteTemplate(templateId);
        
        // Add undo action
        addAction({
          type: 'delete',
          description: t('undo_action_delete_template'),
          undo: () => {
            createTemplate(templateToDelete);
          }
        });
        
        setShowUndoToast(true);
      }
    }
  };

  const bgCard = `rgba(30,30,30,${1 - personalization.uiTransparency})`;
  const containerBg = `rgba(18,18,18,${1 - personalization.uiTransparency})`;

  return (
    <div id="route-templates-view" className="p-8 rounded-lg -m-8 min-h-full">
      <div id="route-templates-header" className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button id="route-templates-back" onClick={onBack} className="flex items-center bg-gray-700 hover:bg-gray-600 text-white font-bold p-3 rounded-lg transition-colors shadow-md">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 id="route-templates-title" className="text-2xl font-bold text-white">{t('route_templates_title')}</h1>
            <p id="route-templates-subtitle" className="text-sm text-on-surface-dark-secondary">{t('route_templates_subtitle')}</p>
          </div>
        </div>
        <Button id="route-templates-add" onClick={openCreate} variant="primary" className="gap-2 h-[38px]">
          <Plus size={18} /> {t('route_templates_create_button')}
        </Button>
      </div>

      {/* Métricas */}
      <div id="route-templates-metrics" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <MetricCard title={t('route_templates_metric_total')} value={metrics.total.toString()} bg={bgCard} />
        <MetricCard title={t('route_templates_metric_avg_distance')} value={`${metrics.avgDistance.toFixed(1)} km`} bg={bgCard} />
        <MetricCard title={t('route_templates_metric_most_used')} value={metrics.mostUsedName} bg={bgCard} />
      </div>

      {/* Filtros */}
      <div id="route-templates-filters" className="flex flex-wrap gap-2 mb-6">
        <FilterButton active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>
          {t('route_templates_filter_all')}
        </FilterButton>
        <FilterButton active={categoryFilter === 'business'} onClick={() => setCategoryFilter('business')}>
          {t('route_templates_filter_business')}
        </FilterButton>
        <FilterButton active={categoryFilter === 'commute'} onClick={() => setCategoryFilter('commute')}>
          {t('route_templates_filter_commute')}
        </FilterButton>
        <FilterButton active={categoryFilter === 'client'} onClick={() => setCategoryFilter('client')}>
          {t('route_templates_filter_client')}
        </FilterButton>
        <FilterButton active={categoryFilter === 'other'} onClick={() => setCategoryFilter('other')}>
          {t('route_templates_filter_other')}
        </FilterButton>
      </div>

      {/* Lista o estado vacío */}
      {filtered.length === 0 ? (
        <div id="route-templates-empty" className="flex flex-col items-center justify-center py-24 text-center text-gray-400 animate-fadeIn">
          <div id="route-templates-empty-emoji" className="text-6xl mb-6 opacity-40 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">??</div>
          <p className="text-lg font-medium mb-2 text-gray-300">{t('route_templates_empty_title')}</p>
          <p className="text-sm mb-6 max-w-md">{t('route_templates_empty_desc')}</p>
          <button 
            onClick={openCreate} 
            className="bg-brand-primary hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-blue-500/20"
          >
            {t('route_templates_empty_cta')}
          </button>
        </div>
      ) : (
        <div id="route-templates-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(tpl => (
            <div 
              key={tpl.id} 
              style={{ backgroundColor: bgCard, backdropFilter: `blur(${personalization.uiBlur}px)` }} 
              className="p-4 rounded-lg border border-gray-700/40 flex flex-col hover:shadow-lg hover:border-blue-500/30 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-white truncate" title={tpl.name}>{tpl.name}</h3>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-600/40 text-gray-300 capitalize">{t(`route_templates_cat_${tpl.category}`)}</span>
              </div>
              <div className="text-xs text-gray-400 space-y-1 mb-4">
                <div><strong>{t('route_templates_field_start')}:</strong> {tpl.startLocation}</div>
                <div><strong>{t('route_templates_field_end')}:</strong> {tpl.endLocation}</div>
                <div><strong>{t('route_templates_field_distance')}:</strong> {tpl.distance} km</div>
                {tpl.estimatedTimeMinutes !== undefined && tpl.estimatedTimeMinutes > 0 && (
                  <div><strong>{t('route_templates_field_time')}:</strong> {tpl.estimatedTimeMinutes} min</div>
                )}
                {tpl.description && (
                  <div className="text-gray-500 italic line-clamp-2">{tpl.description}</div>
                )}
              </div>
              <div className="flex items-center justify-between mt-auto">
                <span className="text-xs text-gray-500">{t('route_templates_field_uses')}: {tpl.uses}</span>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(tpl)} className="p-1.5 rounded hover:bg-gray-600/40 text-gray-300 transition-colors" title={t('common_edit')}><Edit2 size={14} /></button>
                  <button onClick={() => handleDeleteTemplate(tpl.id)} className="p-1.5 rounded hover:bg-red-600/40 text-red-400 transition-colors" title={t('common_delete')}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" onClick={() => setShowModal(false)}>
          <div
            style={{
              backgroundColor: `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`,
              backdropFilter: `blur(${personalization.uiBlur}px)`,
              WebkitBackdropFilter: `blur(${personalization.uiBlur}px)`,
              border: '1px solid rgba(255,255,255,0.08)',
            }}
            className="rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50 flex-shrink-0">
              <h2 className="text-xl font-bold text-white">
                {editing ? t('route_templates_modal_edit_title') : t('route_templates_modal_create_title')}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </header>
            
            <div className="flex-grow flex min-h-0">
              <main className="w-full p-6 overflow-y-auto">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <section>
                    <h3 className="text-lg font-semibold text-white mb-4">{t('route_templates_section_basic')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input label={t('route_templates_field_name')} value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} required theme={theme} />
                      <div>
                        <label className="block text-sm font-medium text-on-surface-dark-secondary mb-1">
                          {t('route_templates_field_category')}
                        </label>
                        <select 
                          value={form.category} 
                          onChange={e => setForm(f => ({ ...f, category: e.target.value as any }))} 
                          className="w-full bg-background-dark border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-brand-primary focus:outline-none"
                        >
                          {categoryOrder.map(c => <option key={c} value={c}>{t(`route_templates_cat_${c}`)}</option>)}
                        </select>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-white mb-4">{t('route_templates_section_route')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input label={t('route_templates_field_start')} value={form.startLocation} onChange={(v) => setForm(f => ({ ...f, startLocation: v }))} required theme={theme} />
                      <Input label={t('route_templates_field_end')} value={form.endLocation} onChange={(v) => setForm(f => ({ ...f, endLocation: v }))} required theme={theme} />
                      <NumberInput label={t('route_templates_field_distance')} value={form.distance} onChange={(v) => setForm(f => ({ ...f, distance: v }))} min={0.01} step={0.1} required theme={theme} />
                      <NumberInput label={t('route_templates_field_time')} value={form.estimatedTimeMinutes} onChange={(v) => setForm(f => ({ ...f, estimatedTimeMinutes: v }))} min={0} step={1} theme={theme} />
                    </div>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-white mb-4">{t('route_templates_section_details')}</h3>
                    <div>
                      <label className="block text-sm font-medium text-on-surface-dark-secondary mb-1">
                        {t('route_templates_field_description')}
                      </label>
                      <textarea 
                        value={form.description} 
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
                        rows={4} 
                        className="w-full bg-background-dark border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-brand-primary focus:outline-none resize-none"
                        placeholder={t('route_templates_field_description_placeholder') || 'Descripción opcional...'} 
                      />
                    </div>
                  </section>
                </form>
              </main>
            </div>
            
            <footer className="flex justify-end p-4 bg-transparent border-t border-gray-700/50 flex-shrink-0">
              <button 
                onClick={() => setShowModal(false)} 
                className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg mr-4"
              >
                {t('common_cancel')}
              </button>
              <button 
                type="submit" 
                onClick={handleSubmit}
                className="flex items-center bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4 mr-2"/>
                {editing ? t('common_save') : t('route_templates_modal_create_submit')}
              </button>
            </footer>
          </div>
        </div>
      )}
      
      <UndoToast
        action={getLastAction()}
        onUndo={undo}
        onDismiss={() => setShowUndoToast(false)}
        isVisible={showUndoToast}
        theme={theme}
      />
    </div>
  );
};

const MetricCard: React.FC<{ title: string; value: string; bg: string }> = ({ title, value, bg }) => (
  <div 
    style={{ backgroundColor: bg }} 
    className="p-4 rounded-lg border border-gray-700/40 hover:shadow-lg hover:border-blue-500/30 transition-all duration-200"
  >
    <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">{title}</p>
    <p className="text-xl font-bold text-white">{value}</p>
  </div>
);

const FilterButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button 
    onClick={onClick} 
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
      active 
        ? 'bg-brand-primary text-white shadow-md shadow-blue-500/20' 
        : 'bg-surface-dark text-on-surface-dark-secondary hover:bg-gray-700/50 hover:text-white'
    }`}
  >
    {children}
  </button>
);

const Input: React.FC<{ label: string; value: string; onChange: (v: string) => void; required?: boolean; theme: 'light' | 'dark' }> = ({ label, value, onChange, required, theme }) => (
  <div>
    <label className="block text-sm font-medium text-on-surface-dark-secondary mb-1">{label}</label>
    <input 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      required={required} 
      className="w-full bg-background-dark border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-brand-primary focus:outline-none"
    />
  </div>
);

const NumberInput: React.FC<{ label: string; value: number; onChange: (v: number) => void; min?: number; step?: number; required?: boolean; theme: 'light' | 'dark' }> = ({ label, value, onChange, min, step, required, theme }) => (
  <div>
    <label className="block text-sm font-medium text-on-surface-dark-secondary mb-1">{label}</label>
    <input 
      type="number" 
      value={value} 
      min={min} 
      step={step} 
      required={required} 
      onChange={e => onChange(parseFloat(e.target.value) || 0)} 
      className="w-full bg-background-dark border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-brand-primary focus:outline-none"
    />
  </div>
);

// Add animation keyframes to the global style in your CSS or add inline here
// These will be used by the animate-fadeIn and animate-slideIn classes
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
document.head.appendChild(styleElement);

export default RouteTemplatesView;
