-- ============================================================
-- 039 — CAPACITÉ DES ÉVÉNEMENTS (max_slots) + race condition
-- ============================================================
-- Avant : `events.max_slots` était affiché mais jamais appliqué.
-- Rien n'empêchait 500 inscriptions sur un event de 100 places,
-- et 2 inscrits simultanés pouvaient prendre la même dernière place.
--
-- Ce trigger BEFORE INSERT :
--   - ne fait rien si max_slots IS NULL (pas de limite)
--   - verrouille la ligne event (FOR UPDATE) -> sérialise les
--     inscriptions concurrentes pour ce même event
--   - compte les inscriptions et refuse si complet
--
-- Idempotent.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_event_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cap   integer;
  taken integer;
BEGIN
  -- verrou + lecture de la capacité dans la foulée
  SELECT max_slots INTO cap
  FROM public.events
  WHERE id = NEW.event_id
  FOR UPDATE;

  IF cap IS NULL THEN
    RETURN NEW;                       -- pas de limite définie
  END IF;

  SELECT count(*) INTO taken
  FROM public.event_registrations
  WHERE event_id = NEW.event_id;

  IF taken >= cap THEN
    RAISE EXCEPTION 'Cet événement est complet (% places).', cap
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_capacity ON public.event_registrations;
CREATE TRIGGER trg_event_capacity
  BEFORE INSERT ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_event_capacity();

-- ── Test manuel ─────────────────────────────────────────────
-- UPDATE public.events SET max_slots = 1 WHERE id = <id_test>;
-- INSERT ... (2e insert doit échouer avec "Cet événement est complet")
