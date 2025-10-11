# 📍 Dónde Están los Botones de Facturas

## ⚠️ IMPORTANTE: Refresca el Navegador
**Después de compilar, debes refrescar la página (F5 o Ctrl+R)** para ver los cambios.

---

## 🔴 **1. ANÁLISIS DE COSTES** ✅ (Ya funciona)

### Ubicación:
```
Dashboard → Avanzado → Análisis de Costes
```

### Botón:
- **Ubicación:** Arriba a la derecha, al lado del selector de rango de fechas
- **Texto:** "Upload Invoice" o "Subir Factura"
- **Icono:** Nube con flecha hacia arriba
- **Color:** Azul (brand-primary)

### Qué hace:
- Abre modal para subir factura
- Permite seleccionar categoría (fuel/maintenance)
- Si tienes un proyecto seleccionado en el filtro, lo asocia automáticamente

---

## 🟢 **2. DETALLE DE VIAJE** ✅ (Implementado)

### Cómo llegar:
```
Dashboard → Ver viajes → Click en cualquier viaje
```

### Botón:
- **Ubicación:** Panel derecho, sección "Fuel & maintenance invoices"
- **Texto:** "Attach" o "Adjuntar"
- **Icono:** Nube con flecha hacia arriba (pequeño)
- **Color:** Azul (brand-primary)
- **Tamaño:** Pequeño (text-xs)

### Qué muestra:
- **Total documentado:** Suma de todas las facturas del viaje
- **Lista de facturas:** Cada factura con:
  - Categoría (combustible/mantenimiento)
  - Monto
  - Fecha de factura
  - Descripción
  - Botón para ver PDF
  - Botón para eliminar (icono de basura)

### Qué hace el modal:
- Pre-rellena `tripId` automáticamente
- Pre-rellena `projectId` si el viaje pertenece a un proyecto
- Después de subir, la factura aparece instantáneamente en la lista

---

## 🟡 **3. DETALLE DE PROYECTO** ✅ (Implementado)

### Cómo llegar:
```
Dashboard → Proyectos → Click en cualquier proyecto
```

### Botón:
- **Ubicación:** Sección "Project Invoices" o "Facturas del Proyecto"
- **Texto:** "Attach invoice" o "Adjuntar factura"
- **Icono:** Nube con flecha hacia arriba
- **Color:** Azul (brand-primary)

### Qué muestra:
- **Total documentado:** Suma de todas las facturas del proyecto
- **Lista de facturas:** Divididas en dos grupos:
  1. **Facturas del proyecto:** No asociadas a viajes específicos
  2. **Facturas de viajes:** Agrupadas por viaje

### Cada factura muestra:
- Categoría (combustible/mantenimiento)
- Monto y moneda
- Fecha de factura
- Descripción
- Enlace al viaje (si está asociada)
- Botón para ver el documento
- Botón para eliminar

### Qué hace el modal:
- Pre-rellena `projectId` automáticamente
- Puedes elegir asociarla a un viaje específico o dejarlo general
- Después de subir, aparece en la lista correspondiente

---

## 🔍 **Cómo Verificar que Funciona**

### ✅ Checklist:

1. **Refresca el navegador** (F5)
   - URL debería ser: `http://localhost:5176`

2. **Abre un viaje cualquiera:**
   - ¿Ves la sección "Fuel & maintenance invoices"?
   - ¿Ves el botón "Attach" pequeño a la derecha?

3. **Abre un proyecto cualquiera:**
   - ¿Ves la sección de facturas?
   - ¿Ves el botón "Attach invoice"?

4. **Ve a Análisis de Costes:**
   - ¿Ves el botón "Upload Invoice" arriba a la derecha?

---

## 🐛 **Si No Ves los Botones**

### Opción 1: Refresco Completo
```
Ctrl + Shift + R  (Windows/Linux)
Cmd + Shift + R   (Mac)
```
Esto limpia el caché y recarga completamente.

### Opción 2: Reiniciar Servidor
1. En la terminal donde corre `npm run dev`
2. Presiona `Ctrl+C` para detenerlo
3. Ejecuta de nuevo: `npm run dev`
4. Espera a que diga "ready"
5. Refresca el navegador

### Opción 3: Verificar Puerto
El servidor ahora corre en: `http://localhost:5176`
¿Estás accediendo a ese puerto en el navegador?

---

## 📊 **Dónde Ver las Facturas Guardadas**

### En el Viaje:
```
Abre el viaje → Panel derecho → Sección "Fuel & maintenance invoices"
```
Verás:
- Total documentado
- Lista completa de facturas
- Cada factura con su info y botones

### En el Proyecto:
```
Abre el proyecto → Sección de facturas
```
Verás:
- Total documentado del proyecto
- Facturas directas del proyecto
- Facturas de cada viaje del proyecto

### En Análisis de Costes:
Las facturas NO se muestran como lista aquí, pero **SÍ se calculan automáticamente**:
- El "Total Cost" incluye las facturas reales
- Si hay facturas de fuel, reemplazan el estimado
- Si hay facturas de maintenance, reemplazan el costo base

---

## 💡 **Consejo**

**Para probar rápido:**
1. Sube una factura desde Análisis de Costes
2. Ve a la lista de viajes
3. Abre el viaje al que se asoció
4. ¡Deberías ver la factura en la lista!

Si tienes un proyecto seleccionado en el filtro del Análisis de Costes, la factura se asociará automáticamente a ese proyecto.

---

¿Sigues sin ver los botones después de refrescar? Avísame y revisamos los logs del navegador.
