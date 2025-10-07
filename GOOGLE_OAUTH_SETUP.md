# 🔐 Configuración de Google OAuth - Guía Completa

La aplicación usa Google OAuth en DOS lugares diferentes:
1. **Login con Google** (a través de Supabase Auth)
2. **Google Calendar** (directo con Google APIs)

---

## 📋 Paso 1: Google Cloud Console

### 1.1 Crear/Seleccionar Proyecto
- Ve a: https://console.cloud.google.com/
- Crea un nuevo proyecto o selecciona uno existente
- Nombre sugerido: "Fahrtenbuch Pro"

### 1.2 Habilitar APIs
Ve a **APIs & Services** → **Library** y habilita:
- ✅ Google Calendar API
- ✅ Google Picker API (opcional, para Drive)

### 1.3 Crear API Key (para Google Calendar)
1. Ve a **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **API Key**
3. Copia el API Key
4. (Opcional) Restringir a Calendar API y Picker API
5. **Guarda este valor:** `VITE_GOOGLE_CALENDAR_API_KEY`

### 1.4 Crear OAuth 2.0 Client ID

1. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
2. Si te pide, configura la "OAuth consent screen" primero:
   - User Type: **External**
   - App name: **Fahrtenbuch Pro**
   - User support email: tu email
   - Developer contact: tu email
   - Scopes: Agrega los siguientes:
     - `.../auth/calendar.events`
     - `.../auth/calendar.readonly`
     - `.../auth/calendar.calendarlist.readonly`
     - `.../auth/drive.readonly` (opcional)
   - Test users: Agrega tu email para testing
   - **IMPORTANTE:** Mientras esté en "Testing", solo los test users pueden usarlo

3. Vuelve a Credentials y crea el OAuth client ID:
   - Application type: **Web application**
   - Name: **Fahrtenbuch Pro**

4. **Authorized JavaScript origins** - Agrega EXACTAMENTE:
   ```
   https://fb-prov1.vercel.app
   http://localhost:5173
   ```

5. **Authorized redirect URIs** - Agrega TODOS estos:
   ```
   https://fb-prov1.vercel.app
   https://fb-prov1.vercel.app/auth/callback
   http://localhost:5173
   http://localhost:5173/auth/callback
   ```
   
   **ADEMÁS, agrega el redirect URI de Supabase:**
   ```
   https://[TU_PROYECTO_ID].supabase.co/auth/v1/callback
   ```
   
   Ejemplo: `https://abcdefghijklmnop.supabase.co/auth/v1/callback`

6. Click **CREATE**
7. Copia el **Client ID** (termina en `.apps.googleusercontent.com`)
8. **Guarda este valor:** `VITE_GOOGLE_CALENDAR_CLIENT_ID`

---

## 📋 Paso 2: Configurar Supabase

### 2.1 Ve a tu Supabase Dashboard:
https://supabase.com/dashboard/project/[TU_PROYECTO]

### 2.2 Ve a **Authentication** → **Providers**

### 2.3 Habilita Google:
1. Toggle **Google Enabled** a ON
2. **Client ID**: Pega el MISMO Client ID que creaste en Google Cloud
3. **Client Secret**: Pega el Client Secret de Google Cloud (lo obtuviste al crear el OAuth Client)
4. Click **Save**

### 2.4 Copia el Redirect URL de Supabase:
Supabase te muestra el redirect URL que necesitas agregar en Google Cloud Console.
Será algo como: `https://[tu-proyecto].supabase.co/auth/v1/callback`

**Vuelve a Google Cloud Console y asegúrate de que esta URL esté en "Authorized redirect URIs"**

---

## 📋 Paso 3: Variables de Entorno en Vercel

Ve a: Vercel Dashboard → Tu Proyecto → Settings → Environment Variables

Agrega estas variables:

```bash
VITE_GOOGLE_CALENDAR_API_KEY=AIzaSy...tu_api_key
VITE_GOOGLE_CALENDAR_CLIENT_ID=123456789-abc.apps.googleusercontent.com
```

**IMPORTANTE:** Usa el MISMO Client ID que configuraste en Supabase

---

## 📋 Paso 4: Redeploy

1. En Vercel, ve a **Deployments**
2. Click en los **3 puntos** del último deployment
3. Click **Redeploy**
4. Espera 2-3 minutos

---

## ✅ Verificación Final

### Checklist de redirect URIs en Google Cloud Console:

Debe tener TODOS estos:
- [ ] `https://fb-prov1.vercel.app`
- [ ] `https://fb-prov1.vercel.app/auth/callback`
- [ ] `https://[TU_PROYECTO].supabase.co/auth/v1/callback` ⬅️ **ESTE ES CRÍTICO**
- [ ] `http://localhost:5173` (desarrollo)
- [ ] `http://localhost:5173/auth/callback` (desarrollo)

### Checklist de JavaScript origins:
- [ ] `https://fb-prov1.vercel.app`
- [ ] `http://localhost:5173`

---

## 🐛 Troubleshooting

**Error: redirect_uri_mismatch**
- Verifica que TODAS las URIs de arriba estén configuradas
- Espera 5-10 minutos después de guardar en Google Cloud
- Limpia cache del navegador (Ctrl+Shift+R)

**Error: access_denied**
- Verifica que el email esté en "Test users" si la app está en modo Testing
- Publica la app en Google Cloud Console (OAuth consent screen)

**Login con Google no funciona:**
- Verifica que Supabase tenga Google habilitado
- Verifica que el Client ID y Secret sean correctos en Supabase

**Calendar no se conecta:**
- Verifica que las variables de entorno estén en Vercel
- Abre consola del navegador y busca logs de `[Google Calendar]`

---

## 🎯 Resumen

**Para que TODO funcione, necesitas:**

1. UN solo OAuth Client ID en Google Cloud Console
2. ESTE Client ID configurado en:
   - Supabase (para login)
   - Vercel variables de entorno (para calendar)
3. Los redirect URIs correctos en Google Cloud Console
4. Google Provider habilitado en Supabase

**Si sigues estos pasos exactamente, ambos (login y calendar) funcionarán.** ✅