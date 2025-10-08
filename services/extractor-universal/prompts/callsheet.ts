export function buildDirectPrompt(text: string) {
  return `You are an expert in film and TV production logistics. Analyze the following content (callsheet, pdf text, csv or plain text) and extract a concise JSON object with EXACTLY these keys:\n\n{\n  "date": "YYYY-MM-DD",\n  "projectName": "string",\n  "locations": ["string", "string", ...]\n}\n\nConstraints:\n- Output ONLY valid JSON without markdown or explanations.\n- Follow the exact schema and keys above.\n- If multiple dates appear, pick the primary shooting day.\n- If the project name and production company both appear, return the creative project title (not the company).\n- Locations should be clean, human-readable addresses or place names.\n- If a location repeats, deduplicate while preserving order.\n\nContent:\n\n${text}`;
}

export function sanitizeModelText(text: string) {
  // Lightweight cleanup to reduce noise before sending to the model
  return text
    .replace(/[\u00A0\t]+/g, ' ')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
