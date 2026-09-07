-- ============================================================================
-- Migration 032 : Tarifs de billetterie
-- Ajoute une liste de tarifs (nom, prix, description) pour un événement.
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ticket_tiers JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.events.ticket_tiers IS 'Liste des tarifs : [{id, label, price, description}]';
