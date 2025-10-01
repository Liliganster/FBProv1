import React, { useMemo, useState } from 'react';
import { Plus, ArrowLeft, Trash2, Edit2 } from 'lucide-react';
import useTranslation from '../hooks/useTranslation';
import useRouteTemplates from '../hooks/useRouteTemplates';
import { RouteTemplate } from '../types';

interface RouteTemplatesViewProps {
  onBack: () => void;
  theme: 'light' | 'dark';
  personalization: { uiTransparency: number; uiBlur: number };
}

const categoryOrder: RouteTemplate['category'][] = ['business', 'commute', 'client', 'other'];

const RouteTemplatesView: React.FC<RouteTemplatesViewProps> = ({ onBack, theme, personalization }) => {
  const { t } = useTranslation();
  const { templates, createTemplate, updateTemplate, deleteTemplate } = useRouteTemplates();
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
    if (editing) {
      updateTemplate(editing.id, { ...form });
    } else {
      createTemplate({ ...form });
    }
    setShowModal(false);
  };

  const bgCard = theme === 'dark' ? `rgba(30,30,30,${1 - personalization.uiTransparency})` : `rgba(243,244,246,${1 - personalization.uiTransparency})`;
  const containerBg = theme === 'dark' ? `rgba(18,18,18,${1 - personalization.uiTransparency})` : `rgba(229,231,235,${1 - personalization.uiTransparency})`;

  return (
    <div style={{ backgroundColor: containerBg, backdropFilter: `blur(${personalization.uiBlur}px)` }} className="p-8 rounded-lg -m-8 min-h-full">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center bg-gray-700 hover:bg-gray-600 text-white font-bold p-3 rounded-lg transition-colors shadow-md">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{t('route_templates_title')}</h1>
            <p className="text-sm text-on-surface-dark-secondary">{t('route_templates_subtitle')}</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-brand-primary hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors shadow-md">
          <Plus size={18} /> {t('route_templates_create_button')}
        </button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <MetricCard title={t('route_templates_metric_total')} value={metrics.total.toString()} bg={bgCard} />
        <MetricCard title={t('route_templates_metric_avg_distance')} value={`${metrics.avgDistance.toFixed(1)} km`} bg={bgCard} />
        <MetricCard title={t('route_templates_metric_most_used')} value={metrics.mostUsedName} bg={bgCard} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-6">
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
        <div className="flex flex-col items-center justify-center py-24 text-center text-gray-400 animate-fadeIn">
          <div className="text-6xl mb-6 opacity-40 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">⋯</div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                  <button onClick={() => deleteTemplate(tpl.id)} className="p-1.5 rounded hover:bg-red-600/40 text-red-400 transition-colors" title={t('common_delete')}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div 
            style={{ backgroundColor: bgCard, backdropFilter: `blur(${personalization.uiBlur}px)` }} 
            className="w-full max-w-5xl rounded-lg p-6 max-h-[90vh] overflow-y-auto shadow-xl animate-slideIn"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">{editing ? t('route_templates_modal_edit_title') : t('route_templates_modal_create_title')}</h2>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700/40 transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Input label={t('route_templates_field_name')} value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} required />
                <div>
                  <label className="block text-xs font-semibold uppercase mb-2 text-gray-400">{t('route_templates_field_category')}</label>
                  <select 
                    value={form.category} 
                    onChange={e => setForm(f => ({ ...f, category: e.target.value as any }))} 
                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-white focus:ring-2 focus:ring-brand-primary focus:outline-none text-sm transition-colors hover:border-blue-500/50"
                  >
                    {categoryOrder.map(c => <option key={c} value={c}>{t(`route_templates_cat_${c}`)}</option>)}
                  </select>
                </div>
                <Input label={t('route_templates_field_start')} value={form.startLocation} onChange={(v) => setForm(f => ({ ...f, startLocation: v }))} required />
                <Input label={t('route_templates_field_end')} value={form.endLocation} onChange={(v) => setForm(f => ({ ...f, endLocation: v }))} required />
              </div>
              <div className="space-y-4">
                <NumberInput label={t('route_templates_field_distance')} value={form.distance} onChange={(v) => setForm(f => ({ ...f, distance: v }))} min={0} step={0.1} required />
                <NumberInput label={t('route_templates_field_time')} value={form.estimatedTimeMinutes} onChange={(v) => setForm(f => ({ ...f, estimatedTimeMinutes: v }))} min={0} step={1} />
                <div>
                  <label className="block text-xs font-semibold uppercase mb-2 text-gray-400">{t('route_templates_field_description')}</label>
                  <textarea 
                    value={form.description} 
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
                    rows={5} 
                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-white focus:ring-2 focus:ring-brand-primary focus:outline-none text-sm resize-none hover:border-blue-500/50 transition-colors" 
                    placeholder={t('route_templates_field_description_placeholder') || ''} 
                  />
                </div>
              </div>
              <div className="md:col-span-2 flex justify-end gap-4 pt-4 border-t border-gray-700">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                >
                  {t('common_cancel')}
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-brand-primary hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors shadow-md hover:shadow-blue-500/20"
                >
                  {editing ? t('common_save') : t('route_templates_modal_create_submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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

const Input: React.FC<{ label: string; value: string; onChange: (v: string) => void; required?: boolean }> = ({ label, value, onChange, required }) => (
  <div>
    <label className="block text-xs font-semibold uppercase mb-2 text-gray-400">{label}</label>
    <input 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      required={required} 
      className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-white focus:ring-2 focus:ring-brand-primary focus:outline-none text-sm transition-colors hover:border-blue-500/50" 
    />
  </div>
);

const NumberInput: React.FC<{ label: string; value: number; onChange: (v: number) => void; min?: number; step?: number; required?: boolean }> = ({ label, value, onChange, min, step, required }) => (
  <div>
    <label className="block text-xs font-semibold uppercase mb-2 text-gray-400">{label}</label>
    <input 
      type="number" 
      value={value} 
      min={min} 
      step={step} 
      required={required} 
      onChange={e => onChange(parseFloat(e.target.value) || 0)} 
      className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-white focus:ring-2 focus:ring-brand-primary focus:outline-none text-sm transition-colors hover:border-blue-500/50" 
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
