-- Migration v6 : Support logos multiples par catégorie
-- À exécuter dans Supabase SQL Editor

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS organizer_logos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS partner_logos jsonb DEFAULT '[]'::jsonb;

-- Commentaire sur les colonnes
COMMENT ON COLUMN events.organizer_logos IS 'Tableau d''URLs des logos des organisateurs';
COMMENT ON COLUMN events.partner_logos IS 'Tableau d''URLs des logos des partenaires';
