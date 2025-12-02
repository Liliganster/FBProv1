# Fix: Toggle Mapa/Documento en Viajes desde Carga Masiva

## Problema
Los documentos subidos mediante carga masiva (AI Extraction) se guardaban en proyectos pero NO se asociaban a los viajes individuales, por lo que el toggle mapa/documento no aparecía en TripDetailModal.

## Archivos Modificados

### 1. `types.ts` ✅
Agregado campo `url` a `CallsheetFile`:
```typescript
export interface CallsheetFile {
  id: string;
  name: string;
  type: string;
  url?: string;  // ← NUEVO
}
```

### 2. `services/databaseService.ts` ✅
Modificado `addCallsheetsToProject` para retornar también la URL:
```typescript
return (data || []).map((d: any, index: number) => ({ 
  id: d.id, 
  name: d.filename ?? d.name, 
  type: uploadResults[index].fileType || 'application/octet-stream',
  url: d.url || ''  // ← NUEVO
}))
```

### 3. `context/ProjectsContext.tsx` ✅
- Agregado import de `CallsheetFile`
- Modificado `addCallsheetsToProject` para retornar `Promise<CallsheetFile[]>` en vez de `Promise<void>`
- Agregado `return callsheets` al final de la función
- Cambiado `catch` para hacer `throw error` en vez de solo loggear

```typescript
const addCallsheetsToProject = useCallback(async (projectId: string, files: File[]): Promise<CallsheetFile[]> => {
  try {
    const callsheets = await databaseService.addCallsheetsToProject(projectId, files)
    // ... código de actualización ...
    return callsheets  // ← NUEVO
  } catch (error) {
    // ... manejo de error ...
    throw error  // ← NUEVO
  }
}, [state.projects, showToast])
```

### 4. `components/BulkUploadModal.tsx` ✅
Modificado `handleConfirmSave` para:

#### A. Mantener índice de trips con sus archivos
```typescript
const filesByProject: Record<string, { file: File, tripIndex: number }[]> = {};
updatedDrafts.forEach((trip, index) => {
  if (trip.projectId && trip.sourceFile) {
    if (!filesByProject[trip.projectId]) filesByProject[trip.projectId] = [];
    filesByProject[trip.projectId].push({ file: trip.sourceFile, tripIndex: index });
  }
});
```

#### B. Capturar callsheets subidos y mapearlos a trips
```typescript
const tripCallsheetMap = new Map<number, { id: string, name: string, url: string }>();

for (const [projectId, fileData] of Object.entries(filesByProject)) {
  const files = fileData.map(fd => fd.file);
  const uploadedCallsheets = await addCallsheetsToProject(projectId, files);
  
  fileData.forEach((fd, index) => {
    const callsheet = uploadedCallsheets[index];
    if (callsheet && callsheet.url) {
      tripCallsheetMap.set(fd.tripIndex, {
        id: callsheet.id,
        name: callsheet.name,
        url: callsheet.url
      });
    }
  });
}
```

#### C. Agregar campos de documento a los trips
```typescript
const sanitizedDrafts = updatedDrafts.map(({ sourceFile, ...rest }, index) => {
  const callsheetInfo = tripCallsheetMap.get(index);
  if (callsheetInfo) {
    return {
      ...rest,
      sourceDocumentId: callsheetInfo.id,
      sourceDocumentName: callsheetInfo.name,
      sourceDocumentUrl: callsheetInfo.url
    };
  }
  return rest;
});
```

### 5. `components/TripDetailModal.tsx` ✅
Movido toggle dentro del contenedor correcto y aumentado z-index a `z-50`.

## Flujo Completo

1. Usuario sube PDFs en BulkUploadModal (modo AI)
2. Se extraen los viajes del PDF
3. Al confirmar guardado:
   - Se suben los PDFs a Supabase Storage
   - Se crean registros en tabla `callsheets` con URLs públicas
   - Se retornan los callsheets con sus URLs
   - Se mapean a los trips correspondientes
   - Cada trip recibe:
     - `sourceDocumentId`
     - `sourceDocumentName`
     - `sourceDocumentUrl`
4. Los trips se guardan con esta información
5. En TripDetailModal:
   - Si existe `trip.sourceDocumentUrl` → Aparece toggle
   - Usuario puede cambiar entre mapa y documento
   - El iframe carga el PDF desde la URL pública

## Testing
1. Ir a vista de Proyectos
2. Subir un callsheet PDF
3. Procesar con AI para crear viaje
4. Abrir detalle del viaje
5. Verificar que aparece toggle mapa/documento
6. Verificar que se puede cambiar entre ambas vistas
7. Verificar que el documento se muestra correctamente

## Notas
- Los documentos se guardan tanto en proyectos como en trips individuales
- La URL es pública de Supabase Storage
- El toggle solo aparece si el viaje tiene `sourceDocumentUrl`
- El PDF se carga en un iframe desde Supabase

