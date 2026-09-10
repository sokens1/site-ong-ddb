-- ============================================================
-- 040 — CONTRAINTES CHECK sur les colonnes email
-- ============================================================
-- Défense en profondeur : même si le formulaire client est
-- contourné (appel direct à l'API REST), la base refuse une
-- adresse qui n'a pas la forme  x@y.z .
--
-- Ajout en NOT VALID : la contrainte s'applique à toutes les
-- NOUVELLES lignes immédiatement, sans bloquer sur d'éventuelles
-- vieilles lignes invalides. Pour vérifier aussi l'existant,
-- lancer plus tard  VALIDATE CONSTRAINT  (voir en bas).
--
-- Regex : au moins un caractère, un @, un domaine, un point, une
-- extension — insensible à la casse, pas d'espace.
--
-- Idempotent (DROP IF EXISTS avant chaque ADD).
-- ============================================================

DO $$
DECLARE
  re constant text := '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';
BEGIN
  -- form_submissions
  ALTER TABLE public.form_submissions DROP CONSTRAINT IF EXISTS form_submissions_email_chk;
  EXECUTE format(
    'ALTER TABLE public.form_submissions ADD CONSTRAINT form_submissions_email_chk CHECK (email ~* %L) NOT VALID', re);

  -- donations
  ALTER TABLE public.donations DROP CONSTRAINT IF EXISTS donations_email_chk;
  EXECUTE format(
    'ALTER TABLE public.donations ADD CONSTRAINT donations_email_chk CHECK (email ~* %L) NOT VALID', re);

  -- newsletter_subscribers
  ALTER TABLE public.newsletter_subscribers DROP CONSTRAINT IF EXISTS newsletter_subscribers_email_chk;
  EXECUTE format(
    'ALTER TABLE public.newsletter_subscribers ADD CONSTRAINT newsletter_subscribers_email_chk CHECK (email ~* %L) NOT VALID', re);

  -- event_registrations
  ALTER TABLE public.event_registrations DROP CONSTRAINT IF EXISTS event_registrations_email_chk;
  EXECUTE format(
    'ALTER TABLE public.event_registrations ADD CONSTRAINT event_registrations_email_chk CHECK (email ~* %L) NOT VALID', re);
END $$;

-- ── Optionnel : vérifier aussi les lignes existantes ────────
-- D'abord repérer les invalides :
--   SELECT id, email FROM public.form_submissions
--   WHERE email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';
-- Les corriger / supprimer, puis :
--   ALTER TABLE public.form_submissions      VALIDATE CONSTRAINT form_submissions_email_chk;
--   ALTER TABLE public.donations             VALIDATE CONSTRAINT donations_email_chk;
--   ALTER TABLE public.newsletter_subscribers VALIDATE CONSTRAINT newsletter_subscribers_email_chk;
--   ALTER TABLE public.event_registrations   VALIDATE CONSTRAINT event_registrations_email_chk;
