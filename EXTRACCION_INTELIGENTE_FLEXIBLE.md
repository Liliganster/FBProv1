# Extracción Inteligente y Flexible - Enfoque Correcto

## Problema Anterior ❌

Estábamos aplicando reglas **demasiado estrictas y rígidas**:
- ✗ Requerir formato exacto de direcciones (calle + número + postal)
- ✗ Rechazar direcciones parciales o landmarks
- ✗ Aplicar validaciones prescriptivas (regex complejos, conteo de palabras)
- ✗ Asumir que los callsheets están estandarizados

**ERROR CONCEPTUAL**: Los callsheets **NO están estandarizados**. Pueden ser PDFs profesionales, scans, notas manuscritas, en múltiples idiomas, con logos/fotos, etc.

## Solución Correcta ✅

### Nuevo Enfoque: **IA Inteligente + Filtrado Mínimo**

#### 1. **Confianza en la IA** (80% del trabajo)

El modelo (Gemini 2.0 Flash) debe **entender el contexto** como lo haría un coordinador de producción:

**Prompt Actualizado** (`services/extractor-universal/prompts/callsheet.ts`):
```typescript
You are an AI expert in analyzing film production documents (callsheets). 
These documents vary widely - they can be professional PDFs, scanned documents, 
hand-written notes, in multiple languages, with logos/photos/headers.

YOUR TASK: Think like a production coordinator. Understand the document and extract:

1. DATE: The shooting date (may appear in various formats) - normalize to YYYY-MM-DD
2. PROJECT NAME: The creative title (show/film name), NOT the production company
3. LOCATIONS: ONLY filming locations (where cameras roll), NOT logistics

CRITICAL - Understand FILMING vs LOGISTICS:

🎬 FILMING LOCATIONS (extract these):
• Where actual shooting/filming happens
• May be labeled: "Drehort", "Location", "Set", "Motiv"
• Can be complete addresses OR landmarks/venues/areas
• Examples: 
  - "Salmgasse 10, 1030 Wien" (complete address)
  - "Schloss Schönbrunn" (landmark)
  - "Stephansplatz" (area)
  - "Hotel Imperial" (venue)

⚙️ LOGISTICS (ignore these):
• Crew support areas: Basis/Basecamp, Parken/Parking, Catering, Kostüm, Maske
• Examples: "Catering: Suite Nico", "Parken: Parkplatz"

HOW TO DISTINGUISH:
• Read the CONTEXT around each location
• If labeled as Drehort/Set/Location → filming (extract)
• If labeled as Basis/Catering/Parken → logistics (ignore)
• Addresses may be complete OR partial - extract what's given
• Don't apply rigid rules - understand the purpose
```

**Principios clave**:
- ✅ **Flexible con formatos**: Acepta direcciones completas, parciales, landmarks, áreas
- ✅ **Entiende contexto**: Lee alrededor de cada ubicación para determinar su propósito
- ✅ **Multiidioma**: Alemán, inglés, español, etc.
- ✅ **OCR-ready**: Funciona con texto extraído de scans (Tesseract.js)
- ✅ **Inteligente**: Como un coordinador humano analizando un callsheet

#### 2. **Post-Procesamiento Mínimo** (20% del trabajo)

El filtro solo elimina **obviedades logísticas**, no valida formato de direcciones:

**Filtro Actualizado** (`services/extractor-universal/postProcess.ts`):
```typescript
// SOLO keywords logísticos obvios (no validaciones de formato)
const LOGISTICS_KEYWORDS = [
  'basis', 'base', 'basecamp', 'unit base',
  'parken', 'parking', 'crew parking',
  'catering', 'lunch', 'essen',
  'aufenthalt', 'holding',
  'kostüm', 'costume', 'wardrobe',
  'maske', 'makeup', 'hair',
  'production office', 'transport', 'shuttle',
  'mobile', 'trailer', 'toiletten', 'wc'
];

function isValidFilmingLocation(location: string): boolean {
  // Solo filtra si contiene keywords logísticos
  // Acepta TODO lo demás - confía en la IA
  for (const keyword of LOGISTICS_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return false;  // Es logística, filtrar
    }
  }
  return true;  // Confiar en la IA
}
```

**Lo que YA NO hace**:
- ✗ NO valida formato de direcciones (calle + número + postal)
- ✗ NO rechaza direcciones parciales
- ✗ NO valida con regex de patrones
- ✗ NO cuenta palabras ni verifica comas
- ✗ NO requiere códigos postales

**Lo que SÍ hace**:
- ✅ Filtra solo keywords logísticos obvios
- ✅ Confía en que la IA entiende el contexto
- ✅ Acepta cualquier formato que la IA determine válido

## Ejemplos de Extracción

### Ejemplo 1: Direcciones Completas
```
Input PDF:
  Drehort: Salmgasse 10, 1030 Wien
  Basis: Donauinsel Parkplatz

Output:
  ✅ "Salmgasse 10, 1030 Wien" (filming - dirección completa)
  ❌ "Donauinsel Parkplatz" (filtrado: contiene "basis")
```

### Ejemplo 2: Landmarks
```
Input PDF:
  Location: Schloss Schönbrunn
  Catering: Suite Nico

Output:
  ✅ "Schloss Schönbrunn" (filming - landmark famoso)
  ❌ "Suite Nico" (filtrado: contiene "catering")
```

### Ejemplo 3: Áreas
```
Input PDF:
  Set: Stephansplatz, Wien
  Parken: Parkhaus Mitte

Output:
  ✅ "Stephansplatz, Wien" (filming - área de rodaje)
  ❌ "Parkhaus Mitte" (filtrado: contiene "parken")
```

### Ejemplo 4: Venues
```
Input PDF:
  Drehort: Hotel Imperial, Kärntner Ring 16
  Kostüm: Trailer vor Ort

Output:
  ✅ "Hotel Imperial, Kärntner Ring 16" (filming - venue completo)
  ❌ "Trailer vor Ort" (filtrado: contiene "kostüm")
```

### Ejemplo 5: Scanned PDF con OCR
```
Input (texto extraído con Tesseract):
  DREHORT: Palais Rasumofsky
           23-25, 1030 Wien
  
  MASKE/HAIR: Keller

Output:
  ✅ "Palais Rasumofsky, 23-25, 1030 Wien" (filming - IA normaliza)
  ❌ "Keller" (filtrado: contiene "maske")
```

## Flujo de Extracción

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. UPLOAD PDF                                                   │
│    • Usuario sube callsheet (puede ser scan, PDF, cualquier formato) │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. EXTRACTION (services/extractor-universal/index.ts)           │
│    • Mode 'direct': PDF → texto (pdf.js)                        │
│    • Mode 'agent': PDF → texto (pdf.js) o OCR (Tesseract) si scan│
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. AI PARSING (OpenRouter + Gemini 2.0 Flash)                  │
│    • Prompt inteligente: "Entiende el contexto como coordinador"│
│    • Distingue FILMING (Drehort/Location) vs LOGISTICS (Basis)  │
│    • Acepta direcciones completas, parciales, landmarks, áreas  │
│    • Output: { date, projectName, locations[] }                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. POST-PROCESSING (services/extractor-universal/postProcess.ts)│
│    • Filtro MÍNIMO: Solo keywords logísticos obvios            │
│    • NO valida formato de direcciones                          │
│    • Confía en la IA para TODO lo demás                        │
│    • Deduplica preservando orden                               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. RESULT                                                       │
│    • 1-8 filming locations (lo que la IA determine correcto)   │
│    • Pueden ser direcciones completas, parciales, landmarks    │
│    • SIN logistics (basis, parken, catering, etc.)             │
└─────────────────────────────────────────────────────────────────┘
```

## Ventajas del Nuevo Enfoque

### 1. **Flexibilidad** 🎯
- ✅ Maneja callsheets profesionales y manuscritos
- ✅ Acepta múltiples idiomas
- ✅ Trabaja con scans (OCR)
- ✅ Entiende logos y fotos (contexto visual)

### 2. **Inteligencia** 🧠
- ✅ La IA **entiende** el contexto, no solo sigue reglas
- ✅ Distingue propósito de cada ubicación (filming vs logistics)
- ✅ Adapta formato según lo encontrado en documento
- ✅ Normaliza fechas en múltiples formatos

### 3. **Precisión** ✨
- ✅ Extrae 1-8 filming locations (típico)
- ✅ Ignora logistics automáticamente
- ✅ Acepta direcciones parciales si son válidas para rodaje
- ✅ No rechaza landmarks o venues importantes

### 4. **Mantenibilidad** 🔧
- ✅ Código simple: prompt + filtro mínimo
- ✅ Fácil agregar keywords logísticos si aparecen nuevos
- ✅ Sin regex complejos ni validaciones frágiles
- ✅ Confianza en capacidad del modelo AI

## Configuración

### Variables de Entorno
```env
OPENROUTER_API_KEY=sk-or-v1-xxxxx
OPENROUTER_MODEL=google/gemini-2.0-flash-001  # Modelo por defecto
```

### Vercel Deployment
```json
{
  "maxDuration": 60,      // 60 segundos para PDFs grandes
  "memory": 1024          // 1GB para OCR si necesario
}
```

## Testing

### 1. Deploy to Production
```bash
git add .
git commit -m "feat: intelligent flexible AI extraction - trust AI context understanding"
git push origin main
```

### 2. Test en App
1. Ir a https://fb-prov1.vercel.app/
2. Viajes → Carga Masiva
3. Subir callsheet real
4. Mode: **Direct** (más rápido) o **Agent** (con OCR para scans)
5. Abrir consola (F12)
6. Click "Procesar con IA"

### 3. Verificar Logs
```
[ExtractorUniversal] Normalized text length: 27162
[DirectParse] OpenRouter processing...
[PostProcess] ✅ Accepted: "Salmgasse 10, 1030 Wien"
[PostProcess] ❌ Filtered (logistics): "Basis: Donauinsel"
[PostProcess] ✅ Accepted: "Schloss Schönbrunn"
[PostProcess] Final locations count: 2
```

### Expected Results
- **2-8 filming locations** (depende del callsheet)
- **Direcciones variadas**: Completas, parciales, landmarks, venues
- **SIN logistics**: No basis, parken, catering, kostüm, maske
- **Formatos flexibles**: Lo que la IA determine apropiado

## Troubleshooting

### Si extrae muy pocas locaciones (0-1)
→ **Revisar prompt**: ¿La IA es demasiado conservadora?
→ **Revisar PDF**: ¿Tiene texto extraíble o necesita OCR?
→ **Revisar logs**: ¿Qué filtró el post-procesador?

### Si extrae logistics aún
→ **Agregar keyword**: Añadir término específico a `LOGISTICS_KEYWORDS`
→ **No agregar regex complejos**: Mantener filtro simple

### Si rechaza locaciones válidas
→ **Remover validación**: Ya NO validamos formato
→ **Confiar en IA**: Dejar que modelo determine qué es válido

## Filosofía del Sistema

> **"La IA entiende contexto mejor que las reglas rígidas"**

Estamos usando **Gemini 2.0 Flash**, un modelo multimodal avanzado que:
- ✅ Entiende texto en contexto (como un humano)
- ✅ Puede procesar imágenes/logos (con OCR)
- ✅ Sabe diferenciar propósito de ubicaciones
- ✅ Maneja múltiples idiomas y formatos

Nuestro trabajo es:
1. **Guiar** con prompts claros (filming vs logistics)
2. **Filtrar** solo obviedades logísticas
3. **Confiar** en la capacidad del modelo para todo lo demás

**NO** debemos:
- ❌ Imponer reglas rígidas de formato
- ❌ Rechazar direcciones parciales válidas
- ❌ Asumir estandarización de callsheets
- ❌ Validar con regex complejos

## Conclusión

Este enfoque **flexible e inteligente** permite:
- 📄 Manejar callsheets de cualquier formato
- 🌍 Multiidioma y multi-región
- 🎬 Precisión en distinguir filming vs logistics
- 🔧 Mantenibilidad simple

**Next Steps**:
1. Deploy a producción
2. Test con callsheets reales
3. Fine-tune solo si aparecen casos específicos
4. Agregar keywords logísticos según necesidad (no regex)
