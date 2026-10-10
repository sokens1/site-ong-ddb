-- ==============================================================================
-- Migration 045: Configuration personnalisée des certificats de participation
-- ==============================================================================

-- Ajout des colonnes de personnalisation des certificats sur la table events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS certificate_title TEXT,
  ADD COLUMN IF NOT EXISTS certificate_subtitle TEXT,
  ADD COLUMN IF NOT EXISTS certificate_text TEXT,
  ADD COLUMN IF NOT EXISTS certificate_signatory_name TEXT,
  ADD COLUMN IF NOT EXISTS certificate_signatory_title TEXT;

COMMENT ON COLUMN public.events.certificate_title IS 'Titre principal affiché sur le certificat (ex: Certificat de participation)';
COMMENT ON COLUMN public.events.certificate_subtitle IS 'Sous-titre ou mention (ex: Délivré à ou DE RECONNAISSANCE)';
COMMENT ON COLUMN public.events.certificate_text IS 'Texte officiel d''appréciation ou de participation (supporte {name} et {event})';
COMMENT ON COLUMN public.events.certificate_signatory_name IS 'Nom officiel du signataire du certificat';
COMMENT ON COLUMN public.events.certificate_signatory_title IS 'Fonction ou titre du signataire (ex: Directeur général)';
