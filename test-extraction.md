# Test de Extracción - Guía de Verificación

## ✅ Cambios Implementados

### 1. Prompts Mejorados en TODOS los puntos de extracción:

#### Archivos Actualizados:
- ✅ `services/extractor-universal/prompts/callsheet.ts` - Prompt directo principal
- ✅ `lib/gemini/prompt.ts` - Prompts de Gemini (directo y agente)
- ✅ `services/extractor-universal/prompts/prompts.ts` - Prompts de agentes especializados
- ✅ `dev-server.mjs` - Prompts del servidor de desarrollo
- ✅ `api/proxy.ts` - Prompts del servidor de producción

### 2. Reglas Críticas Agregadas:

**EXTRAE SOLO:**
- ✅ Ubicaciones marcadas como "Drehort", "Location", "Set", "Motiv"
- ✅ Direcciones completas: Calle + Número + Código Postal/Ciudad
- ✅ Ejemplo: "Salmgasse 10, 1030 Wien", "Palais Rasumofsky, 23-25, 1030 Wien"

**IGNORA:**
- ❌ Logística: Basis, Parken, Aufenthalt, Kostüm, Maske, Lunch, Catering, Team, Technik
- ❌ Nombres de habitaciones: "Suite Nico", "Keller", "Salon", "Empfang", "Villa Dardenne"
- ❌ Descripciones sin dirección: "Catering Bereich", "Studio"

## 🧪 Cómo Probar

### Prueba 1: Carga Masiva (Bulk Upload)
1. Abre la app en http://localhost:5173
2. Ve a "Trips" → Click en el botón de carga masiva
3. Selecciona modo "AI Extraction"
4. Sube un PDF de callsheet
5. Click en "Process"

**Resultado Esperado:**
```json
{
  "date": "2025-10-15",
  "projectName": "Nombre del Proyecto",
  "locations": [
    "Palais Rasumofsky, 23-25, 1030 Wien",
    "Salmgasse 10, 1030 Wien"
  ]
}
```

**NO debería aparecer:**
- "Suite Nico"
- "Keller"  
- "Catering Bereich"
- "Villa Dardenne"

### Prueba 2: Extracción en Proyecto Individual
1. Ve a "Projects"
2. Abre un proyecto existente
3. Click en "Extract from File"
4. Sube un callsheet
5. Click en "Process"

**Verificar:**
- Solo direcciones completas
- Sin nombres de habitaciones
- Sin ubicaciones de logística

## 📊 Logs de Debugging

Abre la consola del navegador (F12) y verifica estos logs:

```
[BulkUpload] Starting AI extraction...
[ExtractorUniversal] Starting extraction...
[DirectParse] Starting parse with provider: openrouter
[DirectParse] OpenRouter result: { date, projectName, locations }
```

Si ves ubicaciones incorrectas en el resultado, el prompt no está siendo usado correctamente.

## 🔧 Troubleshooting

### Si sigue extrayendo nombres de habitaciones:

1. **Verifica que los servidores se reiniciaron:**
   ```powershell
   # Detener todo
   taskkill /F /IM node.exe
   
   # Reiniciar
   npm run dev
   node dev-server.mjs
   ```

2. **Limpia la caché del navegador:**
   - Ctrl + Shift + R (recarga forzada)
   - O abre en modo incógnito

3. **Verifica el modo de extracción:**
   - Asegúrate de usar "direct" mode (no "agent" por defecto)
   - O prueba ambos modos

4. **Revisa los logs del servidor:**
   - Terminal del dev-server debería mostrar requests entrantes
   - Busca `[dev-server] OpenRouter request:` en los logs

## 🎯 Ejemplo Completo de Extracción Correcta

**Input:** Callsheet con:
```
DREHORT 1:
Palais Rasumofsky, 23-25, 1030 Wien
Suite Nico (Interior)

DREHORT 2:
Salmgasse 10, 1030 Wien
Keller

BASIS & PARKEN:
Salmgasse 19, 1030 Wien

CATERING:
Catering Bereich, Salmgasse 6
```

**Output Esperado:**
```json
{
  "date": "2025-10-15",
  "projectName": "Mi Proyecto",
  "locations": [
    "Palais Rasumofsky, 23-25, 1030 Wien",
    "Salmgasse 10, 1030 Wien"
  ]
}
```

**Filtrados correctamente:**
- ❌ "Suite Nico" (nombre de habitación)
- ❌ "Keller" (nombre de habitación)
- ❌ "Salmgasse 19, 1030 Wien" (Basis & Parken = logística)
- ❌ "Catering Bereich" (nombre sin dirección completa + logística)

## ✅ Servidores Activos

- Vite Dev Server: http://localhost:5173
- API Dev Server: http://localhost:3000

Ambos servidores deben estar corriendo para que la extracción funcione.
