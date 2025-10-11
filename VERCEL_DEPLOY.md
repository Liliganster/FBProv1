# 🚀 Despliegue en Vercel - Fahrtenbuch Pro

## URL del proyecto
- **Producción:** https://fb-prov1.vercel.app
- **Repositorio:** https://github.com/Liliganster/FBProv1.git

## ✅ Archivos de configuración creados

- ✅ vercel.json - Configuración optimizada para Vite
- ✅ .env.example - Plantilla de variables de entorno
- ✅ .gitignore actualizado - Excluye carpeta .vercel

## 📋 Pasos para desplegar

### 1. Push a GitHub

```bash
git add .
git commit -m "feat: Add Vercel configuration"
git push origin main
```

### 2. Configurar variables de entorno en Vercel

Ve a: https://vercel.com/liliganster/fbprov1/settings/environment-variables

Agrega estas variables (marca Production, Preview y Development):

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
VITE_GOOGLE_MAPS_API_KEY=tu_google_maps_key
VITE_GOOGLE_CALENDAR_CLIENT_ID=tu_client_id
GOOGLE_MAPS_API_KEY=tu_maps_server_key
GOOGLE_CALENDAR_API_KEY=tu_calendar_server_key
GEMINI_API_KEY=tu_gemini_key
OPENROUTER_API_KEY=tu_openrouter_key
OPENROUTER_MODEL=google/gemini-2.0-flash-001
OPENROUTER_HTTP_REFERER=https://fb-prov1.vercel.app
OPENROUTER_TITLE=Fahrtenbuch Pro
```

### 3. Redeploy

Después de agregar las variables:
1. Ve a: https://vercel.com/liliganster/fbprov1/deployments
2. Click en el último deployment → ... → Redeploy

## 🔧 Configurar Supabase para producción

En tu Supabase Dashboard:

1. Ve a: https://app.supabase.com/project/_/settings/auth
2. En **URL Configuration** agrega:
   - **Site URL:** https://fb-prov1.vercel.app
   - **Redirect URLs:** https://fb-prov1.vercel.app/**

## 🔑 Configurar Google OAuth (si aplica)

En Google Cloud Console:

1. Ve a: https://console.cloud.google.com/apis/credentials
2. Edita tu OAuth Client ID
3. **Authorized JavaScript origins:**
   - https://fb-prov1.vercel.app
4. **Authorized redirect URIs:**
   - https://fb-prov1.vercel.app

## 🚀 Actualizaciones futuras

Cada vez que hagas cambios:

```bash
git add .
git commit -m "Descripción de cambios"
git push origin main
```

Vercel automáticamente:
- ✅ Detecta el cambio
- ✅ Ejecuta el build  
- ✅ Despliega a producción
- ✅ Te notifica por email

## 📊 Monitoreo

URLs importantes:
- **Dashboard:** https://vercel.com/liliganster/fbprov1
- **Deployments:** https://vercel.com/liliganster/fbprov1/deployments
- **Analytics:** https://vercel.com/liliganster/fbprov1/analytics
- **Logs:** https://vercel.com/liliganster/fbprov1/logs

## ⚡ Build optimizado

Tu configuración actual genera:

```
dist/index.html                         2.40 kB │ gzip:  0.94 kB
dist/assets/supabase-BAcc0x8N.js      131.69 kB │ gzip: 34.57 kB
dist/assets/react-vendor-aS3p4E6Q.js  140.34 kB │ gzip: 45.02 kB
dist/assets/charts-DHRA5yCg.js        362.44 kB │ gzip: 95.50 kB
dist/assets/index-34iN-phQ.js         386.34 kB │ gzip: 92.10 kB
```

## ✅ Checklist post-despliegue

- [ ] Push realizado a GitHub
- [ ] Variables de entorno configuradas en Vercel
- [ ] Redeploy ejecutado
- [ ] App carga en https://fb-prov1.vercel.app
- [ ] Login funciona correctamente
- [ ] Supabase conecta correctamente
- [ ] Google OAuth funciona (si aplica)

## 🆘 Troubleshooting

### Build falla

```bash
npm run build  # Prueba local primero
```

### Variables de entorno no funcionan

Asegurate que:
- Las variables de cliente usan el prefijo VITE_
- GEMINI_API_KEY y OPENROUTER_* se definen sin prefijo VITE_ (solo backend)
- Estan marcadas para Production, Preview y Development
- Has ejecutado Redeploy despues de agregarlas

### Error 404 en rutas (al hacer refresh)

**S�ntoma:** Error 404 NOT_FOUND al hacer refresh en rutas como `/trips`, `/projects`

**Causa:** Vercel no encuentra el archivo f�sico y no est� redirigiendo a `index.html`

**Soluci�n R�pida:**

1. **Verifica que `vercel.json` existe y tiene el contenido correcto:**
   ```json
   {
     "rewrites": [
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ],
     "headers": [
       {
         "source": "/assets/(.*)",
         "headers": [
           {
             "key": "Cache-Control",
             "value": "public, max-age=31536000, immutable"
           }
         ]
       }
     ]
   }
   ```

2. **Fuerza un redeploy en Vercel:**
   - Ve a: https://vercel.com/liliganster/fbprov1/deployments
   - Click en el �ltimo deployment (el de arriba)
   - Click en el bot�n "..." (tres puntos)
   - Selecciona **"Redeploy"**
   - Marca la opci�n **"Use existing Build Cache"** como **OFF** ?
   - Click "Redeploy"

3. **Espera 2-3 minutos** y prueba de nuevo

4. **Si el problema persiste:**
   ```bash
   # Haz un commit vac�o para forzar rebuild
   git commit --allow-empty -m "fix: Force Vercel redeploy for routing"
   git push origin main
   ```

5. **Limpia la cach� del navegador:**
   - Chrome: Ctrl+Shift+Delete ? Borrar cach�
   - O prueba en modo inc�gnito (Ctrl+Shift+N)

**Prevenci�n:** 
- ? El archivo `vercel.json` YA EXISTE y est� bien configurado
- ?? NUNCA lo borres o modifiques sin saber qu� haces
- El problema es que Vercel necesita hacer rebuild para aplicar la configuraci�n

**SOLUCI�N APLICADA - 2025-10-06:**

? **vercel.json actualizado con:**
- `buildCommand` y `outputDirectory` expl�citos
- `framework: "vite"` especificado
- Doble configuraci�n: `rewrites` + `routes` para m�xima compatibilidad
- Headers de seguridad adicionales

? **public/_redirects creado** como fallback

**SIGUIENTE PASO CR�TICO:**
```bash
# Ejecuta AHORA en tu terminal:
git add .
git commit -m "fix: Complete Vercel SPA routing configuration"
git push origin main
```

**Luego:**
1. Ve a Vercel Deployments: https://vercel.com/liliganster/fbprov1/deployments
2. Espera que termine el deploy autom�tico (2-3 min)
3. **SI PERSISTE EL ERROR:** Haz redeploy manual sin cach� (bot�n "..." ? Redeploy ? Desmarcar "Use existing Build Cache")

**Estado:** ? Configuraci�n completa aplicada | ? Esperando commit + push

---

**Creado:** 2025-10-06 13:59:32
