# Sistema de Extracción Crew-First

Este documento explica cómo funciona el sistema de extracción "crew-first" implementado en la aplicación.

## Visión General

El sistema crew-first está diseñado para extraer información logística estructurada de hojas de rodaje (call sheets), enfocándose en las necesidades del equipo de producción.

## Modos de Extracción

La aplicación soporta dos modos de extracción:

### 1. Modo Directo (`direct`)
- Extracción en una sola pasada
- El modelo recibe todo el texto y las instrucciones de una vez
- Devuelve el JSON completo directamente
- Más rápido pero con menor precisión en geocodificación

### 2. Modo Agente (`agent`)
- Extracción multi-paso con herramientas (function calling)
- El modelo puede llamar herramientas de normalización y geocodificación
- Más preciso especialmente para direcciones
- Soporta OCR automático para PDFs e imágenes

## Formatos de Salida

### Formato Simple (Legacy)
```json
{
  "date": "2025-03-15",
  "projectName": "Mi Película",
  "locations": [
    "Calle Mayor 123, Madrid",
    "Parque del Retiro"
  ]
}
```

### Formato Crew-First (Nuevo)
```json
{
  "version": "parser-crew-1",
  "date": "2025-03-15",
  "projectName": "Dark",
  "productionCompany": "Wiedemann & Berg",
  "motiv": "Höhle - Winden Caves",
  "episode": "Folge 3",
  "shootingDay": "DT8",
  "generalCallTime": "07:00",
  "locations": [
    {
      "location_type": "FILMING_PRINCIPAL",
      "name": "Set Principal",
      "address": "Calle Mayor 123, Madrid",
      "formatted_address": "Calle Mayor, 123, 28013 Madrid, España",
      "latitude": 40.4168,
      "longitude": -3.7038,
      "notes": ["Escena 5A", "Interior día"],
      "confidence": 0.95
    },
    {
      "location_type": "UNIT_BASE",
      "address": "Parking Plaza España",
      "formatted_address": "Plaza de España, Madrid",
      "latitude": 40.4238,
      "longitude": -3.7123,
      "notes": ["Trailer 1 y 2"],
      "confidence": 0.9
    }
  ],
  "rutas": []
}
```

## Categorías de Ubicaciones

El sistema crew-first soporta las siguientes categorías de ubicaciones:

| Categoría | Descripción | Ejemplos de Términos |
|-----------|-------------|---------------------|
| `FILMING_PRINCIPAL` | Set principal de rodaje | Set, Drehort, Motiv, Shooting Location |
| `UNIT_BASE` | Campamento base | Basecamp, Basislager, Unit Base, Base |
| `CATERING` | Zona de catering | Catering, Craft, Verpflegung |
| `MAKEUP_HAIR` | Maquillaje y peluquería | Maske, Hair & Make-Up, HMU |
| `WARDROBE` | Vestuario | Gardrobe, Wardrobe, Kostüm, Vestuario |
| `CREW_PARKING` | Aparcamiento del equipo | Crew Parking, Parken, Aparcamiento Equipo |
| `LOAD_UNLOAD` | Puntos de carga/descarga | Technik Entladen, Loading Dock, Descarga de material |

## Uso de la API

### Endpoint: `/api/ai/gemini`

#### Modo Simple (Legacy)
```javascript
fetch('/api/ai/gemini', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'direct',  // o 'agent'
    text: 'texto de la hoja de rodaje...'
  })
})
```

#### Modo Crew-First
```javascript
fetch('/api/ai/gemini', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'direct',      // o 'agent'
    text: 'texto de la hoja de rodaje...',
    useCrewFirst: true   // ← Activa el formato crew-first
  })
})
```

## Uso desde Código

### Ejemplo con Direct Parse
```typescript
import { directParse } from '@/lib/gemini/parser';

const result = await directParse(
  callsheetText,
  'gemini',
  undefined,
  true  // ← useCrewFirst = true
);

// result será de tipo CrewFirstCallsheet
console.log(result.locations[0].location_type); // "FILMING_PRINCIPAL"
```

### Ejemplo con Agentic Parse
```typescript
import { agenticParse } from '@/lib/gemini/parser';

const tools = {
  geocode_address: async ({ address }) => ({
    lat: 40.4168,
    lng: -3.7038,
    confidence: 0.9,
    address
  }),
  address_normalize: async ({ address }) => ({
    normalized: address.trim()
  })
};

const result = await agenticParse(
  callsheetText,
  tools,
  'gemini',
  undefined,
  true  // ← useCrewFirst = true
);
```

## Diferenciación de Campos Clave

### projectName vs productionCompany vs motiv

Uno de los aspectos más importantes del sistema crew-first es diferenciar correctamente estos tres campos:

| Campo | Descripción | Ejemplos | Términos Clave |
|-------|-------------|----------|----------------|
| **projectName** | Título creativo del proyecto | "Dark", "El Reino", "Succession" | Titel:, Title:, Project:, Serie:, Film: |
| **productionCompany** | Empresa/productora | "Netflix", "Warner Bros", "UFA Fiction" | Produktion:, Production Company:, Productora:, Studio: |
| **motiv** | Locación narrativa/escena | "Höhle", "Casa de María - Interior", "FBI Office" | Motiv:, Scene:, Escena:, Location: (narrativo) |

**Ejemplo de call sheet típico:**
```
DARK - Folge 3
Produktion: Wiedemann & Berg Television
Netflix Original Series
Motiv: Höhle - Winden Caves
Drehtag: DT8
```

**Extracción correcta:**
- projectName: "Dark"
- productionCompany: "Wiedemann & Berg Television"
- motiv: "Höhle - Winden Caves"
- episode: "Folge 3"
- shootingDay: "DT8"

## Reglas de Extracción Crew-First

1. **Diferenciación de Metadatos**: El sistema distingue entre título del proyecto, productora, motivo narrativo y episodio. Ver tabla arriba.

2. **Whitelist de Categorías**: Solo se extraen ubicaciones de las 7 categorías listadas arriba. Se ignoran hospitales, protocolos, políticas, etc.

3. **Direcciones Obligatorias**: El campo `address` es obligatorio. Si no hay dirección, no se incluye la ubicación.

4. **Geocodificación Opcional**: Los campos `formatted_address`, `latitude` y `longitude` pueden ser `null` si no se puede geocodificar con certeza.

5. **Notas Limitadas**: Máximo 2 notas logísticas por ubicación (horarios de comida, números de trailer, etc.)

6. **Normalización de Fechas**: Formato YYYY-MM-DD

7. **Normalización de Horas**: Formato HH:MM (24 horas)

8. **Campo Version**: Siempre debe ser `"parser-crew-1"`

9. **Rutas Vacías**: El array `rutas` siempre es `[]` (se genera programáticamente después)

## Herramientas del Modo Agente

En modo agente, el modelo tiene acceso a las siguientes herramientas:

### `address_normalize`
Normaliza una dirección para prepararla para geocodificación.

**Input**: `{ address: string }`
**Output**: `{ normalized: string }`

### `geocode_address`
Convierte una dirección en coordenadas GPS.

**Input**: `{ address: string }`
**Output**: `{ lat: number, lng: number, confidence: number, address: string }`

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend/Client                        │
│  (ExtractorModal, components)                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              lib/gemini/parser.ts                        │
│  • directParse(text, provider, creds, useCrewFirst)    │
│  • agenticParse(text, tools, provider, creds, ...)     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│      services/extractor-universal/providers.ts          │
│  • parseWithGemini(text, useCrewFirst)                 │
│  • parseWithOpenRouter(text, apiKey, model)            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│           lib/api-handlers/ai/gemini.ts                  │
│  • runDirect(text, ai, useCrewFirst)                   │
│  • runAgent(text, ai, useCrewFirst)                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│   services/extractor-universal/prompts/callsheet.ts     │
│  • buildDirectPrompt(text)                             │
│  • buildCrewFirstDirectPrompt(text) ← NUEVO            │
└─────────────────────────────────────────────────────────┘
```

## Validación de Tipos

Los tipos se validan usando type guards en tiempo de ejecución:

- `isCallsheetExtraction(x)` - Valida formato simple
- `isCrewFirstLocation(x)` - Valida una ubicación crew-first
- `isCrewFirstCallsheet(x)` - Valida formato crew-first completo

Ubicados en:
- `services/extractor-universal/verify.ts`
- `lib/guards.ts`

## Schemas

Los schemas TypeScript y JSON Schema se encuentran en:
- `services/extractor-universal/config/schema.ts`

### Tipos Principales
```typescript
type LocationType =
  | 'FILMING_PRINCIPAL'
  | 'UNIT_BASE'
  | 'CATERING'
  | 'MAKEUP_HAIR'
  | 'WARDROBE'
  | 'CREW_PARKING'
  | 'LOAD_UNLOAD';

type CrewFirstLocation = {
  location_type: LocationType;
  name?: string;
  address: string;
  formatted_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string[];
  confidence?: number;
};

type CrewFirstCallsheet = {
  version: 'parser-crew-1';
  date: string;
  projectName: string; // Título del proyecto
  productionCompany?: string | null; // Productora/empresa
  motiv?: string | null; // Locación narrativa
  episode?: string | null; // Número/título episodio
  shootingDay?: string | null; // Día de rodaje
  generalCallTime?: string | null;
  locations: CrewFirstLocation[];
  rutas: any[];
};
```

## Migración desde Formato Simple

Para migrar código existente que usa el formato simple:

**Antes:**
```typescript
const result = await parseWithGemini(text);
// result.locations es string[]
```

**Después (Crew-First):**
```typescript
const result = await parseWithGemini(text, true);
// result.locations es CrewFirstLocation[]
if (result.version === 'parser-crew-1') {
  // Es formato crew-first
  result.locations.forEach(loc => {
    console.log(loc.location_type);
    console.log(loc.address);
  });
}
```

## Compatibilidad Retroactiva

El sistema mantiene compatibilidad con el formato simple:
- Si `useCrewFirst` no se especifica o es `false`, se usa el formato simple
- Los type guards soportan ambos formatos
- El código existente sigue funcionando sin cambios

## Ejemplo Completo

```typescript
import { extractUniversalStructured } from '@/services/extractor-universal';

// Usando formato crew-first en modo directo
const result = await extractUniversalStructured({
  mode: 'direct',
  input: { text: callsheetText },
  provider: 'gemini',
  // Para habilitar crew-first, necesitas modificar el index.ts
  // para aceptar useCrewFirst como parámetro
});

// Verificar que es crew-first
if ('version' in result && result.version === 'parser-crew-1') {
  console.log('Formato crew-first detectado');
  result.locations.forEach(loc => {
    console.log(`${loc.location_type}: ${loc.address}`);
    if (loc.latitude && loc.longitude) {
      console.log(`GPS: ${loc.latitude}, ${loc.longitude}`);
    }
  });
}
```

## Notas de Implementación

1. Los prompts crew-first están en español para mejor comprensión del modelo con términos de la industria cinematográfica hispana y alemana.

2. La geocodificación en el modo actual usa coordenadas de ejemplo (Madrid). Para producción, deberías integrar un servicio real de geocodificación (Google Maps API, Mapbox, etc.).

3. El sistema soporta múltiples idiomas en los términos de categorías (español, alemán, inglés).

4. Las herramientas en modo agente se ejecutan server-side para mayor seguridad.
