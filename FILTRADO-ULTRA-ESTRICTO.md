# 🔒 Filtrado Ultra-Estricto de Ubicaciones - ACTIVO

## ✅ Cambios Implementados

He actualizado `postProcess.ts` con **filtrado ultra-estricto** que ahora requiere múltiples criterios para aceptar una ubicación.

---

## 🎯 Criterios de Validación (TODOS deben cumplirse)

### ❌ Se Rechaza INMEDIATAMENTE si:

1. **Menos de 8 caracteres**
2. **No tiene números** (sin número de calle ni código postal)
3. **Menos de 2 palabras**
4. **Contiene keywords de logística**:
   - basis, base, parken, parking, aufenthalt, kostüm, maske
   - lunch, catering, team, technik, office, meeting, transport
   - pickup, driver, car, wardrobe, load, unload, holding
   - green room, production office, mobile, trailer, wohnwagen
   - treffpunkt, meeting point, hospital, krankenhaus, arzt
   - toiletten, toilets, wc, restroom, sanitär
   
5. **Empieza con patrones inválidos**:
   - `suite, salon, keller, empfang, studio, villa, raum, room`
   - `bereich, area, zona, zone`
   - `innen, außen, interior, exterior, int, ext`
   - `set, motiv, scene, szene` (sin dirección)
   - Números de piso: `3. Etage`, `2nd Floor`, `1. OG`

### ✅ Se Acepta SOLO si cumple UNO de estos:

**Opción A: Tiene coma**
- Ejemplo: `"Salmgasse 10, 1030 Wien"` ✅
- Ejemplo: `"Palais Rasumofsky, 23-25, 1030 Wien"` ✅

**Opción B: Tiene código postal (4-5 dígitos)**
- Ejemplo: `"Salmgasse 10 1030 Wien"` ✅
- Ejemplo: `"Main Street 100 12345 City"` ✅

**Opción C: Tiene nombre de ciudad conocida**
- Wien, Vienna, Berlin, München, Munich, Hamburg, Köln
- Madrid, Barcelona, Paris, London

### ✅ ADEMÁS debe tener palabras de calle:

Si NO tiene coma, DEBE tener una de estas palabras:
- **Alemán**: straße, strasse, str., gasse, weg, platz, allee
- **Inglés**: avenue, ave, road, rd, street, st., boulevard, blvd
- **Español**: calle, carrer

---

## 📊 Ejemplos con Logging Detallado

### ✅ Direcciones VÁLIDAS:

```
[PostProcess] ✅ Valid address: "Salmgasse 10, 1030 Wien"
  → Tiene: coma ✓, número ✓, palabra calle (gasse) ✓

[PostProcess] ✅ Valid address: "Palais Rasumofsky, 23-25, 1030 Wien"
  → Tiene: coma ✓, número ✓, código postal ✓

[PostProcess] ✅ Valid address: "Rustenschacherallee 9, 1020 Wien"
  → Tiene: coma ✓, número ✓, palabra calle (allee) ✓, código postal ✓
```

### ❌ Direcciones RECHAZADAS:

```
[PostProcess] ❌ Invalid pattern: "Suite Nico"
  → Empieza con "suite"

[PostProcess] ❌ No numbers: "Keller"
  → No tiene números

[PostProcess] ❌ Too few words (1): "Villa"
  → Solo 1 palabra

[PostProcess] ❌ Logistics keyword "catering": "Catering Bereich"
  → Contiene keyword prohibida

[PostProcess] ❌ Logistics keyword "parken": "Salmgasse 19 - Basis & Parken"
  → Contiene keyword prohibida

[PostProcess] ❌ No street word or comma: "Villa Dardenne"
  → No tiene coma ni palabra de calle

[PostProcess] ❌ No comma, postal code, or city: "Palais Something"
  → No cumple ningún criterio de formato
```

---

## 🧪 Cómo Verificar que Funciona

### 1. Recarga la aplicación
```
Ctrl + Shift + R en el navegador
```

### 2. Abre la consola del navegador
```
F12 → Pestaña Console
```

### 3. Sube un callsheet

### 4. Busca en la consola:
```
[PostProcess] ❌ ...  → Ubicaciones RECHAZADAS
[PostProcess] ✅ ...  → Ubicaciones ACEPTADAS
[PostProcess] Final locations count: X
```

---

## 🎯 Ejemplo Completo de Filtrado

**Input de IA (puede contener 20 ubicaciones):**
```json
{
  "locations": [
    "Palais Rasumofsky, 23-25, 1030 Wien",
    "Suite Nico",
    "Senfsiedlung, Neilreichgasse 113, 1100 Wien",
    "Villa Dardenne",
    "Keller",
    "Salmgasse 10, 1030 Wien",
    "Catering Bereich",
    "Basis & Parken - Salmgasse 19",
    "Salmgasse 6, 1030 Wien",
    "Production Office",
    "1. OG",
    "Holding Area",
    "Wohnwagen",
    "Set 3",
    "Innen",
    "Palais Rasumofsky, 25, 1030 Wien"
  ]
}
```

**Output después del filtrado ultra-estricto:**
```json
{
  "locations": [
    "Palais Rasumofsky, 23-25, 1030 Wien",
    "Senfsiedlung, Neilreichgasse 113, 1100 Wien",
    "Salmgasse 10, 1030 Wien",
    "Salmgasse 6, 1030 Wien",
    "Palais Rasumofsky, 25, 1030 Wien"
  ]
}
```

**Filtrados (con razón):**
- ❌ "Suite Nico" → Patrón inválido (^suite)
- ❌ "Villa Dardenne" → Sin coma, sin código postal, sin palabra calle
- ❌ "Keller" → Sin números, 1 palabra
- ❌ "Catering Bereich" → Keyword "catering" + patrón "bereich"
- ❌ "Basis & Parken..." → Keyword "basis" + "parken"
- ❌ "Production Office" → Keyword "office"
- ❌ "1. OG" → Patrón inválido (piso), muy corto
- ❌ "Holding Area" → Keyword "holding"
- ❌ "Wohnwagen" → Keyword "wohnwagen"
- ❌ "Set 3" → Patrón inválido (^set), muy corto
- ❌ "Innen" → Patrón inválido (^innen), muy corto

---

## 🚨 Si TODAVÍA pasa una ubicación incorrecta

**1. Copia el log exacto de la consola:**
```
[PostProcess] ✅ Valid address: "UBICACIÓN INCORRECTA AQUÍ"
```

**2. Dime qué ubicación pasó el filtro**

**3. Ajustaré las reglas para bloquearla**

---

## ✅ Servidores Activos con Filtrado Ultra-Estricto

- **Vite**: http://localhost:5173
- **API**: http://localhost:3000
- **Filtrado**: ULTRA-ESTRICTO (v3) ✅

---

## 📈 Estadísticas Esperadas

**Antes del filtrado:**
- Input típico: 10-20 ubicaciones

**Después del filtrado ultra-estricto:**
- Output típico: 2-5 ubicaciones VÁLIDAS

Si ves más de 5-7 ubicaciones en el resultado final, algo puede estar mal. Revisa los logs.
