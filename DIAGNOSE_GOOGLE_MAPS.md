# Diagnóstico de Google Maps API

## 🔍 Endpoint de Prueba

He creado un endpoint especial para diagnosticar problemas con Google Maps API.

### Cómo Usarlo

#### Opción 1: Desde el navegador

Una vez deployado en Vercel, ve a:
```
https://tu-app.vercel.app/api/ai/test-geocode
```

#### Opción 2: Desde curl

```bash
curl https://tu-app.vercel.app/api/ai/test-geocode
```

#### Opción 3: Desarrollo local

```bash
curl http://localhost:5173/api/ai/test-geocode
```

## 📊 Qué Muestra el Endpoint

El endpoint te dará información completa sobre:

### 1. ✅ Si todo funciona correctamente

```json
{
  "timestamp": "2025-01-13T...",
  "environment": {
    "hasGoogleMapsApiKey": true,
    "apiKeyPrefix": "AIzaSyA...",
    "allEnvKeys": ["GOOGLE_MAPS_API_KEY", ...],
    "nodeEnv": "production",
    "vercelEnv": "production"
  },
  "test": {
    "address": "Calle Mayor, Madrid, España",
    "result": {
      "status": "OK",
      "resultsCount": 1,
      "firstResult": {
        "formatted_address": "Calle Mayor, 28013 Madrid, España",
        "location": {
          "lat": 40.4168,
          "lng": -3.7038
        },
        "location_type": "APPROXIMATE"
      }
    }
  },
  "message": "✅ Google Maps API is working correctly!",
  "solution": null
}
```

### 2. ❌ Si la API key NO está configurada

```json
{
  "environment": {
    "hasGoogleMapsApiKey": false,
    "apiKeyPrefix": null,
    "allEnvKeys": ["GOOGLE_CALENDAR_API_KEY", ...],
  },
  "message": "❌ Google Maps API key NOT configured",
  "solution": "Add GOOGLE_MAPS_API_KEY to Vercel environment variables"
}
```

**Solución:**
1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Añade: `GOOGLE_MAPS_API_KEY` = `tu_key`
4. Redeploy

### 3. ❌ Si la API key está RECHAZADA

```json
{
  "test": {
    "result": {
      "status": "REQUEST_DENIED",
      "error_message": "The provided API key is invalid"
    }
  },
  "message": "❌ REQUEST_DENIED - API key is invalid or has restrictions",
  "solution": "Check API key restrictions in Google Cloud Console",
  "googleErrorMessage": "The provided API key is invalid"
}
```

**Solución:**
1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Ve a "APIs & Services" → "Credentials"
3. Click en tu API key
4. Verifica que:
   - ✅ La key no esté restringida por IP/Referrer (o que incluya `*.vercel.app`)
   - ✅ Tenga acceso a "Geocoding API"
5. En "APIs & Services" → "Library"
   - Busca **Geocoding API**
   - Asegúrate de que esté **ENABLED**

### 4. ⚠️ Si hay un error de red

```json
{
  "test": {
    "error": {
      "message": "fetch failed",
      "stack": "..."
    }
  },
  "message": "❌ Exception when calling Google Maps API",
  "solution": "Check network connectivity and API endpoint"
}
```

## 🔧 Pasos de Resolución

### Paso 1: Ejecuta el Diagnóstico

```bash
curl https://tu-app.vercel.app/api/ai/test-geocode
```

### Paso 2: Lee el Mensaje

El campo `message` te dirá exactamente cuál es el problema:
- `✅ Google Maps API is working correctly!` → Todo bien
- `❌ Google Maps API key NOT configured` → Falta configurar en Vercel
- `❌ REQUEST_DENIED` → Problema con la API key en Google Cloud
- `❌ Exception` → Problema de red o configuración

### Paso 3: Sigue la Solución

El campo `solution` te dirá exactamente qué hacer.

## 🎯 Casos Comunes

### Caso 1: "API key NOT configured"

**Síntoma:**
```json
"hasGoogleMapsApiKey": false
```

**Causa:** No está en las variables de entorno de Vercel

**Solución:**
```bash
# Opción A: Vercel CLI
vercel env add GOOGLE_MAPS_API_KEY

# Opción B: Dashboard
# Settings → Environment Variables → Add New
```

### Caso 2: "REQUEST_DENIED"

**Síntoma:**
```json
"status": "REQUEST_DENIED"
```

**Causas posibles:**
1. API key incorrecta
2. Geocoding API no habilitada
3. Restricciones de la API key

**Solución:**
1. Verifica en Google Cloud Console que la key sea correcta
2. Habilita "Geocoding API"
3. En restricciones de la API key:
   - Application restrictions: **None**
   - O añade: `*.vercel.app` a HTTP referrers
   - API restrictions: Asegúrate de que **Geocoding API** esté seleccionada

### Caso 3: "OVER_QUERY_LIMIT"

**Síntoma:**
```json
"status": "OVER_QUERY_LIMIT"
```

**Causa:** Excediste el límite gratuito de Google Maps

**Solución:**
1. Google Maps da $200 gratis/mes
2. Geocoding API cuesta $5 por 1000 requests
3. $200 gratuitos = 40,000 geocodificaciones/mes
4. Revisa tu uso en [Google Cloud Billing](https://console.cloud.google.com/billing)

## 📝 Información de Debug

El endpoint también muestra:

### Variables de entorno disponibles

```json
"allEnvKeys": [
  "GOOGLE_MAPS_API_KEY",      // ← La que necesitamos
  "GOOGLE_CALENDAR_API_KEY",  // Otras Google keys
  "VITE_GOOGLE_MAPS_API_KEY", // Version cliente (no usar)
  ...
]
```

### Prefijo de la API key

```json
"apiKeyPrefix": "AIzaSyA..."  // Primeros 10 caracteres
```

Esto te permite verificar que:
1. La key está disponible
2. Es la key correcta
3. No es una key del cliente (`VITE_*`)

## 🚀 Una Vez Solucionado

Cuando veas:
```json
"message": "✅ Google Maps API is working correctly!"
```

El modo agente funcionará correctamente y geocodificará direcciones reales.

## 📞 Debugging Adicional

Si el endpoint muestra que TODO está bien pero el agente sigue sin funcionar, revisa:

1. **Logs del agente en Vercel:**
   ```bash
   vercel logs --follow
   ```

2. **Busca estos mensajes:**
   ```
   [geocode_address] ✓ API Key found: AIzaSyA...
   [geocode_address] Calling Google Maps API for: "..."
   [geocode_address] API Response status: OK
   [geocode_address] ✓ Success: ...
   ```

3. **Si ves:**
   ```
   [geocode_address] ⚠️ Google Maps API key NOT configured
   ```

   Significa que la variable no está llegando al executor. Verifica que:
   - Hiciste redeploy DESPUÉS de añadir la variable
   - La variable está en Production (no solo Preview)

## 🔗 Enlaces Útiles

- [Google Cloud Console](https://console.cloud.google.com/)
- [Habilitar Geocoding API](https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com)
- [Gestionar API Keys](https://console.cloud.google.com/apis/credentials)
- [Configurar Environment Variables en Vercel](https://vercel.com/docs/projects/environment-variables)
