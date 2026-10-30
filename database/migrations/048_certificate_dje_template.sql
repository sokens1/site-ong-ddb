-- ==============================================================================
-- Migration 048 — Template DJE & signatures pour les certificats de participation
-- ==============================================================================
-- Ajoute les colonnes nécessaires au nouveau template élégant « DJE »
-- (guilloché, Cinzel, double cadre, sceau officiel, 2 signataires) ainsi que
-- les images de signature (optionnelles) pour les signataires :
--
--   events.certificate_signatory_signature  : Image signature du 1er signataire (URL, optionnel)
--   events.certificate_signatory2_name      : 2ème signataire (nom)
--   events.certificate_signatory2_title     : 2ème signataire (titre / fonction)
--   events.certificate_signatory2_signature : Image signature du 2ème signataire (URL, optionnel)
--   events.certificate_participant_quality  : Qualité du participant
--                                             (ex: intervenant, modérateur…)
--                                             optionnel — si renseigné, insère
--                                             « en qualité de … » dans le texte.
--
-- Idempotent (IF NOT EXISTS).
-- ==============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS certificate_signatory_signature  TEXT,
  ADD COLUMN IF NOT EXISTS certificate_signatory2_name      TEXT,
  ADD COLUMN IF NOT EXISTS certificate_signatory2_title     TEXT,
  ADD COLUMN IF NOT EXISTS certificate_signatory2_signature TEXT,
  ADD COLUMN IF NOT EXISTS certificate_participant_quality  TEXT,
  ADD COLUMN IF NOT EXISTS certificate_scheduled_at         TIMESTAMPTZ;

COMMENT ON COLUMN public.events.certificate_signatory_signature
  IS 'URL de l''image de la signature du 1er signataire (PNG transparent recommandé, optionnel)';

COMMENT ON COLUMN public.events.certificate_signatory2_name
  IS 'DJE template — nom du 2ème signataire (ex: Mme Pauline WHITE)';

COMMENT ON COLUMN public.events.certificate_signatory2_title
  IS 'DJE template — titre ou fonction du 2ème signataire (ex: Présidente de Women in Logistics Africa — Gabon)';

COMMENT ON COLUMN public.events.certificate_signatory2_signature
  IS 'DJE template — URL de l''image de la signature du 2ème signataire (PNG transparent recommandé, optionnel)';

COMMENT ON COLUMN public.events.certificate_participant_quality
  IS 'DJE template — qualité du participant (ex: intervenant, modérateur, participant). Si renseigné, insère « en qualité de … » dans le texte du certificat.';
