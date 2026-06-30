-- ============================================================
-- MIGRATION COMPLÈTE - À EXÉCUTER DANS SUPABASE SQL EDITOR
-- ============================================================

-- 1. Colonne logo de l'événement
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Colonne multi-dates (tableau JSON)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_dates JSONB DEFAULT '[]'::jsonb;

-- 3. Colonne anti-double scan sur les inscriptions
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ;

-- 4. Vérification : ces colonnes doivent apparaître dans le résultat
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('events', 'event_registrations')
  AND column_name IN ('logo_url', 'event_dates', 'scanned_at')
ORDER BY table_name, column_name;
