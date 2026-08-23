-- ============================================
-- DURCISSEMENT SÉCURITÉ — Août 2026
-- ============================================
-- Contexte : plusieurs tables sensibles avaient des politiques RLS de type
-- "TO authenticated USING (true)", c'est-à-dire que N'IMPORTE QUEL compte
-- connecté (même un rôle "membre" ou "partenaire" sans accès à ces sections
-- dans le menu admin) pouvait lire/modifier/supprimer des données qui ne
-- lui sont pas destinées, en appelant Supabase directement (hors interface).
--
-- Ce script aligne les politiques RLS sur le modèle de rôles déjà utilisé
-- côté interface (ROLE_MENU_ACCESS dans AdminLayout.tsx) : seuls 'admin' et
-- 'charge_communication' ont accès aux Événements/Dons dans le menu, donc
-- ce sont les seuls rôles qui doivent pouvoir modifier ces données en base.
--
-- Réutilise la fonction public.get_my_claim_role() créée dans fix-warnings.sql.
-- ============================================

-- ── EVENTS ───────────────────────────────────────────────────────────────
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to events" ON public.events;
-- On garde "Allow public read access to events" (lecture publique nécessaire au site)

CREATE POLICY "Allow admin/comms modify events" ON public.events FOR ALL TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'charge_communication'));


-- ── EVENT_REGISTRATIONS (données personnelles des participants) ──────────
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated to read registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Allow authenticated users to read registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Allow authenticated to delete registrations" ON public.event_registrations;
-- On garde "Allow public to insert registrations" (nécessaire à l'inscription publique)

CREATE POLICY "Allow admin/comms read registrations" ON public.event_registrations FOR SELECT TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'));

CREATE POLICY "Allow admin/comms update registrations" ON public.event_registrations FOR UPDATE TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'charge_communication'));

CREATE POLICY "Allow admin/comms delete registrations" ON public.event_registrations FOR DELETE TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'));


-- ── EVENT_VOLUNTEERS ───────────────────────────────────────────────────
ALTER TABLE public.event_volunteers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read for event_volunteers" ON public.event_volunteers;
DROP POLICY IF EXISTS "Allow authenticated insert for event_volunteers" ON public.event_volunteers;
DROP POLICY IF EXISTS "Allow authenticated update for event_volunteers" ON public.event_volunteers;
DROP POLICY IF EXISTS "Allow authenticated delete for event_volunteers" ON public.event_volunteers;

CREATE POLICY "Allow admin/comms manage event_volunteers" ON public.event_volunteers FOR ALL TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'charge_communication'));


-- ── SENT_EVENT_EMAILS (historique d'envoi) ────────────────────────────
ALTER TABLE public.sent_event_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read for sent_event_emails" ON public.sent_event_emails;
DROP POLICY IF EXISTS "Allow authenticated insert for sent_event_emails" ON public.sent_event_emails;

CREATE POLICY "Allow admin/comms manage sent_event_emails" ON public.sent_event_emails FOR ALL TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'charge_communication'));


-- ── EVENT_FEEDBACKS ─────────────────────────────────────────────────────
ALTER TABLE public.event_feedbacks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to read feedbacks" ON public.event_feedbacks;
-- On garde "Allow public to insert feedbacks" (nécessaire au formulaire d'avis public)

CREATE POLICY "Allow admin/comms read feedbacks" ON public.event_feedbacks FOR SELECT TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'));


-- ── DONATIONS ────────────────────────────────────────────────────────────
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to read donations" ON public.donations;
DROP POLICY IF EXISTS "Allow authenticated users to update donations" ON public.donations;
-- On garde "Allow public to insert donations" (nécessaire au formulaire public)

CREATE POLICY "Allow admin/comms read donations" ON public.donations FOR SELECT TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'));

CREATE POLICY "Allow admin/comms update donations" ON public.donations FOR UPDATE TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'charge_communication'));


-- ── INTERVIEW_SCHEDULES (candidatures/entretiens — données personnelles) ──
ALTER TABLE public.interview_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage interviews" ON public.interview_schedules;

CREATE POLICY "Allow admin/comms manage interviews" ON public.interview_schedules FOR ALL TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'charge_communication'));


-- ── STORAGE : bucket cv-uploads ──────────────────────────────────────────
-- Faille critique : la suppression était ouverte à "public" (aucune
-- authentification requise) — n'importe qui sur internet pouvait supprimer
-- tous les CV de candidature. Upload et lecture restent publics (nécessaire
-- au formulaire de candidature), seule la suppression est restreinte.
DROP POLICY IF EXISTS "Allow delete from cv-uploads bucket" ON storage.objects;

CREATE POLICY "Allow admin/comms delete from cv-uploads bucket" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'cv-uploads' AND public.get_my_claim_role() IN ('admin', 'charge_communication'));


-- ── SECURITY_EVENTS (journal d'activité + tentatives suspectes) ─────────
-- Deux catégories dans une seule table pour un affichage unifié en admin :
--  - 'admin_activity'    : actions sensibles effectuées par un admin/comms
--                          (suppression d'inscription, envoi de mail groupé...)
--  - 'suspicious_access' : tentatives d'appel direct des Edge Functions sans
--                          autorisation valide (voir supabase/functions/_shared/verifyAdmin.ts)
CREATE TABLE IF NOT EXISTS public.security_events (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('admin_activity', 'suspicious_access')),
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    action TEXT NOT NULL,
    actor_email TEXT,
    actor_role TEXT,
    target TEXT,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Lecture réservée à l'admin (le journal de sécurité ne doit pas fuiter aux autres rôles)
CREATE POLICY "Allow admin read security_events" ON public.security_events FOR SELECT TO authenticated
USING (public.get_my_claim_role() = 'admin');

-- Un compte admin/comms peut enregistrer ses propres actions (audit trail).
-- Les événements "suspicious_access" sont insérés par les Edge Functions via la
-- Service Role Key, qui contourne RLS — aucune policy INSERT n'est nécessaire pour eux.
CREATE POLICY "Allow admin/comms insert own activity" ON public.security_events FOR INSERT TO authenticated
WITH CHECK (public.get_my_claim_role() IN ('admin', 'charge_communication') AND category = 'admin_activity');

CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events (created_at DESC);


-- ============================================
-- Vérification rapide après exécution :
-- SELECT tablename, policyname, roles, cmd FROM pg_policies
-- WHERE tablename IN ('events','event_registrations','event_volunteers',
--   'sent_event_emails','event_feedbacks','donations','interview_schedules')
-- ORDER BY tablename;
-- ============================================
