# 🔧 Problemas en Producción - Diagnóstico y Soluciones

## 📊 Revisión Realizada
**URL**: https://fb-prov1.vercel.app/
**Fecha**: 16 de Octubre, 2025
**Herramienta**: MCP Chrome DevTools

---

## ❌ Problemas Encontrados

### 1. **Google Calendar - Error 500**
**Endpoint**: `/api/google/calendar/events?health=1`
**Status**: 500 Internal Server Error
**Impacto**: Calendario no carga, muestra mensaje de error

**Error en UI**:
```
Google Calendar no disponible
Backend: proxy `/api/google/calendar` no responde.
```

**Causa Probable**:
- El handler existe y tiene el health check correcto
- Pero hay un error ANTES de llegar al handler
- Posiblemente en el routing o en una función helper
- O el `try-catch` global está capturando un error inesperado

**Solución Implementada**:
```typescript
// Agregado logging detallado en múltiples niveles:

// 1. Main router
console.log('[Proxy] Routing request:', { route, method });

// 2. Google handler
console.log('[Google] Handling route:', route);
console.log('[Google] Calendar sub-route:', subRoute);

// 3. GoogleCalendarEvents handler
console.log('[GoogleCalendarEvents] Request received:', { 
  method, hasHealth, query 
});
console.log('[GoogleCalendarEvents] Health check - API key present:', !!apiKey);
```

### 2. **OpenRouter Models - Error 500**
**Endpoint**: `/api/ai/openrouter/models?apiKey=sk-or-v1-...`
**Status**: 500 Internal Server Error
**Impacto**: Settings no puede cargar la lista de modelos disponibles

**Error en consola**:
```javascript
Error fetching OpenRouter models: Error fetching OpenRouter models: {}
Failed to connect to OpenRouter. Please check your network connection and API key.
```

**Causa Probable**:
- Similar al problema del calendario
- El handler `handleOpenRouterModels` existe
- Pero algo falla antes o durante la ejecución
- Posiblemente:
  - Error en `getUserId()` para rate limiting
  - Error en fetch a OpenRouter API
  - Problema con la API key en el servidor

**Solución Implementada**:
```typescript
// Agregado logging en AI handler
console.log('[AI] Handling route:', route);

// Ya existía logging en handleOpenRouterModels:
console.log('[OpenRouter Models] Fetching models list...');
console.log('[OpenRouter Models] Response status:', response.status);
```

### 3. **Falta de Logging Detallado**
**Problema**: Cuando hay errores 500, no sabemos exactamente dónde fallan
**Impacto**: Debugging difícil en producción

**Solución**: Agregado logging en todos los niveles de routing

---

## ✅ Cambios Implementados

### Archivo: `api/proxy.ts`

#### 1. Main Router - Logging Mejorado
```typescript
try {
  console.log('[Proxy] Routing request:', { route, method: req.method });
  
  if (route.startsWith('ai/')) {
    return await handleAI(route.replace('ai/', ''), req, res);
  } else if (route.startsWith('google/')) {
    return await handleGoogle(route.replace('google/', ''), req, res);
  } else if (route.startsWith('admin/')) {
    return await handleAdmin(route.replace('admin/', ''), req, res);
  }

  console.error('[Proxy] Route not found:', route);
  return sendError(res, 404, 'Route not found');
} catch (error: any) {
  console.error('[Proxy] Fatal error:', {
    message: error.message,
    stack: error.stack,
    route,
    method: req.method
  });
  return sendError(res, 500, error.message || 'Internal server error');
}
```

#### 2. Google Handler - Logging Agregado
```typescript
async function handleGoogle(route: string, req: VercelRequest, res: VercelResponse) {
  console.log('[Google] Handling route:', route);
  
  if (route.startsWith('calendar/')) {
    const subRoute = route.replace('calendar/', '');
    console.log('[Google] Calendar sub-route:', subRoute);
    
    if (subRoute === 'calendars') {
      return await handleGoogleCalendarList(req, res);
    } else if (subRoute === 'events') {
      return await handleGoogleCalendarEvents(req, res);
    }
  }
  // ...
}
```

#### 3. Google Calendar Events - Logging Detallado
```typescript
async function handleGoogleCalendarEvents(req: VercelRequest, res: VercelResponse) {
  console.log('[GoogleCalendarEvents] Request received:', { 
    method: req.method, 
    hasHealth: !!req.query?.health,
    query: req.query
  });
  
  // Health check
  if (req.method === 'GET' && req.query?.health) {
    const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;
    console.log('[GoogleCalendarEvents] Health check - API key present:', !!apiKey);
    return sendJson(res, 200, { ready: true, usesApiKey: Boolean(apiKey) });
  }
  // ...
}
```

#### 4. AI Handler - Logging Agregado
```typescript
async function handleAI(route: string, req: VercelRequest, res: VercelResponse) {
  console.log('[AI] Handling route:', route);
  
  // Rate limiting...
  
  if (route === 'gemini') {
    return await handleGemini(req, res);
  } else if (route === 'openrouter/chat') {
    return await handleOpenRouterChat(req, res);
  } else if (route === 'openrouter/models') {
    return await handleOpenRouterModels(req, res);
  }
  // ...
  
  console.error('[AI] Route not found:', route);
  return sendError(res, 404, 'AI route not found');
}
```

#### 5. Async/Await Agregado
**Antes**:
```typescript
return handleAI(route.replace('ai/', ''), req, res);
```

**Después**:
```typescript
return await handleAI(route.replace('ai/', ''), req, res);
```

---

## 🔍 Cómo Diagnosticar Después del Deploy

### 1. Acceder a Logs de Vercel
1. Ve a https://vercel.com/dashboard
2. Selecciona proyecto `FBProv1`
3. Click en "Deployments"
4. Click en el deployment más reciente
5. Click en "Functions" → `api/proxy.ts`
6. Click en "Logs"

### 2. Buscar Errores del Calendario
```
[Proxy] Routing request: { route: 'google/calendar/events', method: 'GET' }
[Google] Handling route: google/calendar/events
[Google] Calendar sub-route: events
[GoogleCalendarEvents] Request received: { method: 'GET', hasHealth: true, query: { health: '1' } }
[GoogleCalendarEvents] Health check - API key present: true
```

Si NO ves estos logs, hay un error ANTES del handler.

### 3. Buscar Errores de OpenRouter Models
```
[Proxy] Routing request: { route: 'ai/openrouter/models', method: 'GET' }
[AI] Handling route: openrouter/models
[OpenRouter Models] Fetching models list...
[OpenRouter Models] Response status: 200
[OpenRouter Models] Successfully fetched 150 models
```

Si NO ves estos logs, el problema puede ser:
- Rate limiting bloqueando el request
- Error en fetch a OpenRouter API
- API key inválida o expirada

---

## 🚀 Próximos Pasos

### 1. Deploy Inmediato
```bash
git add api/proxy.ts PROBLEMAS_PRODUCCION_SOLUCIONADOS.md
git commit -m "fix: add detailed logging to diagnose 500 errors in calendar and openrouter"
git push origin main
```

### 2. Verificar Logs en Vercel (2-3 minutos después)
- Busca los nuevos logs `[Proxy]`, `[Google]`, `[AI]`
- Identifica EXACTAMENTE dónde falla cada endpoint
- Copia los logs completos

### 3. Posibles Causas Adicionales

#### A. Variables de Entorno Faltantes
**Verificar en Vercel Dashboard → Settings → Environment Variables**:
- ✅ `OPENROUTER_API_KEY` - Debe existir y ser válida
- ✅ `GOOGLE_CALENDAR_API_KEY` - Opcional, pero si existe debe ser válida
- ✅ `GOOGLE_MAPS_API_KEY` - Para cálculos de distancia

#### B. API Keys Inválidas
**OpenRouter**:
- Ir a https://openrouter.ai/keys
- Verificar que la key no esté expirada o revocada
- Probar con: `curl -H "Authorization: Bearer sk-or-v1-..." https://openrouter.ai/api/v1/models`

**Google Calendar**:
- Si está configurada, verificar en Google Cloud Console
- Puede que no esté habilitada la Calendar API

#### C. Rate Limiting Demasiado Agresivo
```typescript
// En api/proxy.ts
const aiRateLimiter = new RateLimiter(10, 60 * 1000); // 10 req/min
```

Si el usuario está haciendo muchas requests:
- Settings carga modelos → 1 request
- Cada recarga de página → más requests
- Puede estar bloqueado por rate limit

**Solución temporal**: Aumentar límite temporalmente para testing:
```typescript
const aiRateLimiter = new RateLimiter(50, 60 * 1000); // 50 req/min
```

---

## 📋 Checklist de Verificación Post-Deploy

- [ ] Deploy completado en Vercel
- [ ] Esperar 2-3 minutos
- [ ] Recargar https://fb-prov1.vercel.app/
- [ ] Ir a Calendario - ¿sigue dando error?
- [ ] Ir a Settings → APIs - ¿carga la lista de modelos?
- [ ] Revisar logs de Vercel
- [ ] Copiar logs de errores si persisten
- [ ] Verificar variables de entorno en Vercel
- [ ] Probar API keys manualmente

---

## 🔧 Solución Rápida si Persiste el Error

### Si el problema es la API Key de OpenRouter:

1. **Regenerar la key** en https://openrouter.ai/keys
2. **Actualizar en Vercel**:
   - Dashboard → FBProv1 → Settings → Environment Variables
   - Edit `OPENROUTER_API_KEY`
   - Paste nueva key
   - **Importante**: Click en "Redeploy" después de cambiar

### Si el problema es Google Calendar:

1. **Opción A: Deshabilitar temporalmente**
   - Comentar el componente de calendario
   - O mostrar mensaje "En mantenimiento"

2. **Opción B: Verificar OAuth**
   - Google Cloud Console → APIs & Services
   - Verificar que Calendar API esté habilitada
   - Verificar credenciales OAuth 2.0

---

## 📊 Logs Esperados (Exitosos)

### Health Check de Calendario:
```
[Proxy] Routing request: { route: 'google/calendar/events', method: 'GET' }
[Google] Handling route: google/calendar/events
[Google] Calendar sub-route: events
[GoogleCalendarEvents] Request received: { method: 'GET', hasHealth: true, query: { health: '1' } }
[GoogleCalendarEvents] Health check - API key present: true
→ Response: 200 { ready: true, usesApiKey: true }
```

### Fetch de Modelos OpenRouter:
```
[Proxy] Routing request: { route: 'ai/openrouter/models', method: 'GET' }
[AI] Handling route: openrouter/models
[OpenRouter Models] Fetching models list...
[OpenRouter Models] Response status: 200
[OpenRouter Models] Successfully fetched 150 models
→ Response: 200 { models: [...] }
```

---

## ⚠️ Si Aún Falla Después de Todo

Posibles causas extremas:
1. **Vercel Function Timeout** - Aunque aumentamos a 60s
2. **Memory Limit** - Aunque aumentamos a 1024MB
3. **Cold Start Issues** - Primera request falla, segunda funciona
4. **Region Issues** - Vercel edge function en región problemática
5. **Network/Firewall** - Vercel no puede alcanzar OpenRouter/Google APIs

**Solución**: Revisar los logs detallados que agregamos y copiarme el output completo.

---

## 📞 Siguiente Acción

1. **Haz el deploy AHORA**:
   ```bash
   git add .
   git commit -m "fix: add detailed logging for 500 error diagnosis"
   git push origin main
   ```

2. **Espera 2-3 minutos** que Vercel termine

3. **Prueba la app** y **revisa los logs de Vercel**

4. **Cópiame los logs completos** si persisten los errores

Los logs detallados que agregamos nos dirán EXACTAMENTE dónde está fallando.
