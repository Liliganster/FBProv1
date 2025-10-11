-- =====================================================
-- SETUP PARA BUCKET DE FACTURAS/GASTOS (EXPENSES)
-- =====================================================
-- Este script crea el bucket de storage y las políticas
-- necesarias para que los usuarios puedan subir facturas
-- de combustible y mantenimiento.
--
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto de Supabase
-- 2. SQL Editor
-- 3. Copia y pega este script
-- 4. Ejecuta (Run)
-- =====================================================

-- 1. Crear el bucket 'expenses' si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('expenses', 'expenses', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas RLS para el bucket 'expenses'

-- Permitir a usuarios autenticados SUBIR archivos a su propia carpeta
CREATE POLICY "Users can upload expense documents to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'expenses'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir a usuarios autenticados VER sus propios archivos
CREATE POLICY "Users can view their own expense documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'expenses'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir a usuarios autenticados ELIMINAR sus propios archivos
CREATE POLICY "Users can delete their own expense documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'expenses'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Verificar que la tabla expense_documents existe
-- Si no existe, crearla:
CREATE TABLE IF NOT EXISTS public.expense_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  trip_id TEXT,
  category TEXT NOT NULL CHECK (category IN ('fuel', 'maintenance')),
  amount NUMERIC NOT NULL,
  currency TEXT,
  description TEXT,
  invoice_date DATE,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_expense_documents_user_id
  ON public.expense_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_documents_project_id
  ON public.expense_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_expense_documents_trip_id
  ON public.expense_documents(trip_id);
CREATE INDEX IF NOT EXISTS idx_expense_documents_category
  ON public.expense_documents(category);

-- 5. Políticas RLS para la tabla expense_documents
ALTER TABLE public.expense_documents ENABLE ROW LEVEL SECURITY;

-- Usuarios pueden ver solo sus propios gastos
CREATE POLICY "Users can view their own expense documents"
ON public.expense_documents
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Usuarios pueden insertar solo sus propios gastos
CREATE POLICY "Users can insert their own expense documents"
ON public.expense_documents
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Usuarios pueden actualizar solo sus propios gastos
CREATE POLICY "Users can update their own expense documents"
ON public.expense_documents
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Usuarios pueden eliminar solo sus propios gastos
CREATE POLICY "Users can delete their own expense documents"
ON public.expense_documents
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 6. Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_expense_documents_updated_at
BEFORE UPDATE ON public.expense_documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FIN DEL SETUP
-- =====================================================
-- Una vez ejecutado este script:
-- 1. Verifica en Storage > Buckets que existe 'expenses'
-- 2. Verifica en Database > Tables que existe 'expense_documents'
-- 3. Prueba subiendo una factura desde la app
-- =====================================================
