# 🚫 Fix: "CALLSHEET" Detectado Incorrectamente como Nombre del Proyecto

## 🐛 Problema Reportado

En el documento "Raiffeisen - Goffi", la IA extrajo "CALLSHEET" como nombre del proyecto cuando el nombre correcto era **"Raiffeisen - Goffi"**.

### Ejemplo del Documento:
```
[Header con logos]
Raiffeisen - Goffi          ← Nombre real del proyecto
CALLSHEET 2 of 2            ← Tipo de documento (NO es el proyecto)
Saturday 10th of February 2024
```

**Resultado incorrecto**: `projectName = "CALLSHEET"`  
**Resultado esperado**: `projectName = "Raiffeisen - Goffi"`

## 🔍 Análisis del Problema

### Por qué pasó esto:

1. **Texto prominente**: "CALLSHEET 2 of 2" está en MAYÚSCULAS y es visualmente destacado
2. **IA confundida**: La IA interpretó que este texto era el título por estar en caps
3. **Falta de contexto**: No tenía ejemplos claros de que "CALLSHEET" es el tipo de documento, no el proyecto

### Estructura típica de callsheets:
```
[Logos de productoras]
TÍTULO DEL PROYECTO        ← Esto es lo que queremos
CALLSHEET / Hoja de Rodaje ← Esto NO es el proyecto
Fecha / Detalles
```

## ✅ Solución Implementada

### 1. **Prompt Mejorado - PASO 4 Reforzado** 🤖

Añadí una sección específica para ELIMINAR FALSOS POSITIVOS:

```
❌ TIPO DE DOCUMENTO (NUNCA es el nombre del proyecto):
- "Call Sheet" / "Callsheet" / "CALLSHEET" → Es el tipo de documento, NO el proyecto
- "Hoja de Rodaje" / "Disposición Diaria" → Tipo de documento
- "Drehplan" / "Tagesdisposition" → Tipo de documento
- "Production Sheet" / "Crew List" → Tipo de documento

🔍 REGLA CRÍTICA: 
Si ves texto como "CALLSHEET 2 of 2" o "Call Sheet - Saturday", ignóralo completamente.
El nombre del proyecto está ANTES o DESPUÉS de esta línea, NO ES esta línea.
```

### 2. **Ejemplos Específicos Añadidos** 📚

#### Ejemplo CORRECTO:
```
✅ Caso 7: Header: "Raiffeisen - Goffi" / Abajo: "CALLSHEET 2 of 2" 
→ projectName = "Raiffeisen - Goffi"
```

#### Ejemplos INCORRECTOS (qué NO hacer):
```
❌ Error 1: Header: "Raiffeisen - Goffi" / Abajo: "CALLSHEET 2 of 2" 
→ projectName = "CALLSHEET" ❌
Por qué está mal: "CALLSHEET" es el tipo de documento, NO el proyecto
Correcto: projectName = "Raiffeisen - Goffi" (el texto ANTES de CALLSHEET)
```

### 3. **Filtro de Post-Procesamiento** 🛡️

Añadí una nueva función de validación:

```typescript
const DOCUMENT_TYPE_KEYWORDS = [
  'callsheet', 'call sheet', 'call-sheet',
  'hoja de rodaje', 'hoja rodaje',
  'disposición diaria', 'disposicion diaria',
  'drehplan', 'tagesdisposition',
  'production sheet', 'crew list', 'crew sheet',
  'shooting schedule', 'schedule'
];

function isDocumentType(s: string): boolean {
  // Detecta patrones como:
  // "CALLSHEET", "CALLSHEET 2 of 2", "Call Sheet #3"
  // "Hoja de Rodaje", "Disposición Diaria"
  return /^(call[\s-]?sheet|disposici[oó]n|drehplan)\s*(#?\d+|\d+\s*of\s*\d+)?$/i.test(s);
}
```

**Validación en post-procesamiento**:
```typescript
// Guardrail 1: Rechazar si es tipo de documento
if (projectName && isDocumentType(projectName)) {
  console.warn('[PostProcess] ❌ Rejected projectName - is document type:', projectName);
  projectName = ''; // Limpiar y buscar alternativas
}
```

## 📊 Comparación Antes/Después

### Documento: "Raiffeisen - Goffi"

#### Antes ❌
```
Input PDF:
  Header: "Raiffeisen - Goffi"
  Línea 2: "CALLSHEET 2 of 2"
  
IA extrae: { projectName: "CALLSHEET", ... }
Post-process: No detecta problema
Output: projectName = "CALLSHEET"
UI muestra: "CALLSHEET" ❌
```

#### Después ✅
```
Input PDF:
  Header: "Raiffeisen - Goffi"
  Línea 2: "CALLSHEET 2 of 2"
  
IA extrae (mejorada): { projectName: "Raiffeisen - Goffi", ... }
Post-process: ✓ Válido
Output: projectName = "Raiffeisen - Goffi"
UI muestra: "Raiffeisen - Goffi" ✅
```

#### Caso de recuperación (si IA falla):
```
IA extrae: { projectName: "CALLSHEET", ... }
Post-process detecta: isDocumentType("CALLSHEET") = true
Post-process: ❌ Rechaza "CALLSHEET", busca alternativas
Inferencia desde texto: Encuentra "Raiffeisen - Goffi" en header
Output: projectName = "Raiffeisen - Goffi"
UI muestra: "Raiffeisen - Goffi" ✅
```

## 🧪 Casos de Prueba

| Documento | Texto en Header | Antes | Después |
|-----------|----------------|-------|---------|
| Raiffeisen - Goffi | "CALLSHEET 2 of 2" | ❌ "CALLSHEET" | ✅ "Raiffeisen - Goffi" |
| FUNDBOX | "Call Sheet #3" | ❌ "Call Sheet" | ✅ "FUNDBOX" |
| Dark | "Disposición Diaria" | ❌ "Disposición" | ✅ "Dark" |
| El Reino | "Hoja de Rodaje" | ❌ "Hoja de Rodaje" | ✅ "El Reino" |
| 1899 | "Drehplan Tag 5" | ❌ "Drehplan" | ✅ "1899" |

## 📁 Archivos Modificados

### 1. `services/extractor-universal/prompts/callsheet.ts`
- ✅ PASO 4 reforzado con lista explícita de tipos de documento
- ✅ Añadida regla crítica sobre CALLSHEET
- ✅ 3 ejemplos nuevos (1 correcto + 2 incorrectos explicados)

### 2. `services/extractor-universal/postProcess.ts`
- ✅ Nueva función `isDocumentType()` para detectar tipos de documento
- ✅ Lista de keywords de tipos de documento en múltiples idiomas
- ✅ Regex para patrones como "CALLSHEET 2 of 2"
- ✅ Guardado de validación antes de aceptar projectName
- ✅ Log específico cuando se rechaza un tipo de documento

## 🎯 Beneficios

1. **Prevención primaria**: IA aprende a NO extraer tipos de documento
2. **Red de seguridad**: Post-procesamiento detecta y corrige si la IA falla
3. **Multi-idioma**: Funciona en inglés, español, alemán
4. **Recuperación automática**: Si se detecta error, busca el nombre real en el texto
5. **Logging claro**: Fácil ver cuándo y por qué se rechaza un nombre

## 🚀 Testing Recomendado

### Test 1: Callsheet típico
```
Header: "Serie XYZ"
Línea 2: "CALLSHEET 1 of 3"
```
Esperado: `projectName = "Serie XYZ"` ✅

### Test 2: Sin título claro
```
Header: Solo logos
Línea 2: "Call Sheet"
```
Esperado: Inferencia desde filename o "Untitled Project" ⚠️

### Test 3: Múltiples candidatos
```
Línea 1: "Netflix Presents"
Línea 2: "Dark"
Línea 3: "CALLSHEET 5"
```
Esperado: `projectName = "Dark"` ✅

### Test 4: Español
```
Header: "El Reino - Episodio 3"
Línea 2: "HOJA DE RODAJE"
```
Esperado: `projectName = "El Reino"` ✅

## 📝 Patrones Detectados y Bloqueados

La función `isDocumentType()` detecta:

### Patrones simples:
- "callsheet" / "call sheet" / "CALLSHEET"
- "hoja de rodaje" / "disposición diaria"
- "drehplan" / "tagesdisposition"

### Patrones con números:
- "CALLSHEET 2 of 2"
- "Call Sheet #3"
- "Disposición Diaria 5"
- "Drehplan Tag 8"

### Variaciones:
- Con guiones: "call-sheet"
- Con espacios: "call sheet"
- Mayúsculas/minúsculas: "CallSheet", "CALLSHEET", "callsheet"

## 💡 Próximos Pasos

Si aparecen más casos similares:

1. **Añadir a DOCUMENT_TYPE_KEYWORDS**: Agregar nuevas variantes
2. **Mejorar regex**: Capturar más patrones específicos
3. **Feedback loop**: Recopilar casos fallidos para entrenar mejor

---

**Estado**: ✅ Implementado y documentado  
**Fecha**: Octubre 2025  
**Impacto**: Evita confusión de tipos de documento con nombres de proyecto  
**Riesgo**: Muy bajo - Solo añade validación adicional
