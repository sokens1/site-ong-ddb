-- ============================================================
-- 047 — FERMETURE DES INSCRIPTIONS D'UN ÉVÉNEMENT
-- ============================================================
-- Ajoute :
--   - events.registrations_open    (boolean, défaut true)
--       interrupteur manuel « Inscriptions ouvertes / fermées »
--   - events.registration_deadline (timestamptz, NULL = pas de limite)
--       date limite automatique d'inscription
--
-- Étend le trigger BEFORE INSERT de la migration 039
-- (enforce_event_capacity) pour refuser une inscription publique si :
--   - registrations_open = false
--   - ou now() > registration_deadline
-- Les admins / chargés de communication peuvent toujours ajouter
-- des participants manuellement depuis le back-office.
-- La vérification de capacité (max_slots) reste appliquée à tous.
--
-- Idempotent.
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registrations_open boolean NOT NULL DEFAULT true;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_deadline timestamptz NULL;

CREATE OR REPLACE FUNCTION public.enforce_event_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cap       integer;
  taken     integer;
  is_open   boolean;
  deadline  timestamptz;
  is_staff  boolean;
BEGIN
  -- verrou + lecture de la config dans la foulée
  SELECT max_slots, registrations_open, registration_deadline
    INTO cap, is_open, deadline
  FROM public.events
  WHERE id = NEW.event_id
  FOR UPDATE;

  -- Les admins / chargés de com peuvent ajouter manuellement même si fermé
  BEGIN
    is_staff := public.get_my_claim_role() IN ('admin', 'charge_communication');
  EXCEPTION WHEN OTHERS THEN
    is_staff := false;
  END;
  is_staff := COALESCE(is_staff, false);

  IF NOT is_staff THEN
    IF is_open IS FALSE THEN
      RAISE EXCEPTION 'Les inscriptions pour cet événement sont fermées.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF deadline IS NOT NULL AND now() > deadline THEN
      RAISE EXCEPTION 'La date limite d''inscription pour cet événement est dépassée.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF cap IS NULL THEN
    RETURN NEW;                       -- pas de limite de places
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

-- Le trigger trg_event_capacity (migration 039) pointe déjà sur cette
-- fonction ; on le recrée par sécurité.
DROP TRIGGER IF EXISTS trg_event_capacity ON public.event_registrations;
CREATE TRIGGER trg_event_capacity
  BEFORE INSERT ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_event_capacity();

-- ── 2. FONCTIONS DE COMPTAGE SÉCURISÉES (Bypass RLS pour anon) ──────────────
-- Permet au front public d'obtenir le nombre d'inscrits et de savoir si
-- l'événement est complet AVANT que l'utilisateur ne clique, sans exposer
-- aucune donnée personnelle (nom, email, téléphone) des inscrits.

CREATE OR REPLACE FUNCTION public.get_event_registered_count(p_event_id bigint)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.event_registrations
  WHERE event_id = p_event_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_registered_count(bigint) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_events_registered_counts()
RETURNS TABLE(event_id bigint, registered_count integer)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT event_id, count(*)::integer
  FROM public.event_registrations
  GROUP BY event_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_events_registered_counts() TO anon, authenticated;

-- ── Test manuel ─────────────────────────────────────────────
-- UPDATE public.events SET registrations_open = false WHERE id = <id_test>;
-- INSERT ... (en anonyme) -> "Les inscriptions pour cet événement sont fermées."
-- UPDATE public.events SET registrations_open = true,
--   registration_deadline = now() - interval '1 hour' WHERE id = <id_test>;
-- INSERT ... (en anonyme) -> "La date limite d'inscription ... est dépassée."
