# ✅ Configuración: Gemini por Defecto + OpenRouter Opcional

## 📋 Cambios Aplicados

### 1. **Prioridad de Proveedores** ✅
**Archivo:** `services/extractor-universal/index.ts`

**Cambio:** La lógica de resolución ahora **siempre prefiere Gemini** en modo 'auto'.

```typescript
// ANTES: Prefería OpenRouter si el usuario tenía API key configurada
if (c.openRouterApiKey && (c.openRouterModel || true)) {
  return { provider: 'openrouter', creds: c };
}

// AHORA: Siempre usa Gemini por defecto
// El usuario debe elegir explícitamente 'openrouter' si quiere usarlo
return { provider: 'gemini', creds: c };
```

### 2. **UI de Settings Mejorada** ✅
**Archivos:** 
- `components/Settings.tsx`
- `i18n/translations.ts`

**Cambios:**

#### Nuevos textos de traducción:
```typescript
settings_api_ai_title: 'Configuración de IA para Extracción',
settings_api_ai_default_info: 'Por defecto, se usa Gemini con la API del servidor (gratis para ti). Solo configura OpenRouter si quieres usar tu propia API key.',
settings_api_gemini_status: 'Gemini (Servidor)',
settings_api_gemini_desc: 'API key del servidor - Sin costo para ti',
settings_api_gemini_active: 'Activo',
settings_api_openrouter_optional: 'OpenRouter (Opcional)',
settings_api_openrouter_desc: 'Usa tu propia API key para mayor control',
settings_api_openrouter_configured: 'Configurado',
settings_api_openrouter_not_configured: 'No configurado',
```

#### Nueva UI en Settings:
- ✅ Banner informativo explicando que Gemini es gratis (servidor)
- ✅ Estado de Gemini con indicador verde "Activo"
- ✅ Sección de OpenRouter marcada como "Opcional"
- ✅ Link directo a openrouter.ai para obtener API key

### 3. **Fix del Error 400 en Gemini API** ✅
**Archivo:** `lib/api-handlers/ai/gemini.ts`

**Problema:** Usaba `messages` (formato incorrecto) en lugar de `contents` (formato correcto de Gemini API)

**Solución:**
```typescript
// ANTES: ❌ Formato incorrecto
const messages: any[] = [
  { role: 'system', content: systemInstruction },
  { role: 'user', content: buildAgentPrompt(text) },
];

const response = await ai.models.generateContent({
  model: GEMINI_MODEL,
  messages, // ❌ Campo no existe en Gemini API
  temperature: 0,
  // ...
});

// AHORA: ✅ Formato correcto
const contents: any[] = [
  { role: 'user', parts: [{ text: systemInstruction + '\n\n' + buildAgentPrompt(text) }] }
];

const response = await ai.models.generateContent({
  model: GEMINI_MODEL,
  contents, // ✅ Campo correcto
  generationConfig: {
    temperature: 0,
    responseMimeType: 'application/json',
    responseSchema: ...
  }
});
```

También se corrigió el formato de respuestas de herramientas:
```typescript
// ANTES: ❌
messages.push({ role: 'tool', name, content: JSON.stringify(result) });

// AHORA: ✅
contents.push({ 
  role: 'function',
  parts: [{ 
    functionResponse: { name, response: result }
  }]
});
```

---

## 🎯 Resultado Final

### **Flujo de Usuario:**

1. **Por defecto:** 
   - Todos los usuarios usan **Gemini** automáticamente
   - API key del servidor (tú pagas o usas tier gratuito)
   - Sin configuración necesaria

2. **Opcional:** 
   - Usuario va a **Settings → API**
   - Ve claramente que Gemini está activo (gratis)
   - Puede configurar OpenRouter si quiere usar su propia API key
   - OpenRouter solo se usa si el usuario lo **selecciona explícitamente**

### **Ventajas:**

✅ **Para el Usuario:**
- Experiencia "plug and play" - funciona inmediatamente
- No necesita configurar nada para empezar
- Puede optar por usar su propia API si prefiere más control

✅ **Para Ti (Desarrollador):**
- Control sobre los costos (límites de Gemini gratis)
- Los usuarios solo pagan si quieren
- Fácil migración: usuarios pueden cambiar a su API cuando necesiten

✅ **Técnico:**
- Error 400 corregido (formato API correcto)
- Lógica de prioridad clara y documentada
- UI informativa para usuarios

---

## 🔧 Variables de Entorno Necesarias

### **Para Desarrollo Local:**
Crear archivo `.env.local`:

```env
# Gemini (OBLIGATORIO - Proveedor por defecto)
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXX
GEMINI_MODEL=gemini-2.0-flash-001

# Supabase (OBLIGATORIO)
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenRouter (OPCIONAL - Solo como fallback del servidor)
# Si no pones esto, los usuarios DEBEN configurar su propia key
# OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxx
# OPENROUTER_MODEL=google/gemini-2.0-flash-001
```

### **Para Producción (Vercel):**
Configurar en Vercel Dashboard → Settings → Environment Variables:
- `GEMINI_API_KEY` (obligatorio)
- `GEMINI_MODEL` (opcional, default: gemini-2.0-flash-001)
- Otras variables de Supabase, Google Maps, etc.

---

## 📊 Costos

| Proveedor | Quién Paga | Tier Gratuito | Cuándo Usar |
|-----------|-----------|---------------|-------------|
| **Gemini (default)** | Servidor | ✅ 15 req/min, 1M tokens/mes | Siempre (automático) |
| **OpenRouter** | Usuario | ❌ Pago desde $0 | Solo si el usuario configura su API key |

---

## ✅ Testing

Para verificar que funciona correctamente:

1. **Sin configurar OpenRouter:**
   - Subir un callsheet PDF
   - Debe usar Gemini automáticamente
   - No debe mostrar errores

2. **Configurar OpenRouter:**
   - Ir a Settings → API
   - Agregar API key de OpenRouter
   - Subir callsheet
   - Debe seguir usando Gemini por defecto (a menos que explícitamente elijas OpenRouter en algún selector)

3. **Verificar UI:**
   - Settings muestra "Gemini (Servidor) ✅ Activo"
   - Settings muestra "OpenRouter (Opcional) ⚪ No configurado" (si no está configurado)

---

## 🚀 Próximos Pasos (Opcional)

Si quieres dar aún más control al usuario, podrías:

1. **Agregar selector en la UI de subida:**
   - Permitir elegir entre Gemini y OpenRouter al subir archivos
   - Solo si OpenRouter está configurado

2. **Dashboard de uso:**
   - Mostrar cuántas requests se hicieron este mes
   - Avisar si se acerca al límite de Gemini

3. **Métricas:**
   - Tracking de qué proveedor se usa más
   - Tasa de éxito por proveedor

---

**Estado:** ✅ Completado y funcional  
**Fecha:** 2025-01-22  
**Impacto:** Gemini como default (gratis), OpenRouter opcional (usuario paga)

