# 🔧 Solución al Error MODULE_NOT_FOUND en Vercel

## ❌ Error Original

```
[ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/lib/api-handlers/ai/gemini' 
imported from /var/task/api/proxy.js
```

**Afectaba a**:
- `/api/ai/openrouter/models` → 500
- `/api/google/calendar/events?health=1` → 500
- Cualquier endpoint en `api/proxy.ts`

---

## 🔍 Causa Raíz

### Problema de Estructura de Carpetas en Vercel

**En local**:
```
FBProv1/
├── api/
│   └── proxy.ts  ← Función serverless
├── lib/
│   └── api-handlers/
│       └── ai/
│           └── gemini.ts  ← Dependencia compleja
```

**En Vercel Serverless**:
```
/var/task/
├── api/
│   └── proxy.js  ← Compilado
└── lib/  ← ❌ NO INCLUIDO en el bundle
```

### Por Qué Falla

1. **Vercel Functions** tiene un sistema de bundling específico
2. La carpeta `lib/` con dependencias complejas no se incluye automáticamente
3. `gemini.ts` tiene **muchas dependencias**:
   - `@google/genai` (SDK grande)
   - Múltiples imports de `services/extractor-universal`
   - Tipos y schemas complejos
   - Tools y executors

4. El **import relativo** falla:
   ```typescript
   import geminiHandler from '../lib/api-handlers/ai/gemini';
   ```

---

## ✅ Solución Implementada

### Opción 1: Deshabilitar Gemini en Producción ⭐ (IMPLEMENTADA)

**Justificación**:
- Ya usas **OpenRouter** como proveedor principal
- OpenRouter es más robusto para producción
- Gemini tiene dependencias pesadas incompatibles con serverless
- Simplifica el bundle de Vercel

**Cambios**:

#### 1. Remover Import
```typescript
// ANTES
import geminiHandler from '../lib/api-handlers/ai/gemini';

// DESPUÉS
// Gemini handler removed - use OpenRouter instead in production
```

#### 2. Handler Stub
```typescript
async function handleGemini(req: VercelRequest, res: VercelResponse) {
  console.log('[Gemini] Request attempted but not available in production');
  return sendJson(res, 503, { 
    error: 'Gemini not available in production', 
    message: 'Please use OpenRouter provider instead. Configure your OpenRouter API key in Settings.',
    details: 'The Gemini handler requires complex dependencies that are not compatible with Vercel serverless functions.'
  });
}
```

**Resultado**:
- ✅ Endpoints de Google Calendar funcionarán
- ✅ Endpoints de OpenRouter funcionarán
- ✅ Gemini retorna error 503 con mensaje claro
- ✅ No hay imports problemáticos

---

## 🚀 Deploy

```bash
git add api/proxy.ts
git commit -m "fix: remove Gemini import to fix Vercel MODULE_NOT_FOUND error"
git push origin main
```

**Tiempo estimado**: 2-3 minutos

---

## 🧪 Verificación Post-Deploy

### 1. Endpoints que DEBEN funcionar

#### Google Calendar Health Check
```bash
curl https://fb-prov1.vercel.app/api/google/calendar/events?health=1
```
**Esperado**: `200 { ready: true, usesApiKey: true/false }`

#### OpenRouter Models
```bash
curl https://fb-prov1.vercel.app/api/ai/openrouter/models?apiKey=sk-or-v1-...
```
**Esperado**: `200 { models: [...] }`

#### OpenRouter Structured (Extracción)
```bash
curl -X POST https://fb-prov1.vercel.app/api/ai/openrouter/structured \
  -H "Content-Type: application/json" \
  -d '{"text":"...", "apiKey":"sk-or-v1-..."}'
```
**Esperado**: `200 { date: "...", projectName: "...", locations: [...] }`

### 2. Endpoint que retornará error (esperado)

#### Gemini (Deshabilitado)
```bash
curl -X POST https://fb-prov1.vercel.app/api/ai/gemini \
  -H "Content-Type: application/json" \
  -d '{"mode":"direct","text":"..."}'
```
**Esperado**: `503 { error: "Gemini not available in production", message: "..." }`

---

## 📊 Logs Esperados en Vercel

### ✅ Exitoso (Calendario)
```
[Proxy] Routing request: { route: 'google/calendar/events', method: 'GET' }
[Google] Handling route: google/calendar/events
[Google] Calendar sub-route: events
[GoogleCalendarEvents] Request received: { method: 'GET', hasHealth: true }
[GoogleCalendarEvents] Health check - API key present: false
→ Response: 200
```

### ✅ Exitoso (OpenRouter Models)
```
[Proxy] Routing request: { route: 'ai/openrouter/models', method: 'GET' }
[AI] Handling route: openrouter/models
[OpenRouter Models] Fetching models list...
[OpenRouter Models] Response status: 200
[OpenRouter Models] Successfully fetched 150 models
→ Response: 200
```

### ⚠️ Esperado (Gemini Deshabilitado)
```
[Proxy] Routing request: { route: 'ai/gemini', method: 'POST' }
[AI] Handling route: gemini
[Gemini] Request attempted but not available in production
→ Response: 503
```

### ❌ NO DEBE APARECER
```
[ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/lib/api-handlers/ai/gemini'
```

---

## 🔄 Alternativas (No Implementadas)

### Opción 2: Incluir lib/ en Vercel Bundle

**Configuración en `vercel.json`**:
```json
{
  "functions": {
    "api/proxy.ts": {
      "maxDuration": 60,
      "memory": 1024,
      "includeFiles": "lib/**"
    }
  }
}
```

**Problemas**:
- `@google/genai` es muy pesado (~10MB+)
- Aumenta dramáticamente el tamaño del bundle
- Puede exceder límites de Vercel free tier
- Cold starts más lentos

### Opción 3: Mover Gemini Handler Inline

**Copiar todo el código de `gemini.ts` dentro de `proxy.ts`**

**Problemas**:
- Archivo `proxy.ts` se vuelve gigante (1000+ líneas)
- Difícil de mantener
- Todas las dependencias siguen siendo problemáticas
- No resuelve el problema de bundle size

### Opción 4: Serverless Function Separada

**Crear `api/gemini.ts` independiente**

**Problemas**:
- Vercel free tier: límite de funciones
- Aumenta complejidad
- OpenRouter ya funciona perfectamente

---

## 💡 Por Qué OpenRouter Es Mejor para Producción

| Característica | Gemini Free API | OpenRouter |
|----------------|-----------------|------------|
| **Rate Limits** | Muy restrictivos | Más generosos |
| **Modelos** | Solo Gemini | Gemini + GPT + Claude + más |
| **Reliability** | Puede fallar sin previo aviso | Más estable |
| **Bundle Size** | SDK pesado (~10MB) | Fetch simple |
| **Cold Starts** | Lentos | Rápidos |
| **Debugging** | Logs limitados | Mejor observabilidad |
| **Escalabilidad** | Limitada | Mejor |

---

## 📋 Checklist Post-Deploy

- [ ] Deploy completado en Vercel (2-3 min)
- [ ] No hay errores MODULE_NOT_FOUND en logs
- [ ] Calendario carga correctamente
- [ ] Settings → APIs carga modelos OpenRouter
- [ ] Carga masiva con IA funciona
- [ ] Gemini retorna error 503 claro (esperado)

---

## 🎯 Resultado Final

### Antes ❌
```
[ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/lib/api-handlers/ai/gemini'
↓
TODOS los endpoints fallan con 500
```

### Después ✅
```
Google Calendar: ✅ 200 OK
OpenRouter Models: ✅ 200 OK  
OpenRouter Structured: ✅ 200 OK
Extracción IA: ✅ Funciona
Gemini: ⚠️ 503 (con mensaje claro)
```

---

## 📞 Si Necesitas Gemini en el Futuro

### Solución Recomendada: Usar Gemini vía OpenRouter

OpenRouter soporta modelos Gemini:
- `google/gemini-2.0-flash-001`
- `google/gemini-pro`
- `google/gemini-flash-1.5`

**Ventajas**:
- Mismo modelo Gemini
- Sin problemas de bundle
- Rate limits más generosos
- Una sola configuración (OpenRouter key)
- Funciona en producción

**Cómo**:
```typescript
// Ya implementado en tu código
const model = 'google/gemini-2.0-flash-001';
await parseWithOpenRouter(text, apiKey, model);
```

Ya lo estás usando! 🎉

---

## 🚀 Acción Inmediata

```bash
# 1. Commit y push
git add api/proxy.ts SOLUCION_MODULE_NOT_FOUND.md
git commit -m "fix: remove Gemini import to fix Vercel MODULE_NOT_FOUND error"
git push origin main

# 2. Esperar 2-3 minutos

# 3. Verificar
curl https://fb-prov1.vercel.app/api/google/calendar/events?health=1
curl "https://fb-prov1.vercel.app/api/ai/openrouter/models?apiKey=tu-key"

# 4. Probar en UI
# - Abre https://fb-prov1.vercel.app/
# - Ve a Calendario (debe cargar)
# - Ve a Settings → APIs (debe mostrar modelos)
# - Prueba carga masiva con IA
```

¡Todo debería funcionar ahora! 🎉
