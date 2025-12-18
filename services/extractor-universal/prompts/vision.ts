export function buildVisionPrompt(ocrText: string) {
  return `You are an elite production coordinator with VISION capabilities. 
Your task is to analyze the provided IMAGE of a callsheet (or document) to extract structured data.
You also have the raw OCR text as context, but you must PRIORITIZE VISUAL CUES from the image.

**MISSION**: Return a single valid JSON object.

**CRITICAL: PRODUCTION COMPANY EXTRACTION**
- LOOK at the top headers and footers.
- Identify LOGOS. The text in a logo in the top corners is almost always the production company.
- Look for legal suffixes ("GmbH", "Inc.", "S.L.", "Limited") in small print or headers.
- COPYRIGHT: Look at the footer (bottom of page 1) for "© 2024 [Company Name]".
- DISTINGUISH: The Project Name (creative title) vs The Production Company (legal entity).
- Example: If you see a logo "NETFLIX" and text "DARK", Project="Dark", ProductionCompany="Netflix".

**DATA SCHEMA**:
{
  "date": "YYYY-MM-DD",
  "projectName": "string",
  "productionCompanies": ["string", "string"],
  "locations": ["string", "string"]
}

**RULES**:
1. **Date**: Find the shooting date. Normalize to YYYY-MM-DD.
2. **Project Name**: The CREATIVE title. Main big text.
3. **Production Companies**: ALL companies involved. Use the logos and legal text you see.
4. **Locations**: Standard set shooting locations.

**CONTEXT (OCR TEXT)**:
${ocrText}`;
}

export function sanitizeVisionText(text: string) {
  return text.trim();
}
