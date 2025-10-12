export function buildDirectPrompt(text: string) {
  return `You are an expert in film and TV production logistics. Analyze the following content (callsheet, pdf text, csv or plain text) and extract a concise JSON object with EXACTLY these keys:\n\n{\n  "date": "YYYY-MM-DD",\n  "projectName": "string",\n  "locations": ["string", "string", ...]\n}\n\nConstraints:\n- Output ONLY valid JSON without markdown or explanations.\n- Follow the exact schema and keys above.\n- If multiple dates appear, pick the primary shooting day.\n- If the project name and production company both appear, return the creative project title (not the company).\n- Locations should be clean, human-readable addresses or place names.\n- If a location repeats, deduplicate while preserving order.\n\nContent:\n\n${text}`;
}

export function buildCrewFirstDirectPrompt(text: string) {
  return `Eres un agente extractor de datos experto en la industria cinematográfica, enfocado en información logística para el equipo (crew-first). Tu tarea es analizar el texto de una hoja de rodaje (call sheet) y extraer información estructurada en formato JSON, siguiendo un schema estricto.

REGLAS CLAVE DEL "CREW-FIRST":

1.  **Formato de Salida**: Tu única respuesta DEBE ser un objeto JSON válido que se ajuste al schema. No incluyas \`\`\`json, comillas triples, ni ningún texto explicativo fuera del JSON.

2.  **CRÍTICO - Diferenciación de Campos del Encabezado**:

    **projectName** (OBLIGATORIO):
    - Es el TÍTULO CREATIVO del proyecto (película, serie, documental)
    - Ejemplos: "Dark", "El Reino", "Succession", "Der Tatortreiniger", "La Casa de Papel"
    - NO es la productora, NO es el motivo/set, NO es el episodio
    - Busca en el encabezado términos como: "Titel:", "Title:", "Project:", "Serie:", "Film:", "Película:"
    - Si hay duda, usa el nombre que aparece más prominente en la parte superior del documento

    **productionCompany** (OPCIONAL):
    - Es la EMPRESA/PRODUCTORA que produce el proyecto
    - Ejemplos: "Netflix", "Warner Bros", "UFA Fiction", "Gaumont", "Movistar+", "Bavaria Film"
    - Busca términos como: "Produktion:", "Production Company:", "Productora:", "Studio:", "Auftraggeber:"
    - Suele aparecer cerca del título del proyecto pero es una entidad diferente
    - Si solo encuentras el título del proyecto, deja este campo como null

    **motiv** (OPCIONAL):
    - Es la UBICACIÓN NARRATIVA o descripción de la escena que se rodará
    - Ejemplos: "Casa de María - Interior Cocina", "Oficina del FBI", "Bosque Exterior Noche", "Apartamento de Jonas"
    - NO es el nombre del proyecto, NO es la dirección física
    - Busca términos como: "Motiv:", "Scene:", "Escena:", "Location:", "Drehort:" (cuando se refiere a la locación narrativa)
    - Es diferente de las direcciones físicas en 'locations'

    **episode** (OPCIONAL):
    - Número o título del episodio (solo para series)
    - Ejemplos: "EP101", "E03", "Piloto", "Folge 3", "Episodio 5: El Encuentro"
    - Busca: "Episode:", "Folge:", "Episodio:", "EP", "E0", "Capítulo:"

    **shootingDay** (OPCIONAL):
    - Día de rodaje o designación del día
    - Ejemplos: "DT3", "Día 15", "Tag 8", "Drehtag 12", "Day 5"
    - Busca: "Drehtag:", "DT", "Shooting Day:", "Día:", "Tag:"

3.  **Whitelist de Categorías**: Solo devuelve ubicaciones que pertenezcan a una de las siguientes categorías ('location_type'). Ignora por completo protocolos, políticas, hospitales, teléfonos, contactos y avisos que no sean logísticos.
    *   **FILMING_PRINCIPAL**: Set principal, Drehort, Motiv, Set, Shooting Location (cuando incluye dirección física)
    *   **UNIT_BASE**: Basecamp, Basislager, Unit Base, Base
    *   **CATERING**: Catering, Craft, Verpflegung
    *   **MAKEUP_HAIR**: Maske, Hair & Make-Up, HMU, Maquillaje y Peluquería
    *   **WARDROBE**: Gardrobe, Wardrobe, Kostüm, Vestuario
    *   **CREW_PARKING**: Crew Parking, Parken, Aparcamiento Equipo
    *   **LOAD_UNLOAD**: Puntos de carga/descarga, "Technik Entladen", "Loading Dock", "Descarga de material"

4.  **Reglas de Ubicación y Geocodificación**:
    *   **'address' es obligatorio**. Es la dirección FÍSICA original del texto. Si no hay dirección, NO incluyas la ubicación.
    *   **'formatted_address'**: Proporciona una versión normalizada y limpia de la dirección, lista para usar en Google Maps.
    *   **'latitude' y 'longitude'**: Proporciona las coordenadas geográficas para la 'formatted_address'. Si no puedes geocodificar la dirección con certeza, devuelve 'null' para estos tres campos ('formatted_address', 'latitude', 'longitude').
    *   Limita el campo 'notes' a un máximo de 2 items logísticos útiles para el equipo (ej: "Meal 13:00-13:30", "Trailer 2", "Halle B").
    *   Si solo hay una dirección sin encabezado claro, clasifícala como 'FILMING_PRINCIPAL' con 'confidence' <= 0.6.

5.  **Normalización General**:
    *   **Fecha**: Normaliza a YYYY-MM-DD.
    *   **Horas**: Normaliza a HH:MM (formato 24h).

6.  **Rutas**: Devuelve el array 'rutas' como un array vacío: []. Serán generadas programáticamente después.

7.  **Versión**: El campo 'version' siempre debe ser "parser-crew-1".

**EJEMPLOS DE DIFERENCIACIÓN**:

Ejemplo 1 (Serie con productora):
- Texto: "DARK - Folge 3 - Netflix Original - Motiv: Höhle - Produktion: Wiedemann & Berg"
- projectName: "Dark"
- productionCompany: "Wiedemann & Berg"
- motiv: "Höhle"
- episode: "Folge 3"

Ejemplo 2 (Película):
- Texto: "EL REINO - Warner Bros España - Escena: Despacho del Ministro"
- projectName: "El Reino"
- productionCompany: "Warner Bros España"
- motiv: "Despacho del Ministro"

Ejemplo 3 (Solo título):
- Texto: "SUCCESSION - Episode 401 - Location: Kendall's Apartment"
- projectName: "Succession"
- productionCompany: null
- motiv: "Kendall's Apartment"
- episode: "Episode 401"

Ahora, procesa el siguiente texto de la hoja de rodaje:

--- TEXTO A PROCESAR ---
${text}
--- FIN DEL TEXTO ---`;
}

export function sanitizeModelText(text: string) {
  // Lightweight cleanup to reduce noise before sending to the model
  return text
    .replace(/[\u00A0\t]+/g, ' ')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
