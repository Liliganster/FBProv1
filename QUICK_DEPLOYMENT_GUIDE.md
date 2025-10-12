# 🚀 Guía Rápida de Deployment - FahrtenbuchPro

## ⚡ Deployment en 5 Pasos

### 1. Generar Secrets (2 minutos)

```bash
# Generar API_KEY_ENCRYPTION_SECRET (obligatorio)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: abc123def456... (64 caracteres)

# Generar ADMIN_SECRET (opcional)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Configurar Variables de Entorno (5 minutos)

Crear archivo `.env` en la raíz del proyecto:

```bash
# Supabase (obligatorio)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Encriptación (obligatorio)
API_KEY_ENCRYPTION_SECRET=<tu_secret_de_64_caracteres_del_paso_1>

# API Keys del servidor (OPCIONAL - solo si quieres ofrecer fallback gratuito)
GEMINI_API_KEY=AIzaSy...  # Opcional
OPENROUTER_API_KEY=sk-or-v1-...  # Opcional

# Google Services (opcional)
GOOGLE_MAPS_API_KEY=AIzaSy...
VITE_GOOGLE_CALENDAR_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

**⚠️ IMPORTANTE**:
- Si NO configuras `GEMINI_API_KEY` ni `OPENROUTER_API_KEY`, cada usuario DEBE añadir su propia API key en Settings
- Si SÍ las configuras, los usuarios pueden usar tu API key como fallback

### 3. Instalar Dependencias (1 minuto)

```bash
npm install
```

### 4. Verificar Build Local (2 minutos)

```bash
# Compilar TypeScript
npm run build

# Si hay errores, verifica que:
# - .env esté configurado correctamente
# - node_modules esté instalado
# - No haya errores de TypeScript
```

### 5. Deploy a Vercel (3 minutos)

```bash
# Instalar Vercel CLI (solo primera vez)
npm install -g vercel

# Login en Vercel
vercel login

# Deploy
vercel --prod
```

Durante el deploy, Vercel te pedirá:
- ✅ Proyecto nuevo? → **Yes**
- ✅ Nombre del proyecto → **fahrtenbuch-pro** (o el que prefieras)
- ✅ Framework → **Vite** (detectado automáticamente)

#### 5.1 Configurar Variables en Vercel Dashboard

Ir a: https://vercel.com/[tu-usuario]/[tu-proyecto]/settings/environment-variables

Añadir todas las variables del archivo `.env`:

| Variable | Value | Environment |
|----------|-------|-------------|
| `VITE_SUPABASE_URL` | tu_url | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | tu_key | Production, Preview, Development |
| `API_KEY_ENCRYPTION_SECRET` | tu_secret | Production, Preview, Development |
| `GEMINI_API_KEY` | tu_key (opcional) | Production |
| `OPENROUTER_API_KEY` | tu_key (opcional) | Production |

#### 5.2 Re-deploy después de añadir variables

```bash
vercel --prod
```

---

## ✅ Verificación Post-Deployment

### 1. Verificar App Principal

```bash
# Abrir en browser
open https://fahrtenbuch-pro.vercel.app

# Debe cargar sin errores
# Debe mostrar página de login
```

### 2. Verificar Endpoints de API

```bash
# Test OpenRouter Proxy
curl -X POST https://fahrtenbuch-pro.vercel.app/api/ai/openrouter-proxy \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Hello","userId":"test","model":"google/gemini-2.0-flash-001"}'

# Esperado:
# - HTTP 200 si configuraste OPENROUTER_API_KEY
# - HTTP 503 si NO configuraste API key
```

### 3. Test de Usuario

1. Crear cuenta nueva
2. Ir a Settings
3. Intentar usar AI:
   - **Con API key del servidor**: Debe funcionar
   - **Sin API key del servidor**: Debe pedir que añadas tu propia key
4. Añadir tu API key de OpenRouter en Settings
5. Intentar usar AI → Debe funcionar con tu key

---

## 🔧 Troubleshooting

### Problema: "Supabase URL not configured"

**Solución**:
```bash
# Verificar que .env tiene:
VITE_SUPABASE_URL=https://xxxxx.supabase.co

# En Vercel, verificar que la variable está en:
# Settings > Environment Variables
```

### Problema: "OpenRouter API service unavailable"

**Solución**:
```bash
# Opción 1: Añadir API key del servidor en Vercel
OPENROUTER_API_KEY=sk-or-v1-xxxxx

# Opción 2: Pedir a usuarios que añadan su propia key
# (en Settings de la app)
```

### Problema: "Rate limit exceeded"

**Causa**: Más de 10 requests por minuto

**Solución**:
- Esperar 60 segundos
- O migrar a Upstash Redis para rate limiting persistente

### Problema: Build falla en Vercel

**Verificar**:
```bash
# Local build debe funcionar
npm run build

# Si falla local, verificar:
npx tsc --noEmit  # Debe retornar sin errores
```

---

## 🎯 Configuración Recomendada

### Para Testing/Demo

```bash
# .env mínimo
VITE_SUPABASE_URL=tu_url
VITE_SUPABASE_ANON_KEY=tu_key
API_KEY_ENCRYPTION_SECRET=tu_secret
OPENROUTER_API_KEY=tu_key  # Para que funcione sin que usuarios añadan key
```

### Para Producción Real

```bash
# .env completo
VITE_SUPABASE_URL=tu_url
VITE_SUPABASE_ANON_KEY=tu_key
API_KEY_ENCRYPTION_SECRET=tu_secret

# Opcional - solo si quieres ofrecer fallback gratuito:
GEMINI_API_KEY=tu_key
OPENROUTER_API_KEY=tu_key

# Google services
GOOGLE_MAPS_API_KEY=tu_key
VITE_GOOGLE_CALENDAR_CLIENT_ID=tu_client_id
```

---

## 📊 Estimación de Costos

### Sin API Keys de Servidor (Recomendado)

- **Vercel Hosting**: $0/mes (plan Hobby)
- **Supabase**: $0-25/mes (según uso)
- **OpenRouter/Gemini**: $0 (usuarios pagan sus propias keys)

**Total**: ~$0-25/mes

### Con API Keys de Servidor (Fallback)

- **Vercel Hosting**: $0/mes
- **Supabase**: $0-25/mes
- **OpenRouter API**: ~$5-50/mes (según uso)

**Total**: ~$5-75/mes

**💡 Tip**: Empieza sin API keys de servidor. Añádelas solo si quieres ofrecer uso gratuito.

---

## 🔄 Actualización de Código

```bash
# 1. Hacer cambios en local
git add .
git commit -m "Update: feature X"
git push

# 2. Vercel auto-deploya desde GitHub
# O manualmente:
vercel --prod
```

---

## 🎓 Configuración de Usuario Final

### Primera Vez

1. Usuario crea cuenta
2. Usuario va a **Settings**
3. Usuario añade:
   - Dirección de casa
   - OpenRouter API key (si no hay fallback del servidor)
   - Modelo de AI preferido
4. Usuario puede empezar a usar la app

### Obtener API Key de OpenRouter

1. Ir a: https://openrouter.ai/
2. Crear cuenta gratuita
3. Ir a: https://openrouter.ai/keys
4. Crear nueva API key
5. Copiar key (empieza con `sk-or-v1-`)
6. Pegar en Settings de FahrtenbuchPro

**Costo**: Pay-as-you-go, ~$0.10-0.50 por 1000 requests

---

## ✅ Checklist Final

- [ ] `.env` configurado con todas las variables obligatorias
- [ ] `npm run build` funciona sin errores
- [ ] Deploy a Vercel exitoso
- [ ] Variables de entorno añadidas en Vercel Dashboard
- [ ] App carga correctamente en producción
- [ ] Test de login/registro funciona
- [ ] Test de AI funciona (con o sin API key del servidor)
- [ ] Test de upload de archivos funciona
- [ ] Test de validación de archivos funciona

---

## 🆘 Soporte

¿Problemas con el deployment?

1. Revisar logs de Vercel: https://vercel.com/[tu-usuario]/[tu-proyecto]/deployments
2. Verificar variables de entorno en Vercel Dashboard
3. Verificar que el build local funciona: `npm run build`
4. Consultar documentación completa: `BACKEND_PROXY_IMPLEMENTATION.md`

---

**Tiempo Total Estimado**: ~15 minutos

**Dificultad**: ⭐⭐☆☆☆ (Fácil)

**Status**: ✅ Listo para deployment
