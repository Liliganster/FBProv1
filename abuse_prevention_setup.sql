-- =====================================================
-- SETUP PARA PREVENCIÓN DE ABUSO (ABUSE PREVENTION)
-- =====================================================
-- Este script crea la tabla para registrar huellas digitales
-- e IPs de usuarios que abusan del sistema (borrar cuenta
-- tras usar cuota gratis).
-- =====================================================

-- 1. Crear la tabla abuse_prevention_log
CREATE TABLE IF NOT EXISTS public.abuse_prevention_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier_hash TEXT NOT NULL, -- Hash de la IP o Fingerprint
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('ip', 'fingerprint', 'email_hash')),
  banned BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb, -- Para guardar info extra (user_agent, fecha original, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_abuse_log_hash 
  ON public.abuse_prevention_log(identifier_hash);

-- 3. Habilitar RLS
ALTER TABLE public.abuse_prevention_log ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS (MUY RESTRICTIVAS)
-- Nadie puede ver ni insertar desde el cliente (anon/authenticated).
-- Solo el 'service_role' (backend) puede gestionar esta tabla.

-- Denegar todo acceso público
CREATE POLICY "No public access"
  ON public.abuse_prevention_log
  FOR ALL
  TO public
  USING (false);

-- (Opcional) Si quisieras que el service_role tenga acceso explícito,
-- Supabase ya lo permite por defecto (bypass RLS).
-- Pero para mayor seguridad, aseguramos que nadie más entre.

-- =====================================================
-- FIN DEL SETUP
-- =====================================================
