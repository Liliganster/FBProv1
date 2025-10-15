export function buildDirectPrompt(text: string) {
  return `You are an expert in film and TV production logistics. Analyze the following content (callsheet, pdf text, csv or plain text) and extract a concise JSON object with EXACTLY these keys:

{
  "date": "YYYY-MM-DD",
  "projectName": "string",
  "locations": ["string", "string", ...]
}

**CRITICAL EXTRACTION RULES FOR LOCATIONS:**

1. **ONLY Filming Locations**: Extract ONLY locations marked as "Drehort", "Location", "Set", or "Motiv" (actual filming locations)

2. **IGNORE Logistics**: You MUST IGNORE locations for: "Basis", "Parken", "Aufenthalt", "Kostüm", "Maske", "Lunch", "Catering", "Team", "Technik", "Office", "Meeting point", "Transport"

3. **IGNORE Room/Internal Names**: You MUST IGNORE internal location names or room names without complete street addresses. Examples to IGNORE: "Suite Nico", "Keller", "Villa Dardenne", "Catering Bereich", "Salon", "Empfang", "Studio"

4. **Complete Address Required**: Each location MUST be a complete physical address with street name + house number + postal code/city
   - ✅ GOOD: "Salmgasse 10, 1030 Wien", "Palais Rasumofsky, 23-25, 1030 Wien"
   - ❌ BAD: "Suite Nico", "Keller", "Villa Dardenne", "Catering Bereich"

5. **Place Name + Address**: If a location has both a place name AND a street address, use ONLY the complete street address

6. **Vienna District Format**: Convert Vienna district prefixes (e.g., "2., Straße") to postal codes (e.g., "Straße, 1020 Wien")

7. **Deduplicate**: Remove duplicate addresses while preserving order

Constraints:
- Output ONLY valid JSON without markdown or explanations
- Follow the exact schema and keys above
- If multiple dates appear, pick the primary shooting day
- If the project name and production company both appear, return the creative project title (not the company)

Content:

${text}`;
}

export function buildCrewFirstDirectPrompt(text: string) {
  return `Extrae datos de esta hoja de rodaje en JSON. Devuelve SOLO JSON válido, sin markdown ni explicaciones.

CAMPOS CLAVE (diferéncialos correctamente):
• projectName (REQUERIDO): Título del proyecto. Ej: "Dark", "El Reino", "Succession". NO es la productora.
• productionCompany (opcional): Empresa productora. Ej: "Netflix", "Warner Bros", "UFA Fiction".
• motiv (opcional): Locación narrativa/escena. Ej: "Höhle", "Casa de María - Interior". NO es dirección física.
• episode (opcional): Número/título episodio. Ej: "Folge 3", "EP101".
• shootingDay (opcional): Día de rodaje. Ej: "DT8", "Día 15".
• generalCallTime (opcional): Hora de llamada en HH:MM.
• date (REQUERIDO): Fecha en YYYY-MM-DD.

UBICACIONES - Solo incluye estas 7 categorías con dirección física:
1. FILMING_PRINCIPAL - Set principal
2. UNIT_BASE - Basecamp
3. CATERING - Catering
4. MAKEUP_HAIR - Maquillaje/peluquería
5. WARDROBE - Vestuario
6. CREW_PARKING - Parking equipo
7. LOAD_UNLOAD - Carga/descarga

Por cada ubicación:
• location_type: Una de las 7 categorías
• address (REQUERIDO): Dirección física original
• formatted_address: Dirección normalizada para Google Maps (null si no puedes)
• latitude/longitude: Coordenadas GPS (null si no puedes)
• notes: Max 2 notas logísticas (horarios, trailers, etc)
• confidence: 0-1

REGLAS:
- version debe ser "parser-crew-1"
- rutas debe ser []
- Ignora hospitales, protocolos, políticas, teléfonos
- Si solo hay título, deja productionCompany y motiv como null

EJEMPLO:
Input: "DARK - Folge 3 - Produktion: Wiedemann & Berg - Motiv: Höhle"
Output: {"version":"parser-crew-1","projectName":"Dark","productionCompany":"Wiedemann & Berg","motiv":"Höhle","episode":"Folge 3",...}

TEXTO:
${text}`;
}

export function sanitizeModelText(text: string) {
  // Lightweight cleanup to reduce noise before sending to the model
  return text
    .replace(/[\u00A0\t]+/g, ' ')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
