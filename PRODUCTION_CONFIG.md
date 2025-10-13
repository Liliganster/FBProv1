# 🔧 Configuración para Producción

## ❌ Problemas Identificados

### 1. **Google Maps - No calcula distancias**
- **Causa**: Variables de entorno mal configuradas o API Key sin permisos
- **APIs necesarias**: 
  - Directions API (para cálculo de distancias)
  - Geocoding API (para convertir direcciones en coordenadas)
  - Maps JavaScript API (para mostrar mapas)

### 2. **Google Calendar - No funciona**
- **Causa**: Falta `GOOGLE_CALENDAR_API_KEY` del servidor
- **APIs necesarias**:
  - Calendar API (para acceso a calendarios)
  - OAuth 2.0 (para autenticación de usuarios)

## ✅ Variables de Entorno Requeridas

### **Supabase (OBLIGATORIO)**
```bash
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
```

### **Google Maps (OBLIGATORIO para distancias)**
```bash
# Cliente - Para mapas y geocoding
VITE_GOOGLE_MAPS_API_KEY=tu_google_maps_key
# Servidor - Para cálculo de distancias  
GOOGLE_MAPS_API_KEY=tu_google_maps_key
```

### **Google Calendar (OPCIONAL)**
```bash
# Cliente - Para autenticación OAuth
VITE_GOOGLE_CALENDAR_CLIENT_ID=tu_client_id.apps.googleusercontent.com
# Servidor - Para operaciones de calendario
GOOGLE_CALENDAR_API_KEY=tu_google_calendar_key
```

### **Seguridad (OBLIGATORIO)**
```bash
# Para encriptar API keys de usuarios (32 bytes en hex)
API_KEY_ENCRYPTION_SECRET=tu_secret_64_caracteres_hex
```

### **AI Services (OPCIONAL)**
```bash
# Para funcionalidades de AI/extractor
GEMINI_API_KEY=tu_gemini_key
OPENROUTER_API_KEY=tu_openrouter_key
OPENROUTER_MODEL=google/gemini-2.0-flash-001
```

## 🚀 Configuración en Vercel

### 1. **Variables de Entorno en Vercel**
```bash
# En el dashboard de Vercel, Settings -> Environment Variables
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_GOOGLE_MAPS_API_KEY=...
VITE_GOOGLE_CALENDAR_CLIENT_ID=...
GOOGLE_MAPS_API_KEY=...
GOOGLE_CALENDAR_API_KEY=...
API_KEY_ENCRYPTION_SECRET=...
```

### 2. **Google Cloud Console - APIs Habilitadas**

#### Para Google Maps:
- [ ] **Maps JavaScript API**
- [ ] **Geocoding API** 
- [ ] **Directions API**
- [ ] **Places API** (opcional)

#### Para Google Calendar:
- [ ] **Calendar API**
- [ ] **OAuth 2.0** configurado con dominios autorizados

### 3. **Restricciones de API Key**

#### Google Maps API Key:
- **Restricción de aplicación**: Referentes HTTP
- **Referentes del sitio web**:
  - `https://tu-dominio.vercel.app/*`
  - `https://*.vercel.app/*` (para previews)
  - `http://localhost:*` (para desarrollo)

#### Google Calendar:
- **OAuth Client ID** configurado con:
  - Origen autorizado: `https://tu-dominio.vercel.app`
  - URI de redirección: `https://tu-dominio.vercel.app/auth-callback`

## 🔍 Diagnóstico

### **Verificar Variables Localmente**
```bash
# En el navegador (F12 Console):
console.log('VITE_GOOGLE_MAPS_API_KEY:', import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
console.log('VITE_GOOGLE_CALENDAR_CLIENT_ID:', import.meta.env.VITE_GOOGLE_CALENDAR_CLIENT_ID)
```

### **Probar API de Distancias**
```bash
# POST a tu dominio/api/google/maps/directions
{
  "locations": ["Madrid, España", "Barcelona, España"],
  "region": "ES"
}
```

### **Verificar Calendar Health**
```bash
# GET a tu dominio/api/google/calendar/events?health=1
# Respuesta esperada: {"ready": true}
```

## ⚡ Solución Rápida

1. **Obtener Google Maps API Key**:
   - Ve a [Google Cloud Console](https://console.cloud.google.com/)
   - Habilita: Maps JavaScript API, Geocoding API, Directions API
   - Crea API Key y configura restricciones

2. **Obtener Google Calendar API Key**:
   - Habilita Calendar API
   - Crea API Key para servidor
   - Configura OAuth 2.0 Client ID para cliente

3. **Configurar en Vercel**:
   - Agrega todas las variables de entorno
   - Redeploy la aplicación

4. **Verificar funcionamiento**:
   - Prueba cálculo de distancia en un viaje
   - Prueba sincronización de calendario

## 🚨 Estado Actual

- ✅ **Supabase**: Configurado correctamente
- ❌ **Google Maps**: Falta configuración completa de APIs
- ❌ **Google Calendar**: Falta `GOOGLE_CALENDAR_API_KEY`
- ✅ **Encriptación**: Configurada
- ❌ **AI Services**: API keys no configuradas (opcional)

## 📝 Próximos Pasos

1. Configurar correctamente las APIs de Google Cloud
2. Agregar todas las variables de entorno en Vercel
3. Probar funcionalidades después del deployment
4. Configurar restricciones de seguridad apropiadas