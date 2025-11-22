# ✅ Configuración: Gemini 2.5 Flash

## 📋 Modelo Configurado

**Modelo:** `gemini-2.5-flash`  
**API:** Google AI Studio  
**Ubicación:** Definido en `lib/api-handlers/ai/gemini.ts`

---

## 🔧 Archivos Actualizados

### **1. Handler Principal de Gemini**
**Archivo:** `lib/api-handlers/ai/gemini.ts` (línea 21)

```typescript
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
```

Este es el archivo principal que maneja todas las llamadas a Gemini API desde:
- `lib/gemini/parser.ts` → `agenticParse()`
- Llamadas directas a `/api/ai/gemini`

### **2. Fallback de OpenRouter**
**Archivo:** `lib/api-handlers/ai/openrouter/structured.ts`

```typescript
const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
```

Cuando OpenRouter falla, usa Gemini como fallback.

---

## ⚙️ Variables de Entorno

### **Desarrollo Local** (`.env.local`)

```env
# API Key de Google AI Studio (OBLIGATORIO)
GEMINI_API_KEY=AIzaSy...tu_key_aqui

# Modelo (OPCIONAL - ya está en el código por defecto)
GEMINI_MODEL=gemini-2.5-flash

# Supabase (OBLIGATORIO)
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **Producción en Vercel**

Configurar en: **Vercel Dashboard → Settings → Environment Variables**

```env
GEMINI_API_KEY=AIzaSy...tu_key_aqui
GEMINI_MODEL=gemini-2.5-flash
```

Aplicar a: **Production, Preview, Development**

---

## 🚀 Deploy a Vercel

### **Paso 1: Commit y Push**

```bash
git add .
git commit -m "feat: Configure Gemini 2.5 Flash model"
git push
```

### **Paso 2: Verificar Variables en Vercel**

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Verifica que `GEMINI_API_KEY` esté configurada
4. (Opcional) Agrega `GEMINI_MODEL=gemini-2.5-flash`

### **Paso 3: Redeploy**

Vercel hará deploy automáticamente con el push, o puedes forzar redeploy:
- Deployments → (último deploy) → ... → Redeploy

---

## ✅ Verificación

### **En Desarrollo Local:**

Después de `npm run dev:full`, busca en los logs del terminal:

```
[Gemini Handler] Using model: gemini-2.5-flash
```

### **En Producción (Vercel):**

Verifica en los logs de Vercel (Runtime Logs):

```
[Gemini Handler] Using model: gemini-2.5-flash
```

---

## ⚠️ Importante: Disponibilidad del Modelo

**NOTA:** `gemini-2.5-flash` puede no estar disponible públicamente en Google AI Studio aún.

### **Si ves errores tipo:**
```
Error: Model 'gemini-2.5-flash' not found
```

**Opciones:**

1. **Verificar disponibilidad:** Ve a https://aistudio.google.com/ y verifica qué modelos están disponibles

2. **Usar modelo alternativo temporal:**
   ```env
   # En .env.local o Vercel
   GEMINI_MODEL=gemini-2.0-flash-exp
   ```

3. **Usar Gemini 1.5 Flash (estable):**
   ```env
   GEMINI_MODEL=gemini-1.5-flash-002
   ```

---

## 📊 Modelos Disponibles en AI Studio

| Modelo | Estado | Ventajas |
|--------|--------|----------|
| `gemini-2.5-flash` | ⚠️ Experimental/Beta | Más reciente, mejor rendimiento |
| `gemini-2.0-flash-exp` | ✅ Disponible | Rápido, experimental |
| `gemini-1.5-flash-002` | ✅ Estable | Confiable, probado |
| `gemini-1.5-pro-002` | ✅ Estable | Más preciso, más lento |

---

## 🔍 Troubleshooting

### **Error: "Empty response from Gemini"**

**Causas posibles:**

1. **Modelo no existe:** `gemini-2.5-flash` podría no estar disponible
   - **Solución:** Usar `gemini-2.0-flash-exp` o `gemini-1.5-flash-002`

2. **API Key inválida:** La key está expirada o mal configurada
   - **Solución:** Regenerar key en https://aistudio.google.com/app/apikey

3. **Contenido bloqueado:** El PDF tiene contenido que Gemini bloquea por seguridad
   - **Solución:** Verificar el contenido del PDF

4. **Cambios no desplegados:** El código local no está en Vercel
   - **Solución:** `git push` para deployar

### **Error: "Model not found"**

```bash
# Cambiar temporalmente el modelo
# En Vercel: Settings → Environment Variables
GEMINI_MODEL=gemini-2.0-flash-exp

# O en .env.local para desarrollo
GEMINI_MODEL=gemini-2.0-flash-exp
```

### **Verificar qué modelo se está usando:**

**Logs del servidor (development):**
```
[Gemini Handler] Using model: gemini-2.5-flash
```

**Logs de Vercel (production):**
1. Vercel Dashboard → Tu proyecto
2. Deployments → (último deploy)
3. Runtime Logs
4. Busca: `[Gemini Handler] Using model:`

---

## 📝 Flujo de Datos

```
Usuario sube PDF
    ↓
Frontend extrae texto
    ↓
lib/gemini/parser.ts → agenticParse()
    ↓
Llama a → /api/ai/gemini
    ↓
lib/api-handlers/ai/gemini.ts
    ↓
Usa GEMINI_MODEL = 'gemini-2.5-flash'
    ↓
Google AI Studio API
    ↓
Respuesta JSON estructurada
```

---

## ✅ Checklist de Configuración

- [x] Modelo configurado en `lib/api-handlers/ai/gemini.ts`
- [x] Fallback configurado en `lib/api-handlers/ai/openrouter/structured.ts`
- [ ] `GEMINI_API_KEY` en `.env.local` (desarrollo)
- [ ] `GEMINI_API_KEY` en Vercel (producción)
- [ ] `git push` para deployar cambios
- [ ] Verificar logs: `[Gemini Handler] Using model: gemini-2.5-flash`
- [ ] Probar extracción de callsheet

---

**Fecha:** 2025-01-22  
**Estado:** ✅ Configurado  
**Modelo:** `gemini-2.5-flash`  
**Próximo paso:** Deploy a Vercel y verificar funcionamiento

