-- ============================================================
-- 038 — SÉCURISATION DE site_visits
-- ============================================================
-- CONSTAT (audit 2026-09-10) : la policy de site_visits était
--   FOR ALL USING (true) WITH CHECK (true)
-- => n'importe quel visiteur anonyme (clé anon = publique) peut
--    LIRE, MODIFIER et SUPPRIMER toute la table analytics.
--
-- Correctif : la seule écriture autorisée passe par la fonction
-- increment_visit() (SECURITY DEFINER, contourne RLS). Aucune
-- écriture directe. Lecture réservée aux comptes authentifiés
-- (dashboard admin). Le fallback SQL direct dans App.tsx est
-- supprimé côté code en même temps que cette migration.
--
-- Idempotent.
-- ============================================================

-- 1. Fonction d'incrément, durcie (search_path fixe).
CREATE OR REPLACE FUNCTION public.increment_visit(d date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.site_visits (visit_date, count)
  VALUES (d, 1)
  ON CONFLICT (visit_date)
  DO UPDATE SET count = site_visits.count + 1;
END;
$$;

-- Le formulaire public appelle la RPC sans être connecté.
GRANT EXECUTE ON FUNCTION public.increment_visit(date) TO anon, authenticated;

-- 2. RLS : on repart propre.
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow visit increments"        ON public.site_visits;
DROP POLICY IF EXISTS "Allow public read site_visits" ON public.site_visits;
DROP POLICY IF EXISTS "sv_select_auth"                ON public.site_visits;

-- Lecture : comptes authentifiés uniquement (stats du dashboard).
CREATE POLICY "sv_select_auth"
ON public.site_visits FOR SELECT
TO authenticated
USING (true);

-- Pas de policy INSERT / UPDATE / DELETE : toute écriture directe
-- est refusée. Seule increment_visit() (SECURITY DEFINER) écrit.

-- ── Vérif ───────────────────────────────────────────────────
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'site_visits';
--   -> doit ne montrer QUE sv_select_auth / SELECT
-- SELECT public.increment_visit(current_date);  -- doit marcher
