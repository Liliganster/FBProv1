# Configuración de Vercel para FahrtenBuch Pro

## Problema Resuelto
Vercel tiene un límite de **12 funciones serverless** en el plan gratuito. Esta aplicación ahora usa **solo 1 función** consolidada en `/api/proxy.ts`, lo que resuelve el problema del límite.

## Variables de Entorno Requeridas

Debes configurar estas variables en el dashboard de Vercel (Settings > Environment Variables):

### Obligatorias (Supabase)
```
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
```

### Para Google Maps (Mapas)
```
VITE_GOOGLE_MAPS_API_KEY=tu_api_key_de_google_maps
GOOGLE_MAPS_API_KEY=tu_api_key_de_google_maps
```

**Nota:** Puedes usar la misma API key para ambas variables.

### Para Google Calendar (Calendario)
```
VITE_GOOGLE_CALENDAR_CLIENT_ID=tu_client_id_oauth
GOOGLE_CALENDAR_API_KEY=tu_api_key_de_google_calendar
```

**Importante:** Para el calendario necesitas:
1. Crear un proyecto en Google Cloud Console
2. Habilitar Calendar API
3. Crear credenciales OAuth 2.0 (Client ID)
4. Crear una API Key
5. Configurar el dominio autorizado en OAuth (tu-dominio.vercel.app)

### Opcionales (IA)
```
GEMINI_API_KEY=tu_gemini_api_key
OPENROUTER_API_KEY=tu_openrouter_api_key
OPENROUTER_MODEL=google/gemini-2.0-flash-001
OPENROUTER_HTTP_REFERER=https://tu-dominio.vercel.app
OPENROUTER_TITLE=Fahrtenbuch Pro
```

### Seguridad (Opcional pero recomendado)
```
API_KEY_ENCRYPTION_SECRET=genera_con_crypto_random_bytes_32_hex
ADMIN_SECRET=genera_con_crypto_random_bytes_32_hex
```

Para generar los secrets ejecuta en terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Pasos de Despliegue

1. **Push a GitHub:**
   ```bash
   git add .
   git commit -m "feat: consolidate API handlers to single function"
   git push
   ```

2. **Conectar a Vercel:**
   - Ve a https://vercel.com
   - Import tu repositorio de GitHub
   - Vercel detectará automáticamente que es un proyecto Vite

3. **Configurar Variables de Entorno:**
   - En el dashboard de Vercel, ve a Settings > Environment Variables
   - Agrega todas las variables necesarias (ver arriba)
   - Aplica las variables a: Production, Preview, Development

4. **Deploy:**
   - Vercel hará el deploy automáticamente
   - Verifica que solo se crea 1 función serverless en el dashboard

## Verificación

Después del deploy, verifica:

1. **Dashboard de Vercel** > Functions tab
   - Deberías ver solo `api/proxy.ts`
   - No deberías ver múltiples funciones

2. **Prueba el calendario:**
   - Visita `https://tu-dominio.vercel.app/calendar`
   - Si las variables están bien configuradas, deberías poder conectar

3. **Prueba el mapa:**
   - Crea un viaje con múltiples ubicaciones
   - El mapa debería renderizarse correctamente

## Troubleshooting

### El calendario no funciona
- Verifica que `VITE_GOOGLE_CALENDAR_CLIENT_ID` esté configurado
- Verifica que `GOOGLE_CALENDAR_API_KEY` esté configurado
- Asegúrate de que tu dominio de Vercel esté autorizado en Google Cloud Console
- Verifica en la consola del navegador si hay errores de CORS

### El mapa no funciona
- Verifica que `VITE_GOOGLE_MAPS_API_KEY` esté configurado
- Verifica que la API de Maps JavaScript esté habilitada en Google Cloud
- Verifica que la API de Directions esté habilitada

### Error 429 (Too Many Requests) en APIs de IA
- Las APIs de IA tienen rate limiting de 10 requests por minuto por usuario
- Espera 1 minuto y vuelve a intentar

### Funciones múltiples en Vercel
Si ves más de 1 función:
1. Elimina la carpeta `/lib/api-handlers/` si existe
2. Asegúrate de que solo existe `/api/proxy.ts`
3. Re-deploy desde Vercel dashboard

## Estructura Final

```
/api
  └── proxy.ts          # ← ÚNICA función serverless (todo consolidado aquí)
/lib
  └── (sin api-handlers, todo movido a proxy.ts)
```

## Costos

- **Vercel Free Tier:** Suficiente para esta app (1 función serverless)
- **Supabase Free Tier:** Suficiente para pruebas
- **Google Maps API:** $200 USD crédito mensual gratis
- **Google Calendar API:** Gratis hasta 1M requests/día
- **Gemini API:** Free tier disponible
- **OpenRouter:** Pay-as-you-go

## Soporte

Si tienes problemas, verifica:
1. Los logs en Vercel Dashboard > Deployments > [tu deploy] > Functions
2. La consola del navegador para errores del cliente
3. Que todas las variables de entorno estén correctamente configuradas
