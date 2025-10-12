# Configuración de Google Maps API en Vercel

## 🔧 Problema Común: "API key not configured"

Si ves este error en los logs de Vercel:
```
[geocode_address] ⚠️ Google Maps API key NOT configured
[geocode_address] Checked: GOOGLE_MAPS_API_KEY, VITE_GOOGLE_MAPS_API_KEY
```

Significa que la variable de entorno no está disponible en el servidor.

## ✅ Solución: Configurar en Vercel

### Paso 1: Obtener API Key de Google Maps

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto o selecciona uno existente
3. Ve a **APIs & Services** → **Credentials**
4. Click en **Create Credentials** → **API Key**
5. **IMPORTANTE**: Configura restricciones:
   - **Application restrictions**: None (o HTTP referrers si prefieres)
   - **API restrictions**: Restrict key → Selecciona:
     - ✅ **Geocoding API**
     - ✅ Maps JavaScript API (opcional, si usas mapas visuales)
     - ✅ Maps Static API (opcional)

6. Copia la API key (ej: `AIzaSyA...`)

### Paso 2: Habilitar Geocoding API

1. En Google Cloud Console, ve a **APIs & Services** → **Library**
2. Busca **Geocoding API**
3. Click en **ENABLE**
4. Espera unos segundos a que se active

### Paso 3: Configurar en Vercel

#### Opción A: Desde Dashboard de Vercel (Recomendado)

1. Ve a tu proyecto en [vercel.com](https://vercel.com)
2. Click en **Settings** → **Environment Variables**
3. Añade una nueva variable:
   ```
   Name: GOOGLE_MAPS_API_KEY
   Value: AIzaSyA...  (tu API key completa)
   Environment: Production, Preview, Development (selecciona todos)
   ```
4. Click en **Save**
5. **IMPORTANTE**: Haz un nuevo deploy:
   ```bash
   # Opción 1: Redeploy desde Vercel dashboard
   # Ve a Deployments → Click en los 3 puntos del último deploy → Redeploy

   # Opción 2: Commit dummy y push
   git commit --allow-empty -m "Trigger redeploy for env vars"
   git push
   ```

#### Opción B: Desde CLI de Vercel

```bash
# Instalar Vercel CLI si no lo tienes
npm i -g vercel

# Login
vercel login

# Añadir variable de entorno
vercel env add GOOGLE_MAPS_API_KEY

# Cuando pregunte por el valor, pega tu API key
# Selecciona: Production, Preview, Development

# Redeploy
vercel --prod
```

### Paso 4: Verificar Configuración

#### Opción 1: Desde Vercel Dashboard
1. Ve a **Settings** → **Environment Variables**
2. Deberías ver:
   ```
   GOOGLE_MAPS_API_KEY
   Production: ••••••••••••
   Preview: ••••••••••••
   Development: ••••••••••••
   ```

#### Opción 2: Usando los Logs
Haz una petición al modo agente y revisa los logs:

```bash
# Abre los logs en tiempo real
vercel logs --follow

# En otra terminal, haz una petición de prueba
curl -X POST https://tu-app.vercel.app/api/ai/openrouter/structured \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "agent",
    "useCrewFirst": true,
    "text": "Test",
    "apiKey": "tu-openrouter-key"
  }'
```

Deberías ver en los logs:
```
[geocode_address] ✓ API Key found: AIzaSyA...
```

## 🐛 Troubleshooting

### Error: "REQUEST_DENIED"

```
[geocode_address] ❌ REQUEST_DENIED - Check API key validity
```

**Causas posibles:**
1. La API key no es válida
2. Geocoding API no está habilitada
3. La API key tiene restricciones muy estrictas

**Solución:**
1. Verifica que la key sea correcta
2. Habilita Geocoding API en Google Cloud Console
3. Si tienes restricciones de IP/Referrer, añade:
   - Para Vercel: `*.vercel.app`
   - O elimina restricciones temporalmente

### Error: "OVER_QUERY_LIMIT"

```
[geocode_address] ⚠️ No results (status: OVER_QUERY_LIMIT)
```

**Causa:** Excediste el límite de la API de Google Maps

**Solución:**
1. Google Maps da $200 de crédito gratis/mes
2. Revisa tu uso en [Google Cloud Console](https://console.cloud.google.com/billing)
3. Configura límites de cuota si es necesario

### La variable no aparece en los logs

**Síntomas:**
```
[geocode_address] ⚠️ Google Maps API key NOT configured
```

**Causas y soluciones:**

1. **No hiciste redeploy después de añadir la variable**
   ```bash
   vercel --prod
   ```

2. **La variable está en "Production" pero estás testeando en "Preview"**
   - Añade la variable también a Preview y Development

3. **Error de tipeo en el nombre**
   - Debe ser exactamente: `GOOGLE_MAPS_API_KEY`
   - No: `GOOGLE_MAP_API_KEY` o `GOOGLE_MAPS_KEY`

4. **La función está usando el Edge Runtime**
   - Vercel Edge no soporta `process.env` en runtime
   - Solución: Usa Vercel Serverless Functions (Node.js runtime)

### Verificar que la API funciona

Prueba directamente la API de Google Maps:

```bash
curl "https://maps.googleapis.com/maps/api/geocode/json?address=Calle+Mayor+Madrid&key=TU_API_KEY"
```

Deberías recibir:
```json
{
  "status": "OK",
  "results": [...]
}
```

Si recibes `REQUEST_DENIED`, el problema está en Google Cloud, no en Vercel.

## 📊 Costos y Límites

### Cuota Gratuita de Google Maps
- $200 USD de crédito gratis cada mes
- Geocoding API: $5 por 1000 requests
- Con $200 gratuitos = **40,000 geocodificaciones gratis/mes**

### Optimización de Costos

1. **Usa caché**: Guarda geocodificaciones en tu base de datos
   ```typescript
   // Antes de geocodificar, busca en caché
   const cached = await db.geocodeCache.findOne({ address });
   if (cached) return cached.result;

   // Si no está en caché, geocodifica
   const result = await executeGeocodeAddress({ address });

   // Guarda en caché
   await db.geocodeCache.create({ address, result });
   ```

2. **Usa modo directo cuando no necesites geocodificación**
   ```javascript
   // Sin geocodificación (gratis)
   { mode: 'direct', useCrewFirst: true }

   // Con geocodificación (usa Google Maps)
   { mode: 'agent', useCrewFirst: true }
   ```

## ✅ Checklist de Configuración

- [ ] API key creada en Google Cloud Console
- [ ] Geocoding API habilitada
- [ ] API key copiada completa (empieza con `AIza`)
- [ ] Variable `GOOGLE_MAPS_API_KEY` añadida en Vercel
- [ ] Variable configurada en Production, Preview y Development
- [ ] Redeploy realizado después de añadir la variable
- [ ] Logs verificados: `✓ API Key found`
- [ ] Prueba de geocodificación exitosa

## 🔗 Enlaces Útiles

- [Google Cloud Console](https://console.cloud.google.com/)
- [Geocoding API Docs](https://developers.google.com/maps/documentation/geocoding)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Precios de Google Maps](https://mapsplatform.google.com/pricing/)

## 💡 Alternativas si no quieres usar Google Maps

Si no quieres configurar Google Maps, el sistema seguirá funcionando pero:
- `latitude` y `longitude` serán `null`
- `formatted_address` será la dirección original sin normalizar
- `confidence` será `0`

El JSON seguirá siendo válido y la aplicación funcionará, solo sin coordenadas GPS.
