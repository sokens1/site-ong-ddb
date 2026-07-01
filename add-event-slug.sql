-- Migration : ajout du slug personnalisé sur les événements
-- À exécuter dans Supabase > SQL Editor

-- 1. Activer l'extension unaccent (supprime les accents)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Ajouter la colonne slug (nullable pour compatibilité événements existants)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- 3. Contrainte d'unicité (ignore les NULL)
CREATE UNIQUE INDEX IF NOT EXISTS events_slug_unique
  ON public.events (slug)
  WHERE slug IS NOT NULL;

-- 4. Générer un slug pour les événements existants qui n'en ont pas
--    Format : titre-kebab-case + -id pour garantir l'unicité
UPDATE public.events
SET slug = (
  LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        unaccent(title),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    )
  ) || '-' || id
)
WHERE slug IS NULL;

-- 5. Passer slug en NOT NULL maintenant que tous ont une valeur
ALTER TABLE public.events
  ALTER COLUMN slug SET NOT NULL;

-- 6. Politique RLS : lecture publique du slug (déjà couverte par la policy SELECT existante)
-- Aucune policy supplémentaire nécessaire.
