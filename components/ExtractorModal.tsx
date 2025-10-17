import React, { useState } from 'react';
import { XCircleIcon, LoaderIcon } from './Icons';
import { extractUniversalStructured, type ExtractMode } from '../services/extractor-universal/index';

interface ExtractorModalProps {
  onClose: () => void;
}

const ExtractorModal: React.FC<ExtractorModalProps> = ({ onClose }) => {
  const [mode, setMode] = useState<ExtractMode>('direct');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const onExtract = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await extractUniversalStructured({ mode, input: { text, file } });
      setResult(data);
    } catch (e: any) {
      setError(e?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-xs sm:max-w-lg md:max-w-2xl lg:max-w-3xl rounded-lg bg-frost-glass p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Extractor de Hoja de Rodaje</h2>
          <button onClick={onClose} className="p-2 hover:opacity-80" aria-label="Close">
            <XCircleIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-on-surface-dark">Modo de Extracción:</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setMode('direct')}
              className={`flex-1 rounded-lg border-2 px-4 py-3 text-left transition-all ${
                mode === 'direct'
                  ? 'border-brand-primary bg-brand-primary/20 shadow-md'
                  : 'border-surface-light/30 bg-background-dark hover:border-surface-light/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                  mode === 'direct' ? 'border-brand-primary bg-brand-primary' : 'border-surface-light/50'
                }`}>
                  {mode === 'direct' && <div className="h-2 w-2 rounded-full bg-white"></div>}
                </div>
                <div>
                  <div className="font-semibold">Direct Mode</div>
                  <div className="text-xs text-on-surface-dark-secondary">Rápido, texto limpio</div>
                </div>
              </div>
            </button>
            
            <button
              type="button"
              onClick={() => setMode('agent')}
              className={`flex-1 rounded-lg border-2 px-4 py-3 text-left transition-all ${
                mode === 'agent'
                  ? 'border-brand-primary bg-brand-primary/20 shadow-md'
                  : 'border-surface-light/30 bg-background-dark hover:border-surface-light/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                  mode === 'agent' ? 'border-brand-primary bg-brand-primary' : 'border-surface-light/50'
                }`}>
                  {mode === 'agent' && <div className="h-2 w-2 rounded-full bg-white"></div>}
                </div>
                <div>
                  <div className="font-semibold">Agent Mode</div>
                  <div className="text-xs text-on-surface-dark-secondary">Con OCR para PDFs e imágenes</div>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="mb-3">
          <textarea
            className="h-40 w-full resize-y rounded-md bg-background-dark p-3 outline-none"
            placeholder="Pega aquí el contenido de la hoja (texto/CSV)"
            value={text}
            onChange={(e)=>setText(e.target.value)}
          />
        </div>

        <div className="mb-4 flex items-center gap-3">
          <input type="file" accept=".pdf,.csv,.txt,image/*" onChange={onSelectFile} />
          {file && <span className="text-sm text-on-surface-dark-secondary">{file.name}</span>}
        </div>

        <div className="mb-4">
          <button
            onClick={onExtract}
            disabled={loading}
            className="flex items-center gap-2 rounded-md bg-brand-primary px-4 py-2 text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading && <LoaderIcon className="h-4 w-4 animate-spin" />} 
            {loading ? `Extrayendo (${mode === 'direct' ? 'Direct' : 'Agent con OCR'})...` : 'Extract with AI'}
          </button>
        </div>

        {error && <div role="alert" className="mb-3 rounded-md bg-red-500/10 p-3 text-red-300">{error}</div>}
        {result && (
          <div className="rounded-md bg-background-dark p-3">
            <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(result, null, 2)}</pre>
            <div className="mt-2">
              <button
                className="rounded-md bg-brand-secondary px-3 py-1 text-black hover:opacity-90"
                onClick={()=>navigator.clipboard.writeText(JSON.stringify(result, null, 2))}
              >
                Copiar JSON
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExtractorModal;
