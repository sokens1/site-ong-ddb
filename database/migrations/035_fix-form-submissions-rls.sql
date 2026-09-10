-- ============================================================
-- 035 — CORRECTIF CRITIQUE : RLS manquant sur form_submissions
-- ============================================================
-- CONSTAT (audit 2026-09-10) : public.form_submissions a
--   rls_active = false  ->  n'importe qui possédant la clé
--   anon (visible dans le bundle front) peut lire TOUTES les
--   candidatures et demandes de partenariat : nom, email,
--   téléphone, ville, motivation. Donnée personnelle exposée.
--
-- La migration #010 prévoyait bien `ENABLE ROW LEVEL SECURITY`
-- sur cette table mais n'a jamais été appliquée en prod
-- (ou la table a été recréée depuis). Ce fichier remet l'état
-- voulu, avec les mêmes conventions que #010 (get_my_claim_role).
--
-- Idempotent : réexécutable sans risque.
-- ============================================================

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- Nettoyage de toutes les anciennes policies éventuelles
DROP POLICY IF EXISTS "Allow public to insert form_submissions"            ON public.form_submissions;
DROP POLICY IF EXISTS "Allow public form submissions"                      ON public.form_submissions;
DROP POLICY IF EXISTS "autoriser insertion publique"                       ON public.form_submissions;
DROP POLICY IF EXISTS "Allow authenticated users to read form_submissions" ON public.form_submissions;
DROP POLICY IF EXISTS "Allow authenticated users to update form_submissions" ON public.form_submissions;
DROP POLICY IF EXISTS "Allow authenticated users to delete form_submissions" ON public.form_submissions;
DROP POLICY IF EXISTS "Allow authenticated read submissions"               ON public.form_submissions;
DROP POLICY IF EXISTS "Allow admin/comms modify submissions"               ON public.form_submissions;
DROP POLICY IF EXISTS "Allow admin/comms delete submissions"               ON public.form_submissions;
DROP POLICY IF EXISTS "fs_insert_public"  ON public.form_submissions;
DROP POLICY IF EXISTS "fs_select_staff"   ON public.form_submissions;
DROP POLICY IF EXISTS "fs_update_staff"   ON public.form_submissions;
DROP POLICY IF EXISTS "fs_delete_staff"   ON public.form_submissions;

-- 1. INSERT : le formulaire public (rôle anon) + tout authentifié
CREATE POLICY "fs_insert_public"
ON public.form_submissions FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 2. SELECT : seulement admin / chargé de communication
CREATE POLICY "fs_select_staff"
ON public.form_submissions FOR SELECT
TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'));

-- 3. UPDATE : admin / chargé de communication (traitement des candidatures)
CREATE POLICY "fs_update_staff"
ON public.form_submissions FOR UPDATE
TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'charge_communication'));

-- 4. DELETE : admin / chargé de communication
CREATE POLICY "fs_delete_staff"
ON public.form_submissions FOR DELETE
TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'));

-- ── Vérification (doit renvoyer rls_active = true + 4 policies) ─
-- SELECT relrowsecurity FROM pg_class WHERE oid = 'public.form_submissions'::regclass;
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'form_submissions';
