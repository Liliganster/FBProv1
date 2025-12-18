import React, { useState } from 'react';
import { XCircleIcon, LoaderIcon } from './Icons';
import { Button } from './Button';
import { extractUniversalStructured, type ExtractMode } from '../services/extractor-universal/index';
import useTranslation from '../hooks/useTranslation';
import { PersonalizationSettings } from '../types';

interface ExtractorModalProps {
  onClose: () => void;
  personalization?: PersonalizationSettings;
  theme?: 'light' | 'dark';
}

const ExtractorModal: React.FC<ExtractorModalProps> = ({ onClose, personalization, theme }) => {
  const [mode, setMode] = useState<ExtractMode>('direct');
  const [contentType, setContentType] = useState<'callsheet' | 'email'>('callsheet');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const { t } = useTranslation();

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const onExtract = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await extractUniversalStructured({ mode, input: { text, file }, contentType });
      setResult(data);
    } catch (e: any) {
      setError(e?.message || t('common_error_unknown'));
    } finally {
      setLoading(false);
    }
  };

  // Dynamic modal style based on personalization
  const modalStyle = personalization ? {
    backgroundColor: `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`,
    backdropFilter: `blur(${personalization.uiBlur}px)`,
    WebkitBackdropFilter: `blur(${personalization.uiBlur}px)`,
  } : {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div style={modalStyle} className="w-full max-w-xs sm:max-w-lg md:max-w-2xl lg:max-w-3xl rounded-lg bg-frost-glass p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('extractor_title')}</h2>
          <Button variant="icon" onClick={onClose} aria-label="Close">
            <XCircleIcon className="h-5 w-5" />
          </Button>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-on-surface-dark">{t('extractor_mode_label')}:</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setMode('direct')}
              className={`flex-1 rounded-lg border-2 px-4 py-3 text-left transition-all ${mode === 'direct'
                ? 'border-brand-primary bg-brand-primary/20 shadow-md'
                : 'border-surface-light/30 bg-background-dark hover:border-surface-light/50'
                }`}
            >
              <div className="flex items-center gap-2">
                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${mode === 'direct' ? 'border-brand-primary bg-brand-primary' : 'border-surface-light/50'
                  }`}>
                  {mode === 'direct' && <div className="h-2 w-2 rounded-full bg-white"></div>}
                </div>
                <div>
                  <div className="font-semibold">{t('extractor_mode_direct')}</div>
                  <div className="text-xs text-on-surface-dark-secondary">{t('extractor_mode_direct_desc')}</div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode('agent')}
              className={`flex-1 rounded-lg border-2 px-4 py-3 text-left transition-all ${mode === 'agent'
                ? 'border-brand-primary bg-brand-primary/20 shadow-md'
                : 'border-surface-light/30 bg-background-dark hover:border-surface-light/50'
                }`}
            >
              <div className="flex items-center gap-2">
                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${mode === 'agent' ? 'border-brand-primary bg-brand-primary' : 'border-surface-light/50'
                  }`}>
                  {mode === 'agent' && <div className="h-2 w-2 rounded-full bg-white"></div>}
                </div>
                <div>
                  <div className="font-semibold">{t('extractor_mode_agent')}</div>
                  <div className="text-xs text-on-surface-dark-secondary">{t('extractor_mode_agent_desc')}</div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode('vision')}
              className={`flex-1 rounded-lg border-2 px-4 py-3 text-left transition-all ${mode === 'vision'
                ? 'border-brand-primary bg-brand-primary/20 shadow-md'
                : 'border-surface-light/30 bg-background-dark hover:border-surface-light/50'
                }`}
            >
              <div className="flex items-center gap-2">
                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${mode === 'vision' ? 'border-brand-primary bg-brand-primary' : 'border-surface-light/50'
                  }`}>
                  {mode === 'vision' && <div className="h-2 w-2 rounded-full bg-white"></div>}
                </div>
                <div>
                  <div className="font-semibold">Vision (Beta)</div>
                  <div className="text-xs text-on-surface-dark-secondary">Multimodal AI (Best for PDFs)</div>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="mb-3">
          <label className="mb-2 block text-sm font-medium text-on-surface-dark">{t('extractor_content_label')}:</label>
          <div className="flex gap-3 mb-2">
            <button
              type="button"
              onClick={() => setContentType('callsheet')}
              className={`flex-1 rounded-lg border-2 px-4 py-3 text-left transition-all ${contentType === 'callsheet'
                ? 'border-brand-primary bg-brand-primary/20 shadow-md'
                : 'border-surface-light/30 bg-background-dark hover:border-surface-light/50'
                }`}
            >
              <div className="font-semibold">{t('extractor_content_callsheet_title')}</div>
              <div className="text-xs text-on-surface-dark-secondary">{t('extractor_content_callsheet_desc')}</div>
            </button>
            <button
              type="button"
              onClick={() => setContentType('email')}
              className={`flex-1 rounded-lg border-2 px-4 py-3 text-left transition-all ${contentType === 'email'
                ? 'border-brand-primary bg-brand-primary/20 shadow-md'
                : 'border-surface-light/30 bg-background-dark hover:border-surface-light/50'
                }`}
            >
              <div className="font-semibold">{t('extractor_content_email_title')}</div>
              <div className="text-xs text-on-surface-dark-secondary">{t('extractor_content_email_desc')}</div>
            </button>
          </div>
        </div>

        <div className="mb-3">
          <textarea
            className="h-40 w-full resize-y rounded-md bg-background-dark p-3 outline-none"
            placeholder={t('extractor_text_placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="mb-4 flex items-center gap-3">
          <input type="file" accept=".pdf,.csv,.txt,image/*" onChange={onSelectFile} />
          {file && <span className="text-sm text-on-surface-dark-secondary">{file.name}</span>}
        </div>

        <div className="mb-4">
          <Button
            onClick={onExtract}
            disabled={loading}
            variant="primary"
            className="w-full justify-center"
          >
            {loading && <LoaderIcon className="h-4 w-4 animate-spin mr-2" />}
            {loading ? (mode === 'direct' ? t('extractor_loading_direct') : t('extractor_loading_agent')) : t('extractor_button')}
          </Button>
        </div>

        {error && <div role="alert" className="mb-3 rounded-md bg-red-500/10 p-3 text-red-300">{error}</div>}
        {result && (
          <div className="rounded-md bg-background-dark p-3">
            <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(result, null, 2)}</pre>
            <div className="mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigator.clipboard.writeText(JSON.stringify(result, null, 2))}
              >
                {t('extractor_copy_json')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExtractorModal;
