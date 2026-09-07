-- ============================================================================
-- Migration 034 : Thème & texte d'invitation
-- Ces colonnes étaient déjà utilisées côté application (wizard, page publique,
-- billet "Invitation") mais n'existaient pas encore en base — l'enregistrement
-- échouait silencieusement et ces champs n'étaient jamais persistés.
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS theme TEXT,
  ADD COLUMN IF NOT EXISTS invitation_text TEXT,
  ADD COLUMN IF NOT EXISTS invitation_subtext TEXT;

COMMENT ON COLUMN public.events.theme IS 'Thème de l''événement, affiché sur le visuel "J''y serai" (modèle moderne)';
COMMENT ON COLUMN public.events.invitation_text IS 'Texte principal affiché sur le billet "Invitation"';
COMMENT ON COLUMN public.events.invitation_subtext IS 'Sous-texte / formule affiché sur le billet "Invitation"';
