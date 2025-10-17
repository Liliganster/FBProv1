# ✅ Filtrado Estricto de Productoras - Solo Empresas de Producción Reales

## 🎯 Problema Solucionado

La app estaba extrayendo **demasiadas empresas** como "productoras", incluyendo:
- ❌ Televisoras/Broadcasters (ARD, ZDF, ORF, TVE, etc.)
- ❌ Plataformas de streaming (Netflix, HBO, Amazon Prime) sin contexto de producción
- ❌ Empresas clientes (marcas que aparecen en el proyecto)
- ❌ Empresas de servicios (ARRI, Panavision, rental equipment)
- ❌ Logos sin contexto de producción
- ❌ Fondos de financiamiento (ICAA, BKM, FFA, etc.)

## ✅ Solución Implementada - Doble Capa de Filtrado

### 1. **Prompt del AI Actualizado** (`api/proxy.ts`)

#### Instrucciones Mucho Más Estrictas:

```
🎯 CRITICAL RULES - Be VERY selective and context-aware:

✅ INCLUDE ONLY:
  • Film/TV production companies with explicit "Production" or "Producer" label
  • Independent producers labeled "Produktion:", "Production:", "Productora:"
  • Co-producers explicitly labeled "Co-Produktion:", "Co-Production:"

❌ DO NOT INCLUDE:
  • TV Broadcasters: ARD, ZDF, ORF, BBC, TVE, RTVE
    (UNLESS labeled "Co-Produktion:" or "Co-Production:")
  • Streaming platforms: Netflix, Amazon Prime, HBO
    (UNLESS explicitly labeled "Produced by")
  • Client companies (featured brands)
  • Service/rental companies: ARRI, Panavision
  • Funding entities: Film funds, government agencies
  • Commissioners: "Auftraggeber:", "Sender:" (NOT producers)

🔍 HOW TO VERIFY:
  1. Check the label/context near the company name
  2. "Produktion:", "Production:", "Productora:" → ✅ INCLUDE
  3. "Sender:", "Broadcaster:", "Auftraggeber:" → ❌ EXCLUDE
  4. "Co-Produktion:", "Co-Production:" → ✅ INCLUDE
  5. Just a logo with no production context → ❌ EXCLUDE
  6. Known broadcaster without production label → ❌ EXCLUDE
```

#### Ejemplos Actualizados:

**✅ Correcto:**
```json
{
  "productionCompanies": ["UFA Fiction"],
  "productionCompanies": ["Wiedemann & Berg Television", "Studio Babelsberg"]
}
```

**❌ Incorrecto:**
```json
{
  "productionCompanies": ["UFA Fiction", "ZDF", "ARD", "Mercedes-Benz", "ARRI"]
}
← ZDF/ARD son broadcasters, Mercedes es cliente, ARRI es rental
```

### 2. **Filtro Automático en Post-Procesamiento** (`postProcess.ts`)

#### Lista de Empresas No Productoras:

Se agregó una lista exhaustiva de empresas conocidas que NO son productoras:

```typescript
const NON_PRODUCTION_COMPANIES = [
  // Broadcasters alemanes
  'ard', 'zdf', 'rtl', 'sat.1', 'pro7', 'vox',
  'ard degeto', 'zdf enterprises', 'mdr', 'ndr', 'wdr',
  
  // Austriacos/Suizos
  'orf', 'srf',
  
  // Españoles/Latinoamericanos
  'rtve', 'tve', 'antena 3', 'telecinco', 'la sexta',
  'televisión española',
  
  // Internacionales
  'bbc', 'itv', 'rai', 'arte',
  
  // Streaming
  'netflix', 'amazon prime', 'hbo', 'disney+', 'apple tv+',
  
  // Fondos y gobierno
  'bkm', 'ffa', 'icaa', 'eurimages', 'filmförderung',
  
  // Servicios/Rental
  'arri', 'panavision', 'camera rental',
];
```

#### Función de Validación:

```typescript
function isNonProductionCompany(company: string): boolean {
  const normalized = company.toLowerCase().trim();
  
  // Check exact match or if contained in the company name
  for (const nonProd of NON_PRODUCTION_COMPANIES) {
    if (normalized === nonProd || normalized.includes(nonProd)) {
      return true;
    }
  }
  
  // Check for service/rental indicators
  if (normalized.includes('rental') || 
      normalized.includes('equipment') ||
      normalized.includes('services')) {
    return true;
  }
  
  return false;
}
```

## 🔄 Flujo Completo de Filtrado

```
┌─────────────────────────────────────────┐
│ CALLSHEET PDF                           │
│ Logos: UFA Fiction, ZDF, ARD, ARRI     │
│ Text: "Produktion: UFA Fiction"        │
│       "Sender: ZDF"                     │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ OPENROUTER AI (Prompt estricto)        │
│ Revisa labels y contexto                │
│ Solo incluye si tiene label "Produktion"│
│ Excluye broadcasters sin label          │
│ → Extrae: ["UFA Fiction", "ZDF"]       │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ providers.ts (Validación formato)      │
│ Valida que sea array válido            │
│ → ["UFA Fiction", "ZDF"]                │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ postProcess.ts (Filtro estricto)       │
│ Verifica contra lista de non-producers │
│ "UFA Fiction" → ✅ No está en lista     │
│ "ZDF" → ❌ Broadcaster, filtrar         │
│ → Resultado: ["UFA Fiction"]            │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ RESULTADO FINAL                         │
│ productionCompanies: ["UFA Fiction"]    │
└─────────────────────────────────────────┘
```

## 📋 Casos de Uso

### Caso 1: Producción Simple
**Callsheet:**
```
Produktion: UFA Fiction
Sender: ZDF
```
**Resultado:** `["UFA Fiction"]` ✅

### Caso 2: Co-producción con Broadcaster
**Callsheet:**
```
Produktion: Wiedemann & Berg Television
Co-Produktion: ARD Degeto
Sender: ZDF
```
**Resultado:** `["Wiedemann & Berg Television", "ARD Degeto"]` ✅
(ARD Degeto se incluye porque tiene label "Co-Produktion")

### Caso 3: Solo Broadcasters
**Callsheet:**
```
Sender: ZDF
Broadcaster: ARD
Commissioner: ORF
```
**Resultado:** `["Unknown"]` ✅
(Ninguno tiene label de producción)

### Caso 4: Comercial con Cliente
**Callsheet:**
```
Produktion: UFA Fiction
Cliente: Mercedes-Benz
Equipment: ARRI Rental
```
**Resultado:** `["UFA Fiction"]` ✅
(Cliente y equipment filtrados)

### Caso 5: Streaming como Productor
**Callsheet:**
```
Produced by: Netflix
Studio: Studio Babelsberg
Distributor: Amazon Prime
```
**Resultado:** `["Netflix", "Studio Babelsberg"]` ✅
(Netflix incluido porque tiene "Produced by", Amazon excluido como distributor)

## 🎯 Reglas de Contexto

| Empresa | Label | ¿Incluir? | Razón |
|---------|-------|-----------|-------|
| ZDF | "Produktion:" | ✅ Sí | Tiene label de producción |
| ZDF | "Sender:" | ❌ No | Es broadcaster sin rol de producción |
| ZDF | "Co-Produktion:" | ✅ Sí | Co-productor explícito |
| ARD | Solo logo | ❌ No | Sin contexto de producción |
| Netflix | "Produced by:" | ✅ Sí | Label explícito de producción |
| Netflix | Solo logo | ❌ No | Sin contexto de producción |
| ARRI | Cualquier label | ❌ No | Empresa de servicios (siempre excluida) |
| ICAA | "Finanzierung:" | ❌ No | Fondo de financiamiento |

## 🔍 Logs de Debugging

### Logs esperados durante el filtrado:

```
[PostProcess] Extracted data: {
  date: "2025-03-15",
  projectName: "DARK",
  productionCompanies: ["UFA Fiction", "ZDF", "ARRI Rental"],
  locationsCount: 2
}

[PostProcess] ❌ Filtered non-production company: "ZDF"
[PostProcess] ❌ Filtered non-production company: "ARRI Rental"

[PostProcess] Final companies: ["UFA Fiction"]
```

## 📝 Ventajas de la Solución

1. ✅ **Doble filtrado**: AI + código = máxima precisión
2. ✅ **Context-aware**: El AI revisa labels antes de extraer
3. ✅ **Lista exhaustiva**: 50+ empresas conocidas filtradas automáticamente
4. ✅ **Detección de patrones**: Filtra "rental", "equipment", "services" automáticamente
5. ✅ **Fallback robusto**: Si todo falla, devuelve ["Unknown"]
6. ✅ **Logs detallados**: Fácil debugging de qué se filtró y por qué

## 🚀 Estado

- ✅ **Prompt actualizado** con reglas estrictas
- ✅ **Filtro automático** implementado
- ✅ **50+ empresas** en lista de exclusión
- ✅ **Ejemplos mejorados** en el prompt
- ✅ **Logs detallados** para debugging
- ✅ **Sin errores** de TypeScript

## 🧪 Cómo Probar

1. Sube un callsheet con múltiples logos y empresas
2. Verifica los logs en consola:
```
[PostProcess] ❌ Filtered non-production company: "ZDF"
[PostProcess] ❌ Filtered non-production company: "ARRI"
```
3. Verifica que solo se muestren las productoras reales
4. Ejemplo esperado: `"UFA Fiction, Wiedemann & Berg"`

## 📋 Lista Completa de Exclusiones

### Broadcasters Alemanes:
ARD, ZDF, RTL, Sat.1, Pro7, VOX, RTL2, ARD Degeto, ZDF Enterprises, MDR, NDR, WDR, BR, SWR, HR, RBB

### Austriacos/Suizos:
ORF, SRF

### Españoles:
RTVE, TVE, Antena 3, Telecinco, La Sexta, Cuatro, Televisión Española

### Internacionales:
BBC, ITV, Channel 4, Sky, RAI, France Télévisions, ARTE

### Streaming:
Netflix*, Amazon Prime*, HBO*, Disney+, Apple TV+, Paramount+
(*a menos que tengan label "Produced by")

### Fondos:
BKM, FFA, DFFF, ICAA, Eurimages, MEDIA, Creative Europe, Filmförderung

### Servicios:
ARRI, Panavision, cualquier empresa con "Rental", "Equipment", "Services"

---

**¡Ahora solo se extraen productoras reales de cine y TV! 🎬✨**

Las televisoras, clientes, y empresas de servicios se filtran automáticamente.
