# Test de Extracción - Guía de Verificación v2

## 🔥 CAMBIO CRÍTICO AGREGADO

### ✅ Post-Procesamiento Inteligente
He agregado **filtrado automático** en `postProcess.ts` que elimina ubicaciones inválidas DESPUÉS de la extracción de IA.

**Nuevo archivo modificado:**
- ✅ `services/extractor-universal/postProcess.ts` - **Filtrado inteligente automático**

### 🎯 Filtros Aplicados Automáticamente:

#### ❌ **ELIMINA Ubicaciones con Keywords de Logística:**
- basis, parken, parking, aufenthalt, kostüm, costume
- maske, makeup, hair, lunch, catering, team, technik
- office, meeting, transport, pick up, driver, car
- wardrobe, load, unload, crew parking, unit base

#### ❌ **ELIMINA Nombres de Habitaciones/Lugares Internos:**
- Que empiecen con: suite, salon, keller, empfang, studio, villa, raum, room, floor, etage
- Que empiecen con: bereich, area, zona, zone
- Números de piso sin dirección: "3. Etage", "2nd Floor"

#### ❌ **ELIMINA Ubicaciones Incompletas:**
- Sin números (sin número de calle ni código postal)
- Una sola palabra sin contexto
- Menos de 5 caracteres

#### ✅ **ACEPTA Solo Direcciones Completas:**
- Con coma: "Salmgasse 10, 1030 Wien"
- Con código postal: "Salmgasse 10 1030 Wien"
- Con nombre de ciudad: "Salmgasse 10, Wien"

## 🧪 Ejemplo de Filtrado Automático

**Input de IA (puede contener basura):**
```json
{
  "locations": [
    "Palais Rasumofsky, 23-25, 1030 Wien",
    "Suite Nico",
    "Salmgasse 10, 1030 Wien",
    "Keller",
    "Salmgasse 19, 1030 Wien - Basis & Parken",
    "Catering Bereich",
    "Villa Dardenne",
    "Salmgasse 6, 1030 Wien"
  ]
}
```

**Output Después del Post-Procesamiento:**
```json
{
  "locations": [
    "Palais Rasumofsky, 23-25, 1030 Wien",
    "Salmgasse 10, 1030 Wien",
    "Salmgasse 6, 1030 Wien"
  ]
}
```

**Filtrados automáticamente:**
- ❌ "Suite Nico" → Nombre de habitación (patrón: ^suite)
- ❌ "Keller" → Una palabra, sin números, incompleto
- ❌ "Salmgasse 19... Basis & Parken" → Contiene keyword "parken"
- ❌ "Catering Bereich" → Contiene keywords "catering" y "bereich"
- ❌ "Villa Dardenne" → Una/dos palabras, sin números, incompleto

## 📊 Logs en Consola

Ahora verás logs como:
```
[PostProcess] Filtered out invalid location: "Suite Nico"
[PostProcess] Filtered out invalid location: "Keller"
[PostProcess] Filtered out invalid location: "Catering Bereich"
[PostProcess] Final locations count: 3 ["Palais...", "Salmgasse 10...", "Salmgasse 6..."]
```

## 🧪 Cómo Probar

1. **Recarga la aplicación** (Ctrl + Shift + R)
2. **Sube un callsheet** en Carga Masiva o Proyecto
3. **Abre la consola** del navegador (F12)
4. **Busca los logs** `[PostProcess]` para ver qué se filtró
5. **Verifica el resultado** - Solo deben aparecer direcciones completas

## ✅ Doble Capa de Protección

Ahora tienes **DOS capas** de filtrado:

1. **Prompts Mejorados** → Le dice a la IA qué extraer
2. **Post-Procesamiento** → Filtra automáticamente cualquier basura que la IA haya extraído

**Incluso si la IA se equivoca, el post-procesamiento lo corrige!**

## 🚀 Servidores Activos

- ✅ Vite Dev Server: http://localhost:5173
- ✅ API Dev Server: http://localhost:3000
- ✅ Post-procesamiento activo y funcionando

## 🔧 Si Aún Hay Problemas

Si TODAVÍA extrae ubicaciones inválidas:

1. **Copia el resultado** exacto que estás viendo
2. **Revisa los logs** de `[PostProcess]` en la consola
3. **Verifica** que los logs muestren el filtrado
4. **Si una ubicación incorrecta pasa el filtro**, dime cuál es para agregar más reglas

La mayoría de ubicaciones incorrectas ahora deberían ser eliminadas automáticamente.

