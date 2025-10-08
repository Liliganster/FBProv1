// PDF text extraction for base64 input
// Behavior:
// - Decodes base64 -> bytes
// - Iterates pages and concatenates text
// - If no text layer, throws { code: 'requires_ocr' }

export async function extractTextFromPdf(base64: string): Promise<string> {
  try {
    const { pdfjsLib } = (window as any);
    if (!pdfjsLib) throw Object.assign(new Error('pdf.js is not loaded'), { code: 'pdfjs_not_loaded' });
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const pdf = await pdfjsLib.getDocument(bytes).promise;
    const chunks: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const pageText = content.items.map((it: any) => it.str).join(' ').trim();
      if (pageText) chunks.push(pageText);
    }
    const allText = chunks.join('\n\n').trim();
    if (!allText) {
      const err: any = new Error('PDF has no text layer');
      err.code = 'requires_ocr';
      throw err;
    }
    return allText;
  } catch (e: any) {
    if (e?.code === 'requires_ocr') throw e;
    const err: any = new Error('Error reading PDF');
    err.code = 'pdf_parse_error';
    throw err;
  }
}

