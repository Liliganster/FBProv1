# Fix: "Proyecto Desconocido" - Extracción de projectName mejorada

## Problema identificado

Los viajes extraídos mostraban "Proyecto Desconocido" en lugar del nombre real del proyecto debido a:

1. **Raíz del problema**: La IA a veces no extraía el `projectName` de los callsheets, dejándolo vacío
2. **Consecuencia**: Cuando `projectName` está vacío, el trip se guarda sin proyecto asociado
3. **Síntoma visible**: La UI muestra "Proyecto Desconocido" porque no encuentra el proyecto

## Flujo del problema

```
Callsheet PDF → AI extrae → projectName: "" (vacío)
                              ↓
                    BulkUploadModal recibe projectName vacío
                              ↓
                    Crea proyecto con nombre vacío o no lo crea
                              ↓
                    Trip se guarda con projectId inválido
                              ↓
                    TripsView busca proyecto y no lo encuentra
                              ↓
                    Muestra "Proyecto Desconocido" ❌
```

## Solución implementada (3 capas de protección)

### 1. **Prompt mejorado** (Prevención primaria)
**Archivo**: `services/extractor-universal/prompts/callsheet.ts`

**Cambios**:
- ⚠️ Marcado `projectName` como **CRÍTICO** - nunca debe quedar vacío
- Añadidas instrucciones explícitas sobre dónde buscar el título del proyecto:
  1. Encabezado principal (primera página, arriba)
  2. Logos o títulos decorativos
  3. Palabras clave: "Projekt:", "Título:", "Serie:", "Film:", etc.
  4. Metadata o footer
  5. Cualquier nombre prominente que se repita

- Ejemplos claros de qué SÍ y qué NO es un projectName:
  - ✅ "Dark", "El Reino", "Succession", "1899", "Babylon Berlin"
  - ❌ "Netflix", "UFA Fiction", "Warner Bros" (son productoras)

- Estrategia de búsqueda paso a paso para evitar confusiones
- Instrucción de fallback: si no encuentra nada claro, usar "Untitled Project"

### 2. **Logging detallado** (Diagnóstico)
**Archivo**: `services/extractor-universal/index.ts`

**Cambios**:
```typescript
// Detecta y alerta cuando projectName está vacío
if (!parsed.projectName || !parsed.projectName.trim()) {
  console.warn('[ExtractorUniversal] ⚠️ WARNING: AI returned empty projectName!', {
    rawProjectName: parsed.projectName,
    productionCompanies: parsed.productionCompanies,
    date: parsed.date,
    locationsCount: parsed.locations?.length
  });
} else {
  console.log('[ExtractorUniversal] ✓ Extracted projectName:', parsed.projectName);
}
```

**Beneficios**:
- Visibilidad inmediata cuando la IA falla en extraer projectName
- Información de contexto para debugging (productoras, fecha, locaciones)
- Confirmación visual cuando sí se extrae correctamente

### 3. **Fallback en aiService** (Última línea de defensa)
**Archivo**: `services/aiService.ts`

**Cambios**:
```typescript
// Ensure projectName is never empty - provide fallback
const projectName = (extraction.projectName || '').trim() || 'Untitled Project';

return { tripData, projectName, productionCompany };
```

**Beneficios**:
- Garantiza que siempre hay un projectName válido
- Si la IA falla completamente, el usuario verá "Untitled Project" en lugar de "Proyecto Desconocido"
- Puede editar manualmente el nombre después

## Archivos modificados

1. ✅ `services/extractor-universal/prompts/callsheet.ts`
   - Prompt mucho más explícito sobre cómo extraer projectName
   - Ejemplos claros y estrategia de búsqueda paso a paso

2. ✅ `services/extractor-universal/index.ts`
   - Warning cuando projectName está vacío
   - Log de confirmación cuando se extrae correctamente

3. ✅ `services/aiService.ts`
   - Fallback a "Untitled Project" si extraction.projectName está vacío

## Resultado esperado

### Antes ❌
```
Callsheet: "DARK - Episodio 5"
          ↓
AI extrae: { projectName: "", productionCompanies: ["Netflix"], ... }
          ↓
UI muestra: "Proyecto Desconocido"
```

### Después ✅
```
Callsheet: "DARK - Episodio 5"
          ↓
AI extrae: { projectName: "Dark", productionCompanies: ["Netflix"], ... }
          ↓
UI muestra: "Dark"
```

### Caso extremo (fallback) ⚠️
```
Callsheet sin título visible
          ↓
AI no encuentra: { projectName: "", ... }
          ↓
Fallback: projectName = "Untitled Project"
          ↓
UI muestra: "Untitled Project" (editable manualmente)
```

## Testing recomendado

1. **Callsheets normales**: Verificar que extrae el nombre correcto
   - Ejemplo: "Dark", "El Reino", "Succession"

2. **Callsheets con solo logo**: Verificar que identifica el título del logo
   - Ejemplo: Logo de "1899" → projectName: "1899"

3. **Callsheets ambiguos**: Verificar que no confunde productora con título
   - Ejemplo: "Netflix presenta: Dark" → projectName: "Dark" (no "Netflix")

4. **Callsheets sin título**: Verificar que usa fallback
   - Resultado esperado: "Untitled Project" (editable)

## Monitorización

- Revisar console logs en producción para detectar casos donde AI devuelve projectName vacío
- Si se detectan muchos warnings, revisar y mejorar el prompt aún más
- Considerar añadir métricas de calidad de extracción

## Próximos pasos (opcional)

Si el problema persiste en casos específicos:

1. **Análisis de casos fallidos**: Guardar PDFs problemáticos para análisis
2. **Prompt A/B testing**: Probar variaciones del prompt para ver cuál tiene mejor tasa de éxito
3. **Post-processing inteligente**: Inferir projectName de productionCompany si es necesario
   - Ejemplo: Si productionCompany incluye "Dark GmbH" → projectName podría ser "Dark"
4. **UI feedback**: Permitir al usuario marcar extracciones incorrectas para mejorar el sistema

---

**Estado**: ✅ Implementado y listo para testing  
**Fecha**: 2025-01-XX  
**Impacto**: Reduce "Proyecto Desconocido" en viajes extraídos  
**Riesgo**: Bajo - Solo mejora la robustez sin cambiar lógica core
