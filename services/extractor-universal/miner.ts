// Utilities to ingest inputs (text/PDF/CSV/image) and produce text
// Includes a cheap OCR path using tesseract.js (Agent mode)

export type InputKind = 'text' | 'pdf' | 'csv' | 'image';

export function detectKind(file: File): InputKind | null {
  if (!file) return null;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (type.startsWith('image/')) return 'image';
  if (type.includes('csv') || name.endsWith('.csv')) return 'csv';
  if (type.startsWith('text/') || name.endsWith('.txt')) return 'text';
  return null;
}

export async function getTextFromTextFile(file: File): Promise<string> {
  return (await file.text()).trim();
}

export async function getTextFromCsvFile(file: File): Promise<string> {
  // Keep original content; downstream normalizer will clean it
  return (await file.text()).trim();
}

export async function extractTextFromPdfFile(file: File): Promise<string> {
  const { pdfjsLib } = (window as any);
  if (!pdfjsLib) throw Object.assign(new Error('pdf.js is not loaded'), { code: 'pdfjs_not_loaded' });
  // Use the worker hosted on CDN to avoid bundling complexity
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
  const chunks: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((it: any) => it.str).join(' ').trim();
    if (pageText) chunks.push(pageText);
  }
  const allText = chunks.join('\n\n').trim();
  if (!allText) {
    const err: any = new Error('PDF has no text layer');
    err.code = 'requires_ocr';
    throw err;
  }
  return allText;
}

async function renderPdfToDataUrls(file: File): Promise<string[]> {
  const { pdfjsLib } = (window as any);
  if (!pdfjsLib) throw Object.assign(new Error('pdf.js is not loaded'), { code: 'pdfjs_not_loaded' });
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
  const urls: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    await page.render({ canvasContext: ctx as any, viewport }).promise;
    urls.push(canvas.toDataURL('image/png'));
  }
  return urls;
}

async function ocrImageDataUrl(dataUrl: string, lang = 'spa+eng'): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(undefined, undefined, { logger: () => {} });
  await worker.load();
  await worker.reinitialize(lang);
  const { data } = await worker.recognize(dataUrl);
  await worker.terminate();
  return (data?.text || '').trim();
}

export async function extractTextWithOCRFromPdfFile(file: File): Promise<string> {
  const pages = await renderPdfToDataUrls(file);
  const out: string[] = [];
  for (const url of pages) {
    const t = await ocrImageDataUrl(url);
    if (t) out.push(t);
  }
  return out.join('\n\n').trim();
}

export async function extractTextWithOCRFromImageFile(file: File): Promise<string> {
  // Convert to data URL
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return ocrImageDataUrl(dataUrl);
}
