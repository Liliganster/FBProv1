# 🚀 Desplegar Correcciones a Vercel

## Cambios Realizados

### 1. ⏱️ Aumentar Timeout de Vercel
**Archivo**: `vercel.json`
- ✅ `maxDuration`: 30s → 60s (máximo para hobby plan)
- ✅ `memory`: Aumentado a 1024MB para callsheets grandes

**Razón**: Los callsheets grandes (27KB+) tardan más de 30s en procesarse con OpenRouter

### 2. 📝 Mejorar Logging en Producción
**Archivo**: `api/proxy.ts`
- ✅ Logs detallados en `handleOpenRouterStructured()`
- ✅ Logs en `handleOpenRouterChat()`
- ✅ Logs en `handleOpenRouterModels()`
- ✅ Medición de tiempo de respuesta
- ✅ Mejor manejo de errores con stack traces

**Razón**: Poder diagnosticar exactamente dónde falla en producción

### 3. 🎯 Prompts Mejorados
**Ya implementado anteriormente**:
- ✅ Reglas estrictas para ignorar logística
- ✅ Filtrado ultra-estricto en `postProcess.ts`
- ✅ 30+ keywords de logística bloqueadas

---

## 📤 Desplegar a Vercel

### Opción 1: Git Push (Recomendado)

```bash
# 1. Confirmar todos los cambios
git add .
git commit -m "fix: increase Vercel timeout to 60s and improve logging"

# 2. Push a GitHub
git push origin main

# 3. Vercel detectará automáticamente el push y desplegará
```

### Opción 2: Vercel CLI

```bash
# 1. Instalar Vercel CLI (si no lo tienes)
npm i -g vercel

# 2. Login a Vercel
vercel login

# 3. Deploy
vercel --prod
```

---

## 🔍 Verificar el Despliegue

### 1. Ver Logs en Tiempo Real
1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto `FBProv1`
3. Click en "Deployments"
4. Click en el deployment más reciente
5. Click en "Functions" → `api/proxy.ts` → "Logs"

### 2. Buscar en los Logs
Deberías ver estos logs cuando subes un callsheet:

```
[OpenRouter Structured] Processing request: { textLength: 27162, useCrewFirst: false, model: 'default' }
[OpenRouter Structured] Sending request to OpenRouter API...
[OpenRouter Structured] Response received in 15234ms, status: 200
[OpenRouter Structured] Successfully parsed response
```

### 3. Si Hay Errores
Los logs mostrarán exactamente dónde falló:

```
[OpenRouter Structured] Failed to read body: <error>
[OpenRouter Structured] Missing text field in body
[OpenRouter Structured] API error: { status: 500, detail: '...' }
[OpenRouter Structured] Error: { message: '...', stack: '...' }
```

---

## 🧪 Probar Después del Despliegue

1. **Espera 2-3 minutos** después del push para que Vercel termine de desplegar
2. **Abre tu app en producción**: https://tu-dominio.vercel.app
3. **Limpia caché**: `Ctrl + Shift + R`
4. **Abre consola**: `F12`
5. **Sube un callsheet** en carga masiva
6. **Revisa consola del navegador** - ya NO debería haber errores 500
7. **Revisa logs de Vercel** para ver el procesamiento

---

## ❌ Si Aún Falla

### Posibles Causas:

#### 1. API Key de OpenRouter Inválida
**Solución**:
- Ve a Vercel Dashboard → Settings → Environment Variables
- Verifica que `OPENROUTER_API_KEY` esté configurada
- Prueba la key en https://openrouter.ai/

#### 2. Timeout de 60s No Es Suficiente
**Solución**:
- Considera usar un modelo más rápido (ej: `google/gemini-flash-1.5`)
- O cambiar a plan Pro de Vercel (300s timeout)

#### 3. Payload Demasiado Grande
**Síntomas**: Error 413 o "Payload too large"
**Solución**:
- Vercel tiene límite de 4.5MB para body size
- Si el PDF es muy grande, considera comprimirlo antes de enviar

#### 4. Rate Limiting
**Síntomas**: Error 429 "Too Many Requests"
**Solución**:
- Espera 60 segundos entre requests
- O ajusta los límites en `api/proxy.ts` (RateLimiter)

---

## 📊 Monitoreo Post-Despliegue

### Logs Clave a Buscar:

✅ **Éxito**:
```
[OpenRouter Structured] Successfully parsed response
[PostProcess] ✅ Valid address: 'Salmgasse 10, 1030 Wien'
[PostProcess] Processed 15 locations, 3 valid after filtering
```

❌ **Falla**:
```
[OpenRouter Structured] API error: { status: 500, detail: '...' }
[OpenRouter Structured] Error: { message: 'timeout', ... }
```

---

## 📝 Checklist Final

- [ ] Push a GitHub completado
- [ ] Vercel deployment exitoso (ver dashboard)
- [ ] Logs de Vercel muestran nueva versión
- [ ] Probado en producción con callsheet real
- [ ] No hay errores 500 en consola
- [ ] Locations se extraen correctamente
- [ ] Filtrado ultra-estricto funcionando

---

## 🆘 Soporte

Si después de desplegar sigues viendo errores:

1. **Copia los logs de Vercel** (pestaña "Functions" → "Logs")
2. **Copia los errores de consola del navegador** (F12)
3. **Describe qué archivo subiste** (nombre, tamaño)
4. **Dame ambos logs** para diagnosticar

---

## ⚡ Despliegue Rápido (Un Solo Comando)

```bash
git add . && git commit -m "fix: increase timeout and improve logging" && git push origin main
```

Vercel detectará el push automáticamente y desplegará en ~2 minutos.
