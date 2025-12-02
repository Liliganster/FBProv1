# Plan de Implementación Ordenado por Riesgo
## Organizado de MENOR a MAYOR riesgo de romper funcionalidades existentes

---

## 🟢 ZONA VERDE - Riesgo Mínimo (Implementar primero)

### ✅ **1. Agregar Headers de Seguridad HTTP** (CRÍTICO)
**Riesgo:** ⭐ Casi nulo
**Razón:** Solo se agregan headers en `vercel.json`, no toca código
**Impacto:** Solo mejora seguridad, no afecta funcionalidad
**Tiempo:** 10 minutos

```json
// Solo agregar en vercel.json
"headers": [...]
```

---

### ✅ **2. Eliminar Logs con Información Sensible** (CRÍTICO)
**Riesgo:** ⭐ Nulo
**Razón:** Solo eliminar/modificar console.logs
**Impacto:** No afecta lógica de negocio
**Tiempo:** 30 minutos

**Archivos a modificar:**
- `lib/api-handlers/ai/gemini.ts:360` - Eliminar log de API key
- Buscar todos los `console.log` con "key", "token", "secret"

---

### ✅ **3. Limpiar Archivos Temporales** (BAJO)
**Riesgo:** ⭐ Nulo
**Razón:** Solo limpieza de repo
**Impacto:** Ninguno
**Tiempo:** 5 minutos

```bash
git rm temp.txt tmp.patch build.log
echo "temp.txt\ntmp.patch\n*.log" >> .gitignore
```

---

### ✅ **4. Documentar Variables de Entorno** (ALTO)
**Riesgo:** ⭐ Nulo
**Razón:** Solo crear/actualizar documentación
**Impacto:** Ninguno en código existente
**Tiempo:** 20 minutos

Crear `.env.example` completo con todas las variables necesarias.

---

### ✅ **5. Habilitar Sourcemaps Ocultos** (MEDIO)
**Riesgo:** ⭐ Nulo
**Razón:** Solo cambio en build config
**Impacto:** Mejora debugging sin exponer código
**Tiempo:** 5 minutos

```typescript
// vite.config.ts
sourcemap: 'hidden',  // En vez de false
```

---

### ✅ **6. Configurar Monitoring (Sentry)** (ALTO)
**Riesgo:** ⭐ Casi nulo
**Razón:** Solo agregar integración, no modifica lógica
**Impacto:** Solo captura errores
**Tiempo:** 30 minutos

Ya hay código comentado para esto en `index.tsx:59`.

---

### ✅ **7. Ejecutar npm audit y Actualizar Dependencias** (ALTO)
**Riesgo:** ⭐⭐ Muy bajo (si se hace con cuidado)
**Razón:** Solo actualiza deps sin cambios breaking
**Impacto:** Puede requerir ajustes menores
**Tiempo:** 1-2 horas (incluye testing)

```bash
npm audit
npm audit fix
# Revisar y testear después
```

---

## 🟡 ZONA AMARILLA - Riesgo Bajo a Medio

### ⚠️ **8. Reducir Logging en Producción** (ALTO)
**Riesgo:** ⭐⭐ Bajo
**Razón:** Solo condicionar logs por NODE_ENV
**Impacto:** Puede ocultar info útil de debugging si se hace mal
**Tiempo:** 1 hora

```typescript
const isDev = process.env.NODE_ENV !== 'production';
if (isDev) console.log(...);
```

**PRECAUCIÓN:** No eliminar logs de errores críticos.

---

### ⚠️ **9. Configurar CORS Restrictivo** (ALTO)
**Riesgo:** ⭐⭐ Bajo-Medio
**Razón:** Agregar headers CORS
**Impacto:** **PUEDE BLOQUEAR** requests si origins no coinciden
**Tiempo:** 30 minutos

**CUIDADO:** Probar exhaustivamente en staging primero.

```typescript
res.setHeader('Access-Control-Allow-Origin', 'https://tu-dominio.com');
res.setHeader('Access-Control-Allow-Methods', 'GET,POST');
```

---

### ⚠️ **10. Optimizar Configuración de Cache** (MEDIO)
**Riesgo:** ⭐⭐ Bajo-Medio
**Razón:** Cambiar headers de cache
**Impacto:** Puede causar que usuarios vean versiones antiguas
**Tiempo:** 30 minutos

**PRECAUCIÓN:** Implementar cache busting en filenames.

---

### ⚠️ **11. Agregar Validación de Entrada en Endpoints** (ALTO)
**Riesgo:** ⭐⭐⭐ Medio
**Razón:** Agregar checks de validación
**Impacto:** **PUEDE RECHAZAR** requests que antes funcionaban
**Tiempo:** 2-3 horas

**ESTRATEGIA:** 
1. Primero solo logear validaciones fallidas (no rechazar)
2. Monitorear 1 semana
3. Luego activar rechazo

```typescript
// Fase 1: Solo logear
if (!isValid(input)) {
  console.warn('Invalid input:', input);
  // NO return error todavía
}

// Fase 2 (después de monitorear):
if (!isValid(input)) {
  return res.status(400).json({ error: 'Invalid input' });
}
```

---

### ⚠️ **12. Reducir Timeout de Funciones** (ALTO)
**Riesgo:** ⭐⭐⭐ Medio
**Razón:** Cambiar maxDuration de 60s a 10-15s
**Impacto:** **CAUSARÁ TIMEOUTS** en operaciones largas existentes
**Tiempo:** Depende de cuántas optimizaciones se necesiten

**ESTRATEGIA:**
1. Primero monitorear tiempos de ejecución actuales
2. Identificar funciones que toman >15s
3. Optimizar esas funciones primero
4. Luego reducir timeout

---

### ⚠️ **13. Implementar Rate Limiting Persistente (Vercel KV)** (CRÍTICO)
**Riesgo:** ⭐⭐⭐ Medio
**Razón:** Cambiar de Map en memoria a KV
**Impacto:** Si falla KV, fallback funciona pero **puede haber inconsistencias**
**Tiempo:** 2 horas (incluye configurar Vercel KV)

**BUENA NOTICIA:** El código ya tiene soporte para KV (líneas 218-240 en `lib/rate-limiter.ts`).

**PASOS:**
1. Crear Vercel KV store
2. Agregar env vars: `KV_REST_API_URL`, `KV_REST_API_TOKEN`
3. El código detectará automáticamente y usará KV
4. Fallback a memoria si KV falla

**PRECAUCIÓN:** Probar con tráfico bajo primero.

---

### ⚠️ **14. Implementar Tests Automatizados** (MEDIO)
**Riesgo:** ⭐⭐⭐ Medio
**Razón:** Agregar tests puede revelar bugs existentes
**Impacto:** Puede **descubrir problemas** que ya existían
**Tiempo:** Varios días

**ESTRATEGIA:** No bloqueante para despliegue inicial.

---

### ⚠️ **15. Auditar y Modificar Uso de localStorage** (MEDIO)
**Riesgo:** ⭐⭐⭐ Medio
**Razón:** 94 ubicaciones, cambiar puede afectar estado
**Impacto:** **PUEDE PERDER DATOS** de usuarios o romper sesiones
**Tiempo:** 3-4 horas

**ESTRATEGIA:**
1. Primero solo auditar (no cambiar)
2. Identificar qué es sensible
3. Migrar gradualmente con versioning

---

### ⚠️ **16. Optimizar Bundle y Code Splitting** (MEDIO)
**Riesgo:** ⭐⭐⭐ Medio-Alto
**Razón:** Cambiar imports y lazy loading
**Impacto:** **PUEDE ROMPER** carga de componentes
**Tiempo:** 4-6 horas

**PRECAUCIÓN:** Probar exhaustivamente todas las rutas.

---

### ⚠️ **17. Cambiar Importmaps/CDN** (MEDIO)
**Riesgo:** ⭐⭐⭐⭐ Alto
**Razón:** Cambiar cómo se cargan dependencias
**Impacto:** **PUEDE ROMPER** toda la app si falla
**Tiempo:** 2-3 horas

**PRECAUCIÓN:** Hacer en un branch separado, testing exhaustivo.

---

## 🔴 ZONA ROJA - Riesgo Alto (Implementar con MUCHO cuidado)

### 🚨 **18. Verificar y Ajustar Row Level Security (RLS) en Supabase** (ALTO)
**Riesgo:** ⭐⭐⭐⭐ Alto
**Razón:** Cambiar políticas de base de datos
**Impacto:** **PUEDE BLOQUEAR** queries legítimas y romper funcionalidad
**Tiempo:** 2-4 horas

**ESTRATEGIA CRÍTICA:**
1. **NO MODIFICAR** en producción directamente
2. Primero listar todas las políticas actuales:
```sql
SELECT * FROM pg_policies;
```
3. Documentar qué hace cada política
4. Probar cambios en staging/desarrollo
5. Implementar en producción en horario de baja actividad
6. Tener rollback preparado

**PRECAUCIÓN:** Este puede romper TODA la funcionalidad de la app.

---

### 🚨 **19. Reemplazar Sistema de Encriptación de API Keys** (CRÍTICO)
**Riesgo:** ⭐⭐⭐⭐ Alto
**Razón:** Cambiar algoritmo de encriptación
**Impacto:** **INVALIDARÁ** todas las API keys guardadas existentes
**Tiempo:** 3-4 horas + migración de datos

**ESTRATEGIA CRÍTICA:**
1. **NO REEMPLAZAR** el sistema directamente
2. Implementar NUEVA función de encriptación en paralelo
3. Crear script de migración:
```typescript
// Pseudo-código
async function migrateApiKeys() {
  const users = await getAllUsersWithApiKeys();
  for (const user of users) {
    // Desencriptar con sistema viejo
    const decrypted = await oldDecrypt(user.encrypted_key);
    // Re-encriptar con sistema nuevo
    const newEncrypted = await newEncrypt(decrypted);
    // Guardar
    await updateUser(user.id, { encrypted_key: newEncrypted });
  }
}
```
4. Ejecutar migración en mantenimiento programado
5. Notificar usuarios que pueden necesitar re-ingresar keys

**ALTERNATIVA MÁS SEGURA:**
- Usar Supabase Vault o AWS Secrets Manager
- Nunca almacenar en cliente
- Esto requiere refactor de arquitectura

---

### 🚨 **20. Eliminar VITE_GOOGLE_MAPS_API_KEY del Cliente** (CRÍTICO)
**Riesgo:** ⭐⭐⭐⭐⭐ MUY ALTO
**Razón:** Cambio arquitectónico que afecta múltiples componentes
**Impacto:** **ROMPERÁ** todas las funcionalidades de mapas si no está bien hecho
**Tiempo:** 4-6 horas + testing exhaustivo

**ARCHIVOS QUE DEBEN MODIFICARSE:**
1. `hooks/useGoogleMapsScript.ts:39-47`
2. `context/GoogleCalendarContext.tsx:38-40`
3. `lib/api-handlers/google/maps/directions.ts:45`
4. `lib/api-handlers/google/maps/staticmap.ts:40`
5. `dev-server.mjs:150, 191, 232`
6. `vite-env.d.ts:6` - Eliminar definición

**ESTRATEGIA CRÍTICA - PASO A PASO:**

#### Paso 1: Verificar que TODOS los endpoints proxy funcionan
```bash
# Probar cada endpoint manualmente
curl -X POST http://localhost:3000/api/google/maps/directions \
  -H "Content-Type: application/json" \
  -d '{"locations": ["Vienna", "Salzburg"]}'
```

#### Paso 2: Modificar useGoogleMapsScript
```typescript
// hooks/useGoogleMapsScript.ts
export function useGoogleMapsScript({...}: GoogleMapsOptions = {}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const src = useMemo(() => {
    const params = new URLSearchParams();
    if (libraries.length) params.set('libraries', libraries.join(','));
    if (language) params.set('language', language);
    if (region) params.set('region', region);
    if (version) params.set('v', version);
    params.set('loading', 'async');
    
    // ❌ ELIMINAR ESTA SECCIÓN COMPLETA:
    // const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    // if (apiKey) {
    //   params.set('key', apiKey);
    //   return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    // }
    
    // ✅ SOLO USAR PROXY:
    const query = params.toString();
    return `/api/google/maps/script${query ? `?${query}` : ''}`;
  }, [libraries, language, region, version]);
  
  // ... resto sin cambios
}
```

#### Paso 3: Modificar GoogleCalendarContext
```typescript
// context/GoogleCalendarContext.tsx líneas 38-40
// ❌ ELIMINAR:
// const GOOGLE_PICKER_DEVELOPER_KEY =
//   import.meta.env.VITE_GOOGLE_PICKER_API_KEY || 
//   import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// ✅ ALTERNATIVA: Picker puede usar la misma key del calendario
// o configurar VITE_GOOGLE_PICKER_API_KEY por separado
const GOOGLE_PICKER_DEVELOPER_KEY = 
  import.meta.env.VITE_GOOGLE_PICKER_API_KEY || '';
```

#### Paso 4: Limpiar handlers del servidor
```typescript
// lib/api-handlers/google/maps/directions.ts:45
// lib/api-handlers/google/maps/staticmap.ts:40

// ❌ ELIMINAR el fallback:
// const apiKey = process.env.GOOGLE_MAPS_API_KEY || 
//                process.env.VITE_GOOGLE_MAPS_API_KEY;

// ✅ SOLO SERVIDOR:
const apiKey = process.env.GOOGLE_MAPS_API_KEY;
```

#### Paso 5: Actualizar dev-server.mjs (líneas 150, 191, 232)
```javascript
// ❌ ELIMINAR:
// assertEnv('GOOGLE_MAPS_API_KEY') || assertEnv('VITE_GOOGLE_MAPS_API_KEY')

// ✅ SOLO:
assertEnv('GOOGLE_MAPS_API_KEY')
```

#### Paso 6: Actualizar vite-env.d.ts
```typescript
// vite-env.d.ts
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  // ❌ ELIMINAR: readonly VITE_GOOGLE_MAPS_API_KEY: string
  readonly VITE_GOOGLE_CALENDAR_CLIENT_ID: string
  readonly VITE_GOOGLE_PICKER_API_KEY?: string
}
```

#### Paso 7: Testing Exhaustivo
**CRÍTICO:** Probar TODAS estas funcionalidades:
- [ ] Carga del script de Google Maps en InteractiveMap
- [ ] Cálculo de distancia en TripsView
- [ ] Creación de mapas estáticos en TripDetailModal
- [ ] Google Picker (si se usa)
- [ ] Autocompletado de direcciones
- [ ] Todas las vistas que usan mapas

#### Paso 8: Deployment en Staging
```bash
# NO desplegar a producción directamente
vercel --prod=false  # Deploy a preview primero
# Probar exhaustivamente en preview
# Solo si TODO funciona → deploy a producción
```

**ROLLBACK PLAN:**
Si algo falla, tener preparado:
```bash
git revert <commit-hash>
vercel --prod
```

---

## 📋 RESUMEN - Orden de Implementación Recomendado

### Sprint 1 - SEGURO (1 día)
1. Headers de seguridad HTTP ✅
2. Eliminar logs sensibles ✅
3. Limpiar archivos temporales ✅
4. Documentar variables de entorno ✅
5. Sourcemaps ocultos ✅
6. Configurar Sentry ✅
7. npm audit ⚠️

### Sprint 2 - BAJO RIESGO (1 día)
8. Reducir logging condicional ⚠️
9. CORS restrictivo ⚠️ (staging primero)
10. Optimizar cache ⚠️

### Sprint 3 - RIESGO MEDIO (2-3 días)
11. Validación de entrada (fase logging) ⚠️⚠️
12. Implementar Vercel KV para rate limiting ⚠️⚠️
13. Monitorear timeouts actuales ⚠️⚠️

### Sprint 4 - ALTO RIESGO (3-4 días)
14. Verificar RLS en Supabase 🚨 (staging)
15. Auditar localStorage 🚨
16. Optimizar bundle 🚨

### Sprint 5 - MUY ALTO RIESGO (1 semana)
17. Plan de migración de encriptación 🚨🚨
18. **ELIMINAR VITE_GOOGLE_MAPS_API_KEY** 🚨🚨🚨
    - Probar en desarrollo
    - Probar en staging
    - Deploy a producción en horario valle
    - Monitorear errores 24-48h

---

## ⚠️ PRECAUCIONES GENERALES

1. **NUNCA** modificar más de 2-3 problemas críticos en el mismo deploy
2. **SIEMPRE** usar staging/preview antes de producción
3. **SIEMPRE** tener plan de rollback
4. **MONITOREAR** errores 24-48h después de cada cambio
5. **DOCUMENTAR** cada cambio y su impacto
6. **COMUNICAR** a usuarios si habrá downtime

---

## 🎯 Recomendación Final

**Para desplegar a producción LO ANTES POSIBLE:**

1. **Implementar Sprint 1** (1 día) - Son cambios seguros
2. **Configurar Vercel KV** (2 horas) - Crítico pero el código ya existe
3. **Eliminar VITE_GOOGLE_MAPS_API_KEY** (1 día completo con testing) - El más crítico
4. Desplegar a producción con monitoreo intensivo
5. Resolver el resto gradualmente en las siguientes semanas

**Tiempo estimado hasta producción:** 2-3 días laborables

Los otros problemas (encriptación, RLS, optimizaciones) pueden resolverse post-lanzamiento sin exponer la API key, que es el mayor riesgo actual.

