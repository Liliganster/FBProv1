# 📋 Flujo Completo de Extracción de Datos

## 🎯 Objetivo
El usuario sube un PDF (callsheet), la IA lo lee, extrae datos estructurados, corrige formatos, y crea el viaje en la tabla o proyecto.

---

## 🔄 Flujo Paso a Paso

### 1️⃣ **Usuario Sube PDF**
**Componente**: `BulkUploadModal.tsx`
```typescript
// Usuario arrastra PDF o hace click para subir
handleProcessAi() → processFileForTripUniversal()
```

**Qué pasa**:
- Usuario selecciona PDF del callsheet
- Elige modo: `direct` (rápido) o `agent` (con OCR para PDFs escaneados)
- Click en "Procesar con IA"

---

### 2️⃣ **Lectura del PDF**
**Servicio**: `services/extractor-universal/miner.ts`

#### Si el PDF tiene texto (digital):
```typescript
extractTextFromPdfFile(file) 
→ usa pdf.js para extraer texto directo
→ retorna: "DREHPLAN 25.02.2025 Projekt: VORSTADTWEIBER..."
```

#### Si el PDF es escaneado (imagen):
```typescript
extractTextWithOCRFromPdfFile(file)
→ convierte PDF a imágenes
→ usa Tesseract.js para OCR
→ limpia texto con cleanOcrText()
→ retorna: texto extraído de la imagen
```

**Resultado**: Texto plano del callsheet completo

---

### 3️⃣ **Extracción con IA**
**Servicio**: `services/extractor-universal/index.ts` → `extractUniversalStructured()`

#### Paso A: Normalizar Entrada
```typescript
normalizeDirect(input) // modo direct
normalizeAgent(input)  // modo agent (con OCR)

→ Detecta tipo de archivo (PDF, imagen, texto, CSV)
→ Extrae texto usando el método apropiado
→ Limpia y normaliza el texto
```

#### Paso B: Llamar al Proveedor de IA
```typescript
// Usa OpenRouter o Gemini (auto-selección)
resolveProvider('auto') 
→ Si tienes API key de OpenRouter → usa OpenRouter
→ Si no → usa Gemini gratuito

// Modo Direct: Una sola llamada a la IA
directParse(text, 'openrouter')
→ POST /api/ai/openrouter/structured
→ Prompt: "Extrae fecha, proyecto, productora, direcciones"
→ Respuesta: { date: "2025-02-25", projectName: "...", locations: [...] }

// Modo Agent: Múltiples llamadas con herramientas
agenticParse(text, tools, 'openrouter')
→ IA usa function calling para geocoding
→ Extrae datos paso a paso con verificación
```

---

### 4️⃣ **Procesamiento en el Servidor (Vercel)**
**Archivo**: `api/proxy.ts` → `handleOpenRouterStructured()`

```typescript
// 1. Recibe el texto del callsheet (27KB+)
const text = body.text; // Texto completo del PDF

// 2. Construye prompt ultra-estricto
const systemContent = `
  CRITICAL RULES:
  1. Extract ONLY filming locations (Drehort, Location, Set, Motiv)
  2. IGNORE logistics (Basis, Parken, Catering, Kostüm, Maske...)
  3. IGNORE room names (Suite Nico, Keller, Catering Bereich)
  4. Each location MUST be complete address with street + number
  5. Convert dates to YYYY-MM-DD
  6. Remove duplicates
`;

// 3. Llama a OpenRouter API
fetch('https://openrouter.ai/api/v1/chat/completions', {
  model: 'google/gemini-2.0-flash-001',
  messages: [
    { role: 'system', content: systemContent },
    { role: 'user', content: text }
  ],
  temperature: 0,
  response_format: { type: 'json_object' }
});

// 4. Parsea respuesta JSON
const parsed = JSON.parse(response.choices[0].message.content);
// { date: "2025-02-25", projectName: "VORSTADTWEIBER", locations: [...] }
```

**Configuración Vercel**:
- `maxDuration: 60` segundos (suficiente para callsheets grandes)
- `memory: 1024` MB (para procesar archivos grandes)

---

### 5️⃣ **Corrección de Formatos**
**Servicio**: `services/extractor-universal/postProcess.ts`

#### A. Normalización de Fechas
```typescript
// IA convierte automáticamente a YYYY-MM-DD
"25.02.2025" → "2025-02-25"
"February 25, 2025" → "2025-02-25"
"25/2/25" → "2025-02-25"
```

#### B. Filtrado Ultra-Estricto de Direcciones
```typescript
postProcessCrewFirstData(extraction) {
  
  // Para cada dirección extraída por la IA:
  locations.filter(location => {
    
    // ❌ Demasiado corta
    if (location.length < 8) return false;
    
    // ❌ Contiene keywords de logística
    const LOGISTICS = ['basis', 'parken', 'catering', 'kostüm', 'maske', 
                      'lunch', 'team', 'technik', 'office', 'trailer'...];
    if (containsAny(location, LOGISTICS)) return false;
    
    // ❌ Es nombre de habitación/zona
    const PATTERNS = [
      /^suite/i,     // "Suite Nico"
      /^keller/i,    // "Keller"
      /^bereich/i,   // "Catering Bereich"
      /^\d+\. etage/i // "2. Etage"
    ];
    if (matchesAny(location, PATTERNS)) return false;
    
    // ❌ No tiene números (calle o código postal)
    if (!/\d/.test(location)) return false;
    
    // ✅ DEBE tener: coma O código postal O nombre de ciudad
    const hasComma = location.includes(',');
    const hasPostal = /\b\d{4,5}\b/.test(location);
    const hasCity = /wien|vienna|berlin|madrid/i.test(location);
    if (!hasComma && !hasPostal && !hasCity) return false;
    
    // ✅ DEBE tener palabra de calle (si no tiene coma)
    const STREET_WORDS = ['straße', 'gasse', 'weg', 'platz', 
                         'street', 'avenue', 'road', 'calle'];
    const hasStreet = containsAny(location, STREET_WORDS);
    if (!hasStreet && !hasComma) return false;
    
    return true; // ✅ Dirección válida
  });
}
```

**Ejemplos de Filtrado**:

| Extraído por IA | Filtro | Resultado |
|----------------|--------|-----------|
| `"Salmgasse 10, 1030 Wien"` | ✅ | **VÁLIDA** - tiene calle, número, postal, ciudad |
| `"Palais Rasumofsky, 23-25, 1030 Wien"` | ✅ | **VÁLIDA** - dirección completa con coma |
| `"Suite Nico"` | ❌ | **FILTRADA** - patrón inválido (^suite) |
| `"Keller"` | ❌ | **FILTRADA** - patrón inválido (^keller) |
| `"Catering Bereich"` | ❌ | **FILTRADA** - keyword "catering" + "bereich" |
| `"Basis & Parken"` | ❌ | **FILTRADA** - keywords "basis" y "parken" |
| `"2. Etage"` | ❌ | **FILTRADA** - patrón de piso sin dirección |
| `"Team Lunch"` | ❌ | **FILTRADA** - keywords "team" y "lunch" |
| `"Kostüm Raum 5"` | ❌ | **FILTRADA** - keyword "kostüm" |

#### C. Deduplicación
```typescript
// Elimina direcciones duplicadas preservando orden
const seen = new Set();
locations = locations.filter(loc => {
  const key = loc.toLowerCase();
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
```

---

### 6️⃣ **Construcción del Viaje**
**Servicio**: `services/aiService.ts` → `processFileForTripUniversal()`

```typescript
// 1. Extraer datos limpios
const extraction = await extractUniversalStructured(...);
// { 
//   date: "2025-02-25",
//   projectName: "VORSTADTWEIBER",
//   locations: ["Salmgasse 10, 1030 Wien", "Palais Rasumofsky..."]
// }

// 2. Agregar origen/destino (dirección de casa)
const userHome = "Musterstraße 1, 1010 Wien";
const fullRoute = [userHome, ...extraction.locations, userHome];

// 3. Calcular distancia con Google Maps
const distance = await calculateDistanceViaBackend(fullRoute);
// 45.3 km

// 4. Construir objeto Trip
const tripData = {
  date: extraction.date,           // "2025-02-25"
  locations: fullRoute,             // [Casa, Loc1, Loc2, Casa]
  distance: distance,               // 45.3
  reason: extraction.projectName,   // "VORSTADTWEIBER"
  specialOrigin: SpecialOrigin.HOME
};

// 5. Retornar datos para crear viaje
return { 
  tripData, 
  projectName: extraction.projectName,
  productionCompany: extraction.productionCompany 
};
```

---

### 7️⃣ **Crear Viaje en Supabase**
**Componente**: `BulkUploadModal.tsx` → `handleProcessAi()`

```typescript
// 1. Procesar archivo
const result = await processFileForTripUniversal(file, profile, mode);

// 2. Buscar o crear proyecto
let project = await findProjectByName(result.projectName);
if (!project) {
  project = await createProject({
    name: result.projectName,
    company: result.productionCompany
  });
}

// 3. Crear viaje
const trip = await createTrip({
  ...result.tripData,
  projectId: project.id
});

// 4. Actualizar UI
showToast("✅ Viaje creado exitosamente");
refreshTripsTable();
```

---

## 📊 Resumen Visual del Flujo

```
PDF Upload
    ↓
┌─────────────────────┐
│  1. Leer Archivo    │
│  • pdf.js (texto)   │
│  • Tesseract (OCR)  │
└─────────────────────┘
    ↓
┌─────────────────────┐
│  2. Extraer con IA  │
│  • OpenRouter API   │
│  • Prompt estricto  │
└─────────────────────┘
    ↓
┌─────────────────────┐
│  3. Corregir Datos  │
│  • Fechas → YYYY-MM-DD
│  • Filtrar logística
│  • Validar direcciones
└─────────────────────┘
    ↓
┌─────────────────────┐
│  4. Calcular Ruta   │
│  • Google Maps API  │
│  • Distancia total  │
└─────────────────────┘
    ↓
┌─────────────────────┐
│  5. Guardar Trip    │
│  • Crear proyecto   │
│  • Insertar en DB   │
└─────────────────────┘
```

---

## 🔍 Logs para Debugging

### En el Navegador (Consola):
```
[BulkUpload] Starting AI extraction for 1 item(s) in direct mode
[ExtractorUniversal] Starting extraction: { mode: 'direct', provider: 'auto' }
[ExtractorUniversal] Normalized text length: 27162 source: pdf
[ExtractorUniversal] Using provider: openrouter
[DirectParse] Starting parse with provider: openrouter useCrewFirst: false
[DirectParse] OpenRouter result: { date: "2025-02-25", projectName: "...", locations: [...] }
[PostProcess] ❌ Filtered out invalid location: "Suite Nico"
[PostProcess] ❌ Logistics keyword "catering": "Catering Bereich"
[PostProcess] ✅ Valid address: "Salmgasse 10, 1030 Wien"
[PostProcess] Final locations count: 3
[BulkUpload] Successfully processed 1/1 files
```

### En Vercel (Logs del Servidor):
```
[OpenRouter Structured] Processing request: { textLength: 27162, useCrewFirst: false }
[OpenRouter Structured] Sending request to OpenRouter API...
[OpenRouter Structured] Response received in 15234ms, status: 200
[OpenRouter Structured] Successfully parsed response
```

---

## ⚠️ Casos Especiales

### Caso 1: PDF Escaneado (Sin Texto)
```typescript
// Modo Direct: Error "requires_ocr"
throw new ExtractorError('requires_ocr', 'Use Agent Mode (OCR)');

// Modo Agent: Automático
extractTextWithOCRFromPdfFile(file)
→ Tesseract extrae texto de imágenes
→ Continúa normalmente
```

### Caso 2: Fechas en Múltiples Formatos
```typescript
// IA normaliza automáticamente:
"25.02.2025" → "2025-02-25"
"February 25, 2025" → "2025-02-25"
"25/2/25" → "2025-02-25"
"Montag, 25. Februar 2025" → "2025-02-25"
```

### Caso 3: Direcciones Incompletas
```typescript
// IA puede extraer:
"Salmgasse 10"  // Sin postal ni ciudad

// Post-proceso valida:
if (!hasComma && !hasPostal && !hasCity) {
  return false; // ❌ Filtrada
}

// SOLUCIÓN: IA debe incluir dirección completa
// Prompt instruye: "Each location MUST be complete with street + number + postal + city"
```

### Caso 4: Múltiples Proyectos en Un Callsheet
```typescript
// IA extrae el primer/principal proyecto
projectName: "VORSTADTWEIBER"

// Si hay sub-proyectos, quedan en notas
// Usuario puede editar manualmente después
```

---

## ✅ Checklist de Validación

| Paso | ✓ | Descripción |
|------|---|-------------|
| **Lectura** | ✅ | PDF → Texto (pdf.js o Tesseract OCR) |
| **Extracción** | ✅ | Texto → JSON estructurado (OpenRouter/Gemini) |
| **Fecha** | ✅ | Normalizada a YYYY-MM-DD |
| **Direcciones** | ✅ | Solo direcciones completas de filmación |
| **Filtrado** | ✅ | Sin logística, sin habitaciones, sin duplicados |
| **Geocoding** | ✅ | Cálculo de distancia con Google Maps |
| **Proyecto** | ✅ | Crear/buscar proyecto por nombre |
| **Viaje** | ✅ | Insertar en Supabase con datos completos |

---

## 🚀 Estado Actual

### ✅ Implementado:
1. Lectura de PDF (texto + OCR)
2. Extracción con IA (OpenRouter/Gemini)
3. Prompts ultra-estrictos
4. Filtrado post-procesamiento (30+ keywords)
5. Normalización de fechas (YYYY-MM-DD)
6. Validación de direcciones (multi-criterio)
7. Deduplicación
8. Cálculo de distancia
9. Creación de viaje en DB
10. Logging completo (debug)

### 📤 Pendiente:
1. **Deploy a Vercel** con nuevo timeout (60s)
2. **Probar en producción** con callsheet real
3. **Ajustar filtros** si algunos casos especiales fallan

---

## 📞 Soporte

Si algo falla, revisa:
1. **Consola del navegador** (F12) - errores del frontend
2. **Logs de Vercel** - errores del backend
3. **Este documento** - flujo completo explicado

Copia los logs exactos para diagnosticar el problema.
