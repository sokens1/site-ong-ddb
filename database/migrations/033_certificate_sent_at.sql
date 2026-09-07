-- ============================================================================
-- Migration 033 : Suivi de l'envoi des certificats
-- Ajoute une date d'envoi du certificat sur chaque inscription, pour permettre
-- l'envoi automatique (une seule fois) aux participants scannés à l'entrée.
-- ============================================================================

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS certificate_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.event_registrations.certificate_sent_at IS 'Date d''envoi du certificat de participation (NULL = pas encore envoyé)';
