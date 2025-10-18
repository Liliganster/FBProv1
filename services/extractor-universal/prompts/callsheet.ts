export function buildDirectPrompt(text: string) {
  return `Eres un experto analista de documentos de producción cinematográfica y televisiva. Tu tarea es LEER y ENTENDER el documento como lo haría un coordinador de producción humano, y extraer la información clave de forma inteligente.

**TU MISIÓN**: Devolver UN ÚNICO objeto JSON válido con la información extraída. NO incluyas markdown, explicaciones ni texto adicional fuera del JSON.

**SCHEMA DE SALIDA**:
{
  "date": "YYYY-MM-DD",
  "projectName": "string",
  "productionCompanies": ["string", "string", ...],
  "locations": ["string", "string", ...]
}

---

## CÓMO PENSAR COMO UN HUMANO

Los call sheets NO están estandarizados. Pueden ser:
- PDFs profesionales, escaneos, notas manuscritas
- En cualquier idioma (alemán, inglés, español, etc.)
- Con logos, fotos, tablas, cualquier formato

**Tu trabajo NO es buscar palabras clave específicas**. Tu trabajo es LEER el documento completo y ENTENDER:
1. ¿Cuál es la fecha de rodaje principal?
2. ¿Cuál es el nombre del proyecto/show/película?
3. ¿Cuál es la productora?
4. ¿Dónde se va a filmar? (NO dónde come el equipo, NO dónde aparcan)

---

## CAMPO 1: date (FECHA DE RODAJE)

**Qué buscar**: La fecha del día de rodaje principal
- Puede aparecer como: "25.02.2025", "Feb 25, 2025", "Montag 25. Februar"
- Ignora fechas de prep, wrap, o fechas de calendario mencionadas de pasada
- **Normaliza a**: YYYY-MM-DD

**Razonamiento**: Como humano, ¿cuál es la fecha MÁS PROMINENTE que indica cuándo se filma?

---

## CAMPO 2: projectName (TÍTULO DEL PROYECTO)

**Qué buscar**: El nombre creativo del show/película/serie
- Puede aparecer en headers, logos, o junto a "Projekt:", "Título:", "Serie:", "Film:"
- Ejemplos: "Dark", "El Reino", "Vorstadtweiber", "Succession", "Breaking Bad"
- **NO confundir con**: El nombre de la productora (Netflix, Warner Bros, UFA Fiction)

**Razonamiento**: Como humano, ¿cuál es el TÍTULO de la producción? (no la empresa)

---

## CAMPO 3: productionCompanies (PRODUCTORAS)

**Qué buscar**: TODAS las empresas que PRODUCEN el proyecto (puede haber varias co-productoras)
- Puede aparecer como:
  - "Produktion:", "Production Company:", "Productora:", "Studio:", "Prod:", "Producer:"
  - "In Co-Production with:", "Co-produced by:", "Koproduzent:", "En coproducción con:"
  - En logos, cabeceras principales, o pie de página del documento
- Ejemplos: ["UFA Fiction"], ["Netflix", "Warner Bros TV"], ["Bavaria Film", "Neue Super"], ["X Filme", "ARD Degeto"]

**DÓNDE BUSCAR** (en orden de prioridad):
1. **ENCABEZADO/HEADER** (primera página, parte superior)
2. **LOGOS** (primera página, esquinas o centro)
3. **PIE DE PÁGINA** (footer con información legal/copyright)
4. **SECCIÓN "Production"** o "Produktion" (si existe)

**IMPORTANTE - Lee TODO el documento ANTES de extraer**:
- ⚠️ **NO te limites a la primera mención** - Puede haber VARIAS productoras (2, 3, 4 o más)
- ⚠️ **Lee la PRIMERA PÁGINA COMPLETA** - Aquí suelen estar TODAS las productoras listadas
- ⚠️ **Lee el PIE DE PÁGINA** - A menudo lista todas las productoras en el copyright
- ✅ **Extrae TODAS** - Si hay 5 productoras, devuelve las 5
- ✅ **UNA por elemento** - Cada productora es un string separado en el array
- ✅ **Si NO encuentras NINGUNA** - Devuelve [] (array vacío)

**Razonamiento**: Como humano, ¿qué EMPRESAS/ESTUDIOS financian y producen este proyecto? (pueden ser varias en co-producción)

---

## CAMPO 4: locations (UBICACIONES DE FILMACIÓN)

### ESTO ES LO MÁS IMPORTANTE - Lee con atención:

**Tu misión**: Extraer SOLO las ubicaciones donde se FILMA (donde ruedan las cámaras)

### ¿Cómo distinguir FILMACIÓN vs LOGÍSTICA?

**Piensa como coordinador**:
- ¿Es un lugar donde ACTORES actúan y CÁMARAS filman? → FILMACIÓN (extraer)
- ¿Es un lugar donde el EQUIPO descansa/come/se cambia? → LOGÍSTICA (ignorar)

### Ejemplos prácticos:

**✅ FILMACIÓN (EXTRAER)**:
- "Drehort 1: Salmgasse 10, 1030 Wien" → Set principal
- "Location A: Schloss Schönbrunn" → Palacio donde se filma
- "Set: Hotel Imperial, Kärntner Ring 16" → Locación de rodaje
- "Motiv: Stephansplatz, Wien" → Lugar de la escena
- "Szene 15: Donauinsel" → Locación exterior

**❌ LOGÍSTICA (IGNORAR)**:
- "Basis: Parkplatz Donauinsel" → Donde aparca el equipo
- "Catering: Suite Nico" → Donde come el equipo
- "Kostüm: Trailer 5" → Vestuario del equipo
- "Parken: Parkhaus Mitte" → Parking
- "Makeup: Keller, Raum 3" → Maquillaje

**🚫 CASOS ESPECIALES (IGNORAR)**:
- "Drones: Área restringida XYZ" → NO es set principal, es equipo técnico
- "B-Unit: Segunda locación" → Si está marcada como B-Unit o equipo secundario
- "Weather Cover: Alternativa interior" → Ubicación de respaldo, NO principal
- "Pickup Point: Estación central" → Punto de recogida, NO filmación

### Reglas de contexto:

1. **Lee el CONTEXTO**: No te guíes solo por palabras. Lee la frase completa.
   - "Drehort con drones en Parque X" → Si es solo para drones, NO es set principal
   - "Set principal: Parque X (incluye tomas aéreas)" → SÍ es set principal

2. **Prioriza por JERARQUÍA**:
   - Sets numerados (Drehort 1, 2, 3) → PRINCIPALES
   - Sets con horario de escenas → PRINCIPALES
   - Menciones secundarias sin horario → EVALUAR si son principales

3. **Cantidad**: 
   - Extrae TODOS los sets principales de filmación
   - NO hay límite máximo
   - Pero NO extraigas CADA dirección mencionada (solo las de filmación)

### Formatos de dirección:

**REGLA CRÍTICA - NO DUPLICAR INFORMACIÓN**:
Si el call sheet tiene:
```
Drehort 1: Hotel Imperial
Adresse: Kärntner Ring 16, 1010 Wien
```

❌ **MAL**: "Hotel Imperial, Kärntner Ring 16, 1010 Wien" (duplica info)
❌ **MAL**: "Hotel Imperial + Kärntner Ring 16, 1010 Wien" (duplica info)
✅ **BIEN**: "Kärntner Ring 16, 1010 Wien" (solo la dirección física)

**Formatos aceptables**:
- **Dirección completa**: "Hauptstraße 100, 10115 Berlin" ← PREFERIR SIEMPRE
- **Landmark famoso** (solo si NO hay dirección): "Schloss Schönbrunn"
- **Nombre + ciudad** (solo si NO hay dirección): "Central Park, New York"

**Prioridad de extracción**:
1. Si hay dirección física (calle + número + ciudad) → Usar SOLO eso
2. Si NO hay dirección pero hay landmark famoso → Usar nombre del lugar
3. Si hay nombre genérico sin dirección → Buscar si hay dirección asociada

**Si la dirección está incompleta**:
- Si tiene contexto claro de ciudad: "Stephansplatz" → "Stephansplatz, Wien"
- Si NO hay contexto: Extrae lo que hay

---

## FILOSOFÍA CORE

**Tú eres un HUMANO inteligente leyendo un documento**:

✓ Lee TODO el documento primero para entender el contexto
✓ Entiende el PROPÓSITO de cada mención (¿filming o logistics?)
✓ Usa tu conocimiento de producción audiovisual
✓ Sé flexible con formatos pero preciso con el contenido
✓ Distingue entre set principal, equipo técnico (drones), y logística

✗ NO busques solo keywords rígidas
✗ NO asumas que todo "drehort" es principal (puede ser drones, b-unit, etc.)
✗ NO extraigas ubicaciones de equipo/crew (basis, catering, parken, makeup, wardrobe)
✗ NO inventes información que no esté en el documento

---

**FORMATO DE SALIDA**:
- SOLO JSON válido
- Sin markdown, sin explicaciones
- Estructura exacta del schema arriba

---

**CONTENIDO A ANALIZAR**:

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
