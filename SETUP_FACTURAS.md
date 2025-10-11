# 🚀 Configuración de Facturas (Expenses)

## ⚠️ IMPORTANTE: Configuración Requerida

Para que la funcionalidad de facturas funcione, necesitas **ejecutar el script SQL en Supabase**.

---

## 📋 Pasos para Configurar

### 1️⃣ Ir a Supabase

1. Abre tu proyecto en [Supabase](https://supabase.com)
2. Ve a **SQL Editor** en el menú lateral izquierdo
3. Click en **New Query**

### 2️⃣ Ejecutar el Script

1. Abre el archivo `supabase_expenses_setup.sql` en este proyecto
2. **Copia TODO el contenido** del archivo
3. **Pégalo** en el SQL Editor de Supabase
4. Click en **Run** (o presiona Ctrl+Enter)

### 3️⃣ Verificar

Después de ejecutar el script, verifica que todo esté correcto:

#### ✅ Verificar el Bucket
1. Ve a **Storage** en Supabase
2. Deberías ver un bucket llamado `expenses`
3. Debe estar marcado como **Public**

#### ✅ Verificar la Tabla
1. Ve a **Database** → **Tables** en Supabase
2. Deberías ver una tabla llamada `expense_documents`
3. Verifica que tiene estas columnas:
   - id, user_id, project_id, trip_id
   - category, amount, currency, description
   - invoice_date, filename, url, storage_path
   - created_at, updated_at

---

## 🎯 ¿Qué Crea Este Script?

### 1. Bucket de Storage `expenses`
- Para almacenar los archivos PDF/imágenes de facturas
- Público para acceso directo a URLs
- Políticas RLS: cada usuario solo ve sus archivos

### 2. Tabla `expense_documents`
- Para almacenar metadatos de las facturas
- Relación con proyectos y viajes
- Categorías: `fuel` (combustible) y `maintenance` (mantenimiento)

### 3. Políticas de Seguridad (RLS)
- Los usuarios solo pueden:
  - Ver sus propias facturas
  - Subir facturas a su carpeta
  - Eliminar sus propias facturas

---

## 🧪 Probar la Funcionalidad

Una vez configurado Supabase, puedes probar subiendo facturas desde:

### 1. **Desde un Viaje**
   - Abre cualquier viaje
   - Ve a la sección "Fuel & maintenance invoices"
   - Click en el botón **"Attach"**

### 2. **Desde un Proyecto**
   - Abre cualquier proyecto
   - Ve a la sección de facturas
   - Click en el botón **"Attach invoice"**

### 3. **Desde Análisis de Costes**
   - Ve a **Avanzado** → **Análisis de Costes**
   - Click en el botón **"Upload Invoice"** en la parte superior derecha

---

## 🐛 Solución de Problemas

### Error: "Bucket not found" o "Storage error"
**Causa:** El bucket `expenses` no existe en Supabase
**Solución:** Ejecuta el script SQL `supabase_expenses_setup.sql`

### Error: "Permission denied" o "RLS policy violation"
**Causa:** Las políticas RLS no están configuradas
**Solución:** Ejecuta el script SQL completo nuevamente

### Las facturas no aparecen en Análisis de Costes
**Causa:** Las facturas no están asociadas a viajes/proyectos en el rango de fechas
**Solución:**
- Verifica el rango de fechas seleccionado (3m, 6m, 1y, all)
- Asegúrate de que las facturas tengan `invoice_date` configurada
- Verifica que estén asociadas a proyectos/viajes con trips en ese rango

---

## 📊 Cómo Funciona el Cálculo de Costes

### Sin Facturas
```
Costo Combustible = Distancia × Consumo × Precio
Costo Mantenimiento = Costo Base por Km
```

### Con Facturas
```
Costo Combustible = Suma de facturas de 'fuel'
Costo Mantenimiento = Suma de facturas de 'maintenance'
```

**Las facturas reales REEMPLAZAN las estimaciones** para mayor precisión.

---

## 📁 Estructura de Archivos

```
supabase/storage/expenses/
  └── {user_id}/
      ├── {project_id}/
      │   └── {timestamp}_{filename}
      ├── {trip_id}/
      │   └── {timestamp}_{filename}
      └── general/
          └── {timestamp}_{filename}
```

---

## ✅ Checklist Final

- [ ] Script SQL ejecutado en Supabase
- [ ] Bucket `expenses` visible en Storage
- [ ] Tabla `expense_documents` visible en Database
- [ ] Puedo subir una factura de prueba sin errores
- [ ] La factura aparece en el viaje/proyecto
- [ ] La factura se calcula en Análisis de Costes

---

¿Necesitas ayuda? Revisa los logs del navegador (F12 → Console) para más detalles del error.
