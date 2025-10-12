# Sistema de Agente con Function Calling

Este documento explica el sistema de agente implementado con **OpenRouter como prioridad** (soporta también Gemini como secundario).

## 🎯 Arquitectura del Agente

El agente funciona como un "cerebro" que puede usar "herramientas" (tools/functions) para completar tareas complejas paso a paso.

```
┌─────────────────────────────────────────────────────┐
│  1. Usuario envía call sheet                        │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  2. Orquestador inicia conversación                 │
│     (lib/agent/orchestrator.ts)                     │
│     - Envía instrucciones del sistema               │
│     - Envía texto a analizar                        │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  3. Modelo de IA (OpenRouter/Gemini)                │
│     Analiza y decide:                               │
│     - ¿Necesito normalizar direcciones?             │
│     - ¿Necesito geocodificar?                       │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  4. Modelo solicita herramientas:                   │
│     - address_normalize("Calle Mayor 123")          │
│     - geocode_address("Calle Mayor 123, Madrid")    │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  5. Ejecutor ejecuta herramientas REALES            │
│     (lib/agent/executor.ts)                         │
│     - Normaliza direcciones                         │
│     - Llama a Google Maps API                       │
│     - Devuelve coordenadas GPS                      │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  6. Orquestador envía resultados al modelo          │
│     Bucle continúa hasta MAX_TURNS (10)             │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  7. Modelo ensambla JSON final                      │
│     CrewFirstCallsheet con datos geocodificados     │
└─────────────────────────────────────────────────────┘
```

## 📁 Componentes del Sistema

### 1. **Definiciones de Herramientas** ([lib/agent/tools.ts](lib/agent/tools.ts))
Define las herramientas disponibles para el agente en formato estándar de OpenAI/OpenRouter.

```typescript
const tools = [
  {
    type: 'function',
    function: {
      name: 'address_normalize',
      description: 'Normaliza una dirección...',
      parameters: { ... }
    }
  },
  {
    type: 'function',
    function: {
      name: 'geocode_address',
      description: 'Geocodifica usando Google Maps...',
      parameters: { ... }
    }
  }
];
```

### 2. **Ejecutor de Herramientas** ([lib/agent/executor.ts](lib/agent/executor.ts))
Implementa las herramientas con **llamadas REALES a APIs**.

**Herramientas Implementadas:**
- `address_normalize`: Limpia y normaliza direcciones
- `geocode_address`: Llama a **Google Maps Geocoding API**

```typescript
export async function executeGeocodeAddress(args) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.append('address', args.address);
  url.searchParams.append('key', apiKey);

  const response = await fetch(url.toString());
  const data = await response.json();

  return {
    latitude: data.results[0].geometry.location.lat,
    longitude: data.results[0].geometry.location.lng,
    formatted_address: data.results[0].formatted_address
  };
}
```

### 3. **Orquestador** ([lib/agent/orchestrator.ts](lib/agent/orchestrator.ts))
El "cerebro" que maneja la conversación multi-turno.

**Flujo del Orquestador:**
1. Inicializa conversación con instrucciones de sistema
2. Envía texto del call sheet
3. Bucle de hasta 10 turnos:
   - Llama a OpenRouter con herramientas disponibles
   - Si modelo solicita tool → ejecuta tool → añade resultado al historial
   - Si modelo devuelve JSON → valida y retorna
4. Valida que el JSON sea `CrewFirstCallsheet`

### 4. **Handler de API** ([lib/api-handlers/ai/openrouter/structured.ts](lib/api-handlers/ai/openrouter/structured.ts))
Endpoint que expone el sistema de agente.

## 🚀 Uso del Sistema

### Activar Modo Agente con OpenRouter

```javascript
fetch('/api/ai/openrouter/structured', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'agent',           // ← Activa modo agente (function calling)
    useCrewFirst: true,      // ← Usa schema crew-first
    text: callsheetText,
    apiKey: 'sk-or-...',     // Tu API key de OpenRouter
    model: 'google/gemini-2.0-flash-exp:free'  // Modelo compatible con tools
  })
})
```

### Modo Directo (Sin Herramientas)

```javascript
fetch('/api/ai/openrouter/structured', {
  method: 'POST',
  body: JSON.stringify({
    mode: 'direct',          // ← Modo directo (sin function calling)
    useCrewFirst: true,
    text: callsheetText,
    apiKey: 'sk-or-...'
  })
})
```

## 🔧 Configuración Requerida

### Variables de Entorno

```bash
# OpenRouter (PRIORITARIO)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=google/gemini-2.0-flash-exp:free
OPENROUTER_HTTP_REFERER=https://tu-app.com
OPENROUTER_TITLE=Tu App

# Google Maps (para geocodificación en modo agente)
GOOGLE_MAPS_API_KEY=AIzaSy...

# Gemini (opcional, secundario)
GEMINI_API_KEY=AIzaSy...
```

## 🛠️ Herramientas Disponibles

### 1. address_normalize
**Propósito**: Limpia y normaliza direcciones para geocodificación.

**Input**:
```json
{
  "raw": "  Calle    Mayor   123,   Madrid  "
}
```

**Output**:
```json
{
  "normalized": "Calle Mayor 123, Madrid"
}
```

### 2. geocode_address
**Propósito**: Convierte dirección en coordenadas GPS usando Google Maps.

**Input**:
```json
{
  "address": "Calle Mayor 123, Madrid"
}
```

**Output**:
```json
{
  "latitude": 40.4168,
  "longitude": -3.7038,
  "formatted_address": "Calle Mayor, 123, 28013 Madrid, España",
  "confidence": 0.95
}
```

**Niveles de Confidence**:
- `1.0` - ROOFTOP (dirección exacta)
- `0.8` - RANGE_INTERPOLATED (interpolación)
- `0.6` - GEOMETRIC_CENTER (centro geométrico)
- `0.4` - APPROXIMATE (aproximado)
- `0.0` - Error o no encontrado

## 📊 Ejemplo de Conversación del Agente

```
TURNO 1:
Usuario → Agente: "Analiza esta call sheet: DARK - Folge 3..."

TURNO 2:
Agente → Sistema: "Necesito normalizar 'Hauptstraße 42, Berlin'"
Sistema → Agente: { normalized: "Hauptstraße 42, Berlin" }

TURNO 3:
Agente → Sistema: "Necesito geocodificar 'Hauptstraße 42, Berlin'"
Sistema → Agente: { lat: 52.52, lng: 13.405, formatted: "..." }

TURNO 4:
Agente → Usuario: {
  "version": "parser-crew-1",
  "projectName": "Dark",
  "locations": [{
    "location_type": "FILMING_PRINCIPAL",
    "address": "Hauptstraße 42, Berlin",
    "latitude": 52.52,
    "longitude": 13.405,
    ...
  }]
}
```

## 🔄 Diferencias: Modo Directo vs Modo Agente

| Aspecto | Modo Directo | Modo Agente |
|---------|--------------|-------------|
| **Function Calling** | ❌ No | ✅ Sí |
| **Geocodificación** | ❌ Simulada (null) | ✅ Real (Google Maps) |
| **Precisión** | Menor | Mayor |
| **Velocidad** | Más rápido (1 turno) | Más lento (múltiples turnos) |
| **Costo API** | Menor | Mayor (más tokens) |
| **Uso Recomendado** | Testing rápido | Producción |

## 🎯 Cuándo Usar Cada Modo

### Usa Modo Directo cuando:
- ✅ Necesitas resultados rápidos
- ✅ Estás testeando
- ✅ No necesitas geocodificación precisa
- ✅ Quieres minimizar costos

### Usa Modo Agente cuando:
- ✅ Necesitas geocodificación real
- ✅ La precisión es crítica
- ✅ Vas a usar los datos para navegación
- ✅ Estás en producción

## 🧪 Testing

### Test Modo Directo
```bash
curl -X POST http://localhost:3000/api/ai/openrouter/structured \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "direct",
    "useCrewFirst": true,
    "text": "DARK - Folge 3...",
    "apiKey": "sk-or-..."
  }'
```

### Test Modo Agente
```bash
curl -X POST http://localhost:3000/api/ai/openrouter/structured \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "agent",
    "useCrewFirst": true,
    "text": "DARK - Folge 3...",
    "apiKey": "sk-or-..."
  }'
```

## 🔍 Debugging

El orquestador registra logs detallados:

```
[Agent] Turn 1/10
[Agent] Model requested 2 tool call(s)
[Agent] Executing tool: address_normalize { raw: 'Calle Mayor 123' }
[Agent] Tool result: { normalized: 'Calle Mayor 123' }
[Agent] Executing tool: geocode_address { address: 'Calle Mayor 123, Madrid' }
[Agent] Tool result: { latitude: 40.4168, longitude: -3.7038, ... }
[Agent] Valid CrewFirstCallsheet received
```

## ⚠️ Limitaciones y Consideraciones

1. **Límite de Turnos**: Máximo 10 turnos por conversación
2. **API Key de Google Maps**: Requerida para geocodificación real
3. **Costos**: Modo agente consume más tokens (múltiples llamadas)
4. **Modelos Compatibles**: Solo modelos que soporten function calling
   - ✅ `google/gemini-2.0-flash-exp:free`
   - ✅ `openai/gpt-4o`
   - ✅ `anthropic/claude-3.5-sonnet`
   - ❌ Modelos sin function calling

## 🚢 Deployment

### Para Vercel/Edge Functions

Las herramientas funcionan en edge runtime. Google Maps API se llama desde el servidor.

### Variables de Entorno en Producción

```bash
# .env.production
OPENROUTER_API_KEY=sk-or-v1-...
GOOGLE_MAPS_API_KEY=AIzaSy...
```

## 📚 Próximos Pasos

Para extender el sistema:

1. **Añadir más herramientas**: Edita `lib/agent/tools.ts` y `lib/agent/executor.ts`
2. **Soportar OCR**: Implementa `pdf_text_check` y `ocr_extract`
3. **Caché de geocodificación**: Guarda resultados en base de datos
4. **Rate limiting**: Limita llamadas a Google Maps API

## 🎓 Resumen

El sistema de agente con OpenRouter permite:
- ✅ Geocodificación **real** con Google Maps
- ✅ Conversaciones multi-turno
- ✅ Function calling extensible
- ✅ Logs detallados para debugging
- ✅ Validación estricta del schema
- ✅ **OpenRouter como prioridad** (más modelos, mejor precio)
