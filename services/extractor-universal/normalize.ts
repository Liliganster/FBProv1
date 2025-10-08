export function cleanOcrText(t: string): string {
  return t
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/(\w)-\n(\w)/g, '$1$2')
    .trim();
}

export function normalizeCsvForModel(csv: string): string {
  // Keep as-is but ensure neat trimming
  return csv.trim();
}
