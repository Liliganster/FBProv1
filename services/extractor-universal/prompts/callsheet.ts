export function buildDirectPrompt(text: string) {
  return `You are an AI expert in analyzing film and TV production documents (callsheets). These documents vary widely in format and structure. Your job is to understand the context and extract key information intelligently.

Extract a JSON object with these keys:
{
  "date": "YYYY-MM-DD",
  "projectName": "string",
  "locations": ["string", "string", ...]
}

UNDERSTANDING CALLSHEETS:

Callsheets are NOT standardized. They can be:
• Professional templates or hand-written notes
• Well-formatted PDFs or scanned documents
• In multiple languages (German, English, Spanish, etc.)
• With logos, photos, headers, and varied layouts

YOUR TASK - Think like a production coordinator:

1. DATE:
   • Look for the shooting date (Drehtag, Shooting Day, Fecha de rodaje)
   • May appear as: "25.02.2025", "Feb 25, 2025", "Montag, 25. Februar"
   • Ignore prep dates, wrap dates, or other non-shooting dates
   • Normalize to YYYY-MM-DD format
   • If unclear, use the most prominent date

2. PROJECT NAME:
   • Look for the creative title of the production
   • May appear in headers, logos, or "Projekt:", "Production:", "Show:"
   • Examples: "Dark", "El Reino", "Vorstadtweiber", "Succession"
   • Distinguish from production company names (Netflix, Warner Bros, etc.)
   • If both exist, return the creative title, not the company

3. LOCATIONS - This is critical. Understand the DIFFERENCE:

   🎬 FILMING LOCATIONS (what you SHOULD extract):
   • These are where the actual filming/shooting happens
   • May be labeled: "Drehort", "Location", "Set", "Motiv", "Scene Location"
   • Can be outdoor or indoor venues
   • Examples:
     - Complete addresses: "Salmgasse 10, 1030 Wien"
     - Landmarks: "Schloss Schönbrunn", "Palais Rasumofsky"
     - Buildings: "Rathaus Wien", "Alte Oper Frankfurt"
     - Areas: "Donauinsel", "Stephansplatz"
     - Venues: "Hotel Imperial, Kärntner Ring 16"
   
   ⚙️ LOGISTICS LOCATIONS (what you should NOT extract):
   • These are support/infrastructure for the crew
   • Usually labeled: "Basis", "Basecamp", "Parken", "Catering", "Kostüm", "Maske"
   • These are WHERE the crew works/eats/parks, NOT where cameras roll
   • Examples to IGNORE:
     - "Basis: Parkplatz Donauinsel" (crew basecamp)
     - "Catering: Suite Nico" (where crew eats)
     - "Kostüm: Trailer 5" (wardrobe area)
     - "Parken: Parkhaus Mitte" (parking for crew)

   HOW TO DISTINGUISH:
   • Read the context around each location
   • If it says "Drehort", "Set", "Location" → It's filming
   • If it says "Basis", "Catering", "Parken", "Kostüm", "Maske" → It's logistics
   • If unclear, consider: Would cameras film here or is this crew support?

   HOW TO IDENTIFY THE *MAIN* FILMING LOCATIONS:
   • Prioritize locations that are explicitly numbered or listed, e.g., "Drehort 1", "Set A", "Location 2".
   • The most important locations are often mentioned in the context of scene numbers or shooting schedules.
   • A typical callsheet has 1-5 primary filming locations. If you find many more, you are likely being too inclusive. Focus on the most important ones where the main action happens.
   • IGNORE addresses mentioned in passing, such as crew pickup points, team hotels, or secondary "weather cover" locations, unless they are clearly marked as a primary set for the day.

   ADDRESSES MAY VARY:
   • Some may be complete: "Hauptstraße 100, 10115 Berlin"
   • Some may be partial: "Schloss Schönbrunn" (famous landmark)
   • Some may be areas: "Donauinsel, Wien" (outdoor area)
   • Some may need your knowledge: "Stephansplatz" → "Stephansplatz, 1010 Wien"
   • Extract what's given, try to include city/postal code if mentioned nearby
   
   FORMATTING:
   • Preserve the format as given in the document
   • Add city/postal code if clearly mentioned in context
   • Don't invent information not in the document

IMPORTANT PRINCIPLES:

✓ Be intelligent and context-aware
✓ Understand the PURPOSE of each location mentioned
✓ Extract filming locations, ignore logistics/support locations
✓ Handle varied formats, languages, and structures
✓ Use your understanding of film production to interpret
✓ If a location appears in both filming AND logistics context, extract it only once as filming location
✓ Typically expect 1-8 filming locations per day of shooting

✗ Don't apply rigid rules
✗ Don't expect perfect formatting
✗ Don't reject incomplete addresses if they identify a filming location
✗ Don't include crew support areas (basecamp, catering, parking, wardrobe, makeup)

OUTPUT:
• Return ONLY valid JSON, no markdown, no explanations
• Use the exact schema above
• Be confident in your interpretation of context

CONTENT TO ANALYZE:

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
