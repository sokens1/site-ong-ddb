-- ============================================================================
-- Migration 031 : Wizard événement v7
-- Ajoute : type d'événement, programme (agenda), template de billet,
--          activation + template de certificat, template du visuel "J'y serai".
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'conference',
  ADD COLUMN IF NOT EXISTS program JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ticket_template TEXT DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS certificate_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS certificate_template TEXT DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS poster_template TEXT DEFAULT 'classic';

COMMENT ON COLUMN public.events.event_type IS 'conference | atelier | formation | webinaire | collecte_fonds | benevolat | autre';
COMMENT ON COLUMN public.events.program IS 'Liste ordonnée : [{id, time, title, speaker, description}]';
COMMENT ON COLUMN public.events.ticket_template IS 'classic | modern';
COMMENT ON COLUMN public.events.certificate_template IS 'classic | modern';
COMMENT ON COLUMN public.events.poster_template IS 'classic | modern';
