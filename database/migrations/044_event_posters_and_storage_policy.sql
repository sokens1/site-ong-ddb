-- ==============================================================================
-- MIGRATION 044: Stockage et gestion des affiches "J'y serai"
-- Permet l'enregistrement des visuels générés par les participants
-- ==============================================================================

-- 1. Table dédiée pour indexer tous les visuels générés
CREATE TABLE IF NOT EXISTS public.event_posters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL,
  participant_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour des requêtes ultra-rapides par événement
CREATE INDEX IF NOT EXISTS idx_event_posters_event_id ON public.event_posters(event_id);
CREATE INDEX IF NOT EXISTS idx_event_posters_created_at ON public.event_posters(created_at DESC);

-- Activer RLS
ALTER TABLE public.event_posters ENABLE ROW LEVEL SECURITY;

-- Politiques RLS sur event_posters
DROP POLICY IF EXISTS "Allow public select on event_posters" ON public.event_posters;
CREATE POLICY "Allow public select on event_posters" ON public.event_posters
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow public insert on event_posters" ON public.event_posters;
CREATE POLICY "Allow public insert on event_posters" ON public.event_posters
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete on event_posters" ON public.event_posters;
CREATE POLICY "Allow authenticated delete on event_posters" ON public.event_posters
  FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- 2. Politiques Supabase Storage pour le bucket ong-backend
-- Permettre aux visiteurs anonymes d'uploader leurs affiches dans /posters/
-- ==============================================================================

-- Autoriser l'upload public uniquement dans le dossier posters/
DROP POLICY IF EXISTS "Allow public upload posters to ong-backend" ON storage.objects;
CREATE POLICY "Allow public upload posters to ong-backend"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'ong-backend' AND (storage.foldername(name))[1] = 'posters'
);

-- Autoriser la lecture publique de tout le bucket ong-backend
DROP POLICY IF EXISTS "Allow public read from ong-backend" ON storage.objects;
CREATE POLICY "Allow public read from ong-backend"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'ong-backend');

-- Autoriser la suppression pour les administrateurs
DROP POLICY IF EXISTS "Allow authenticated delete from ong-backend" ON storage.objects;
CREATE POLICY "Allow authenticated delete from ong-backend"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'ong-backend');
