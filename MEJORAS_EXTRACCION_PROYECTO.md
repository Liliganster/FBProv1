# 🎯 Mejoras en la Detección del Nombre del Proyecto

## 📋 Resumen del Problema

Algunos documentos PDF no detectaban correctamente el nombre del proyecto, resultando en viajes marcados como "Proyecto Desconocido" en la interfaz.

## ✅ Soluciones Implementadas

### 1. 🤖 Prompt Mejorado para IA (Prevención Primaria)

**Archivo**: `services/extractor-universal/prompts/callsheet.ts`

#### Mejoras implementadas:

##### a) **Método de Extracción en 5 Pasos**
1. **PASO 1**: Buscar en encabezado principal (primeros 20% del documento)
   - Texto más grande/prominente
   - Formato especial (MAYÚSCULAS, negrita, centrado)
   - Códigos de proyecto: "FUNDBOX", "DRK-S3", etc.

2. **PASO 2**: Buscar después de palabras clave
   - Alemán: "Projekt:", "Serie:", "Film:", "Titel:"
   - Inglés: "Project:", "Series:", "Title:", "Show:"
   - Español: "Proyecto:", "Serie:", "Película:", "Título:"

3. **PASO 3**: Analizar patrones visuales
   - Líneas con un solo texto destacado
   - Texto antes de fecha/detalles de producción
   - Códigos alfanuméricos (4-12 caracteres)
   - Nombres que se repiten

4. **PASO 4**: Eliminar falsos positivos
   - NO nombres de productoras (GmbH, LLC, Film, Pictures)
   - NO broadcasters (Netflix, HBO, ARD, ZDF)
   - NO tipo de documento (Call Sheet, Disposición)
   - NO locaciones (Estudio 5, Set A)
   - NO números de episodio solos

5. **PASO 5**: Extracción inteligente con separadores
   - "Netflix Presents: **Dark**" → "Dark"
   - "UFA Fiction - **El Reino**" → "El Reino"
   - "**FUNDBOX** Call Sheet #3" → "FUNDBOX"

##### b) **Ejemplos Prácticos**
```
✅ "FUNDBOX - Call Sheet #3" → projectName = "FUNDBOX"
✅ Header: "DARK" / pequeño: "Netflix Original" → projectName = "DARK"
✅ "Projekt: El Reino | Episode 5" → projectName = "El Reino"
✅ "Call Sheet - 1899 - Tag 15" → projectName = "1899"
```

##### c) **Estrategias de Último Recurso**
- Buscar en nombres de archivo del OCR
- Buscar códigos alfanuméricos prominentes
- Inferir del contexto (episode + productora → buscar en footer)
- Último recurso: "Untitled Project" (extremadamente raro)

---

### 2. 🔍 Sistema de Inferencia Inteligente (Capa de Seguridad)

**Archivo**: `services/extractor-universal/postProcess.ts`

#### Nueva función: `inferProjectNameFromFilename()`

Extrae el nombre del proyecto desde el nombre del archivo cuando la IA falla:

```typescript
// Patrones soportados:
"FUNDBOX_call_sheet_3.pdf" → "FUNDBOX"
"DARK-CallSheet-5.pdf" → "DARK"
"ElReino_Hoja_Rodaje.pdf" → "ElReino"
```

**Estrategia**:
1. Remueve extensión (.pdf, .png, etc.)
2. Busca patrón: `NOMBRE_call_sheet_N`
3. Busca códigos de proyecto (4-12 caracteres en mayúsculas)
4. Busca patrón: `Nombre - Call Sheet`

#### Nueva función: `inferProjectNameFromContext()`

Busca indicios del nombre del proyecto en el texto extraído:

```typescript
// Estrategias:
1. Patrones de filename en OCR
2. Códigos de proyecto en los primeros 1000 caracteres
3. Valores después de "Project:", "Serie:", etc.
```

#### Flujo de Inferencia en Cascada:

```
1. IA extrae projectName → ✅ Usar
   ↓ (si está vacío)
2. inferProjectNameFromContext(texto) → ✅ Usar
   ↓ (si está vacío)
3. inferProjectNameFromFilename(archivo) → ✅ Usar
   ↓ (si está vacío)
4. Fallback: "Untitled Project" ⚠️
```

---

### 3. 🛡️ Validación y Filtrado Mejorado

**Archivo**: `services/extractor-universal/postProcess.ts`

#### Protección contra falsos positivos:

```typescript
// Detecta y elimina nombres que parecen empresas:
looksLikeCompanyName() → filtra "Netflix GmbH", "UFA Fiction"

// Detecta y elimina empresas conocidas:
isNonProductionCompany() → filtra broadcasters, streaming, fondos
```

**Lista de exclusión**:
- Broadcasters alemanes: ARD, ZDF, RTL, SAT.1, ProSieben
- Broadcasters austriacos/suizos: ORF, SRF
- Plataformas streaming: Netflix, Amazon Prime, HBO, Disney+
- Fondos de cine: BKM, FFA, ICAA, Eurimages
- Empresas de servicios: ARRI, Panavision, rental companies

---

### 4. 📊 Logging Mejorado (Diagnóstico)

**Archivo**: `services/extractor-universal/index.ts`

#### Nuevo logging:

```javascript
console.log('[ExtractorUniversal] Filename:', fileName || 'N/A');

console.warn('[ExtractorUniversal] ⚠️ WARNING: AI returned empty projectName!', {
  rawProjectName: parsed.projectName,
  productionCompanies: parsed.productionCompanies,
  date: parsed.date,
  locationsCount: parsed.locations?.length,
  fileName
});

console.log('[PostProcess] ✅ Successfully inferred projectName from filename: "FUNDBOX"');
```

**Beneficios**:
- Visibilidad inmediata cuando falla la extracción
- Información de contexto para debugging
- Confirmación de las estrategias de recuperación exitosas

---

### 5. 🔧 Herramienta de Diagnóstico

**Archivo**: `scripts/diagnose-pdf.ts`

Nueva herramienta para analizar PDFs problemáticos:

```bash
# Uso:
npm run diagnose-pdf public/images/FUNDBOX_call_sheet_3.pdf
```

**Output**:
```
========================================
🔍 PDF EXTRACTION DIAGNOSTIC TOOL
========================================

📄 Analyzing PDF: FUNDBOX_call_sheet_3.pdf

🤖 Running extraction with AGENT mode...

========================================
📊 EXTRACTION RESULTS
========================================

✅ Project Name: FUNDBOX
📅 Date: 2024-12-15
🏢 Production Companies: ["Example Productions"]
📍 Locations: 3

========================================
🔍 ANALYSIS
========================================

✅ Project name extracted successfully: "FUNDBOX"
```

---

## 📈 Resultado Esperado

### Antes ❌
```
PDF: "FUNDBOX_call_sheet_3.pdf"
          ↓
AI extrae: { projectName: "", productionCompanies: [...], ... }
          ↓
UI muestra: "Proyecto Desconocido" ❌
```

### Después ✅

#### Escenario 1: IA funciona correctamente
```
PDF: "FUNDBOX_call_sheet_3.pdf"
          ↓
AI extrae: { projectName: "FUNDBOX", ... }
          ↓
UI muestra: "FUNDBOX" ✅
```

#### Escenario 2: IA falla, inferencia desde texto
```
PDF con texto "Project: FUNDBOX"
          ↓
AI extrae: { projectName: "", ... }
          ↓
Inferencia desde texto: "FUNDBOX"
          ↓
UI muestra: "FUNDBOX" ✅
```

#### Escenario 3: IA falla, inferencia desde filename
```
PDF: "FUNDBOX_call_sheet_3.pdf"
          ↓
AI extrae: { projectName: "", ... }
          ↓
Inferencia desde filename: "FUNDBOX"
          ↓
UI muestra: "FUNDBOX" ✅
```

#### Escenario 4: Todo falla (extremadamente raro)
```
PDF sin información clara
          ↓
AI extrae: { projectName: "", ... }
          ↓
Fallback: "Untitled Project"
          ↓
UI muestra: "Untitled Project" ⚠️ (editable manualmente)
```

---

## 🧪 Casos de Prueba

### 1. **PDFs con título claro**
- Verificar que extrae correctamente: "Dark", "El Reino", "Succession"

### 2. **PDFs con solo logo**
- Verificar que identifica título del logo/imagen
- Ejemplo: Logo de "1899" → projectName: "1899"

### 3. **PDFs ambiguos**
- Verificar que NO confunde productora con título
- "Netflix presenta: Dark" → "Dark" (no "Netflix")
- "UFA Fiction - El Reino" → "El Reino" (no "UFA Fiction")

### 4. **PDFs con nombre en filename**
- "FUNDBOX_call_sheet_3.pdf" → "FUNDBOX"
- "DARK-CallSheet-5.pdf" → "DARK"

### 5. **PDFs sin título claro**
- Resultado esperado: "Untitled Project" (editable)

---

## 🔍 Monitoreo

### Qué revisar en los logs:

```javascript
// ✅ Éxito - IA extrajo correctamente
'[ExtractorUniversal] ✓ Extracted projectName: FUNDBOX'

// ⚠️ Advertencia - IA falló, intentando inferencia
'[PostProcess] ⚠️ projectName is empty, attempting to infer...'

// ✅ Recuperación exitosa desde texto
'[PostProcess] ✅ Successfully inferred projectName from context: "FUNDBOX"'

// ✅ Recuperación exitosa desde filename
'[PostProcess] ✅ Successfully inferred projectName from filename: "FUNDBOX"'

// ⚠️ Fallback usado
'[PostProcess] ⚠️ All inference attempts failed. Using fallback: "Untitled Project"'
```

---

## 🚀 Próximos Pasos (si el problema persiste)

1. **Análisis de casos fallidos**
   - Guardar PDFs problemáticos para análisis
   - Usar `scripts/diagnose-pdf.ts` para debugging

2. **Prompt A/B testing**
   - Probar variaciones del prompt
   - Medir tasa de éxito en diferentes formatos

3. **Machine Learning**
   - Entrenar modelo personalizado en callsheets
   - Usar histórico de correcciones manuales

4. **UI Feedback**
   - Permitir marcar extracciones incorrectas
   - Aprender de correcciones del usuario

---

## 📝 Resumen de Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `services/extractor-universal/prompts/callsheet.ts` | ✅ Prompt mejorado con 5 pasos + ejemplos |
| `services/extractor-universal/postProcess.ts` | ✅ Inferencia inteligente (texto + filename) |
| `services/extractor-universal/index.ts` | ✅ Logging mejorado + paso de filename |
| `scripts/diagnose-pdf.ts` | ✨ Nueva herramienta de diagnóstico |

---

## ✨ Beneficios

1. **Reducción drástica** de "Proyecto Desconocido"
2. **Múltiples capas de protección** (IA → contexto → filename → fallback)
3. **Mejor debugging** con logs detallados
4. **Herramienta de diagnóstico** para casos problemáticos
5. **Experiencia de usuario mejorada** (menos correcciones manuales)

---

**Estado**: ✅ Implementado  
**Fecha**: Enero 2025  
**Riesgo**: Bajo - Solo mejora robustez  
**Impacto**: Alto - Mejora significativa en UX
