# 🔧 Solución a Errores de Login

## ❌ Problema Actual

Los errores que ves en la consola son:

```
Failed to load resource: the server responded with a status of 400 ()
AuthApiError: Invalid Refresh Token: Refresh Token Not Found
```

## 🎯 Causa

**NO existe el archivo `.env`** con las credenciales de Supabase configuradas.

---

## ✅ SOLUCIÓN INMEDIATA (2 minutos)

### Paso 1: Crear archivo `.env`

En la raíz del proyecto, crea un archivo llamado `.env` (sin extensión):

```bash
# Windows
type nul > .env

# O simplemente créalo con tu editor de texto
```

### Paso 2: Añadir credenciales de Supabase

Abre el archivo `.env` y pega esto:

```bash
# Supabase Configuration (OBLIGATORIO)
VITE_SUPABASE_URL=https://tu_proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tu_anon_key_aqui

# Encriptación (OBLIGATORIO)
API_KEY_ENCRYPTION_SECRET=abc123def456... (64 caracteres hex)

# API Keys del servidor (OPCIONAL - solo si quieres fallback gratuito)
# GEMINI_API_KEY=tu_gemini_key_aqui
# OPENROUTER_API_KEY=tu_openrouter_key_aqui
```

### Paso 3: Obtener tus credenciales de Supabase

1. **Ve a tu proyecto en Supabase**: https://supabase.com/dashboard

2. **Ir a Settings** → **API**

3. **Copiar los valores**:
   - **Project URL** → Pegar en `VITE_SUPABASE_URL`
   - **anon public** → Pegar en `VITE_SUPABASE_ANON_KEY`

### Paso 4: Generar API_KEY_ENCRYPTION_SECRET

Ejecuta en tu terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia el resultado (64 caracteres) y pégalo en `API_KEY_ENCRYPTION_SECRET`

### Paso 5: Reiniciar el servidor

```bash
# Detener el servidor (Ctrl+C)
# Luego reiniciar:
npm run dev
```

---

## 📋 Ejemplo Completo de `.env`

```bash
# Supabase
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxxxxxxxxxxxxxxxxx...

# Encriptación
API_KEY_ENCRYPTION_SECRET=1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4
```

---

## ⚠️ IMPORTANTE

### ¿No tienes un proyecto en Supabase?

1. **Crear cuenta gratis**: https://supabase.com
2. **Crear nuevo proyecto**:
   - Name: `FahrtenbuchPro`
   - Database Password: (guarda esto)
   - Region: Elige la más cercana
3. **Esperar 2-3 minutos** a que se cree el proyecto
4. **Ir a Settings → API** para obtener las credenciales

### Si ya tienes un proyecto pero olvidaste la configuración:

1. Ve a tu dashboard de Supabase
2. Settings → API
3. Copia las credenciales de nuevo

---

## 🧪 Verificar que Funciona

Después de configurar `.env` y reiniciar el servidor:

1. **Abrir** http://localhost:5178 (o el puerto que use)
2. **NO debe** haber errores de "AuthApiError"
3. **Debe cargar** la página de login/registro
4. **Debe funcionar** el login/registro

---

## 🆘 Si Sigue Sin Funcionar

### Error: "Supabase URL not configured"

**Causa**: Las variables no se están leyendo

**Solución**:
```bash
# Verificar que el archivo .env existe en la raíz
ls -la | grep .env

# Reiniciar el servidor completamente
npm run dev
```

### Error: "Invalid API Key"

**Causa**: La `VITE_SUPABASE_ANON_KEY` está mal copiada

**Solución**:
- Ve a Supabase Dashboard → Settings → API
- Copia de nuevo la "anon public" key
- Asegúrate de copiar TODO (empieza con `eyJ...`)

### Error: "Failed to load resource: 400"

**Causa**: URL o key incorrectas

**Solución**:
- Verifica que `VITE_SUPABASE_URL` termina con `.supabase.co`
- Verifica que `VITE_SUPABASE_ANON_KEY` empieza con `eyJ`
- NO debe haber espacios al inicio o final

---

## 📝 Checklist Rápido

- [ ] Archivo `.env` existe en la raíz del proyecto
- [ ] `VITE_SUPABASE_URL` tiene tu URL de Supabase
- [ ] `VITE_SUPABASE_ANON_KEY` tiene tu anon key
- [ ] `API_KEY_ENCRYPTION_SECRET` tiene 64 caracteres
- [ ] Servidor reiniciado después de crear `.env`
- [ ] Browser recargado (F5)

---

## 🎯 Resultado Esperado

**ANTES** (con errores):
```
❌ AuthApiError: Invalid Refresh Token
❌ Failed to load resource: 400
❌ Página de login no funciona
```

**DESPUÉS** (funcionando):
```
✅ Sin errores en consola
✅ Página de login carga correctamente
✅ Puedes registrarte
✅ Puedes iniciar sesión
```

---

## 💡 Tip Pro

Añade `.env` a tu `.gitignore` para no commitear tus credenciales:

```bash
echo ".env" >> .gitignore
```

---

**Tiempo estimado**: 2-3 minutos

**Dificultad**: ⭐☆☆☆☆ (Muy fácil)
