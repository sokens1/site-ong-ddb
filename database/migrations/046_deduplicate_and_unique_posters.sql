-- ==============================================================================
-- Migration 046: Déduplication et garantie d'un seul visuel par participant
-- ==============================================================================

-- 1. Nettoyage des doublons existants dans la table event_posters
-- On conserve uniquement l'affiche la plus récente par participant pour chaque événement
DELETE FROM public.event_posters
WHERE id NOT IN (
  SELECT DISTINCT ON (event_id, LOWER(TRIM(participant_name))) id
  FROM public.event_posters
  ORDER BY event_id, LOWER(TRIM(participant_name)), created_at DESC
);

-- 2. Création d'un index d'unicité pour empêcher physiquement les doublons par participant
DROP INDEX IF EXISTS idx_event_posters_event_participant_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_posters_event_participant_unique
  ON public.event_posters(event_id, LOWER(TRIM(participant_name)));

-- 3. Autoriser les requêtes UPDATE pour les visiteurs publics (RLS)
-- Indispensable pour permettre l'écrasement/mise à jour de l'affiche existante
DROP POLICY IF EXISTS "Allow public update on event_posters" ON public.event_posters;
CREATE POLICY "Allow public update on event_posters" ON public.event_posters
  FOR UPDATE TO public USING (true) WITH CHECK (true);
