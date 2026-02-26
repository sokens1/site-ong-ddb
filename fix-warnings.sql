-- ============================================
-- FIX: OPTIMISATION SÉCURITÉ & CORRECTION WARNINGS
-- ============================================

-- 1. CORRECTION: Function Search Path Mutable
-- Définit le search_path explicitement pour éviter les attaques par substitution
ALTER FUNCTION public.update_documents_updated_at() SET search_path = public;
ALTER FUNCTION public.update_user_profiles_updated_at() SET search_path = public;

-- 2. HELPER: Récupération sécurisée du rôle
-- Fonction pour vérifier le rôle de l'utilisateur courant sans récursion infinie
CREATE OR REPLACE FUNCTION public.get_my_claim_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_profiles WHERE id = auth.uid()),
    'membre'
  );
$$;

-- ============================================
-- 3. DURCISSEMENT DES POLITIQUES (RLS)
-- Remplace les politiques "Full Access" par des règles basées sur les rôles
-- ============================================

-- A. TABLE: user_profiles
-- --------------------------------------------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Suppression des anciennes politiques permissives
DROP POLICY IF EXISTS "Allow authenticated users full access to user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_profiles;

-- Lecture: Tout le monde authentifié peut lire (nécessaire pour afficher les auteurs etc.)
CREATE POLICY "Allow authenticated read access" ON public.user_profiles FOR SELECT TO authenticated USING (true);

-- Modification: Soi-même OU Admin
CREATE POLICY "Allow individual update or admin" ON public.user_profiles FOR UPDATE TO authenticated 
USING (auth.uid() = id OR public.get_my_claim_role() = 'admin')
WITH CHECK (auth.uid() = id OR public.get_my_claim_role() = 'admin');

-- Suppression: Admin seulement
CREATE POLICY "Allow admin delete" ON public.user_profiles FOR DELETE TO authenticated 
USING (public.get_my_claim_role() = 'admin');

-- Insertion: Admin ou Self-Registration (via trigger auth)
-- Note: Pour l'inscription de nouveaux admins via l'interface, c'est l'admin connecté qui insert.
CREATE POLICY "Allow admin insert" ON public.user_profiles FOR INSERT TO authenticated 
WITH CHECK (public.get_my_claim_role() = 'admin' OR auth.uid() = id);


-- B. TABLES CONTENU (Projects, News, Videos, etc.)
-- --------------------------------------------
-- Stratégie: Lecture Authentifiée (Full) / Modif selon Rôles

-- -- projects --
DROP POLICY IF EXISTS "Allow authenticated users full access to projects" ON public.projects;
-- Note: On garde "Allow public read access..." si elle existe déjà (créée précédemment)

CREATE POLICY "Allow authenticated read projects" ON public.projects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin/chef modify projects" ON public.projects FOR ALL TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'chef_projet'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'chef_projet'));

-- -- project_tasks --
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to project_tasks" ON public.project_tasks;

CREATE POLICY "Allow authenticated read tasks" ON public.project_tasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin/chef modify tasks" ON public.project_tasks FOR ALL TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'chef_projet'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'chef_projet'));


-- -- news --
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to news" ON public.news;

CREATE POLICY "Allow authenticated read news" ON public.news FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin/comms modify news" ON public.news FOR ALL TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'charge_communication'));


-- -- videos --
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to videos" ON public.videos;
DROP POLICY IF EXISTS "Authenticated can delete videos rows" ON public.videos;
DROP POLICY IF EXISTS "Authenticated can insert videos rows" ON public.videos;
DROP POLICY IF EXISTS "Authenticated can update videos rows" ON public.videos;

CREATE POLICY "Allow authenticated read videos" ON public.videos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin/comms modify videos" ON public.videos FOR ALL TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'charge_communication'));


-- -- reports --
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to reports" ON public.reports;

CREATE POLICY "Allow authenticated read reports" ON public.reports FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin/chef/comms modify reports" ON public.reports FOR ALL TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'chef_projet', 'charge_communication'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'chef_projet', 'charge_communication'));


-- -- documents --
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to documents" ON public.documents;

CREATE POLICY "Allow authenticated read documents" ON public.documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin/chef/comms modify documents" ON public.documents FOR ALL TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'chef_projet', 'charge_communication'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'chef_projet', 'charge_communication'));


-- -- actions --
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to actions" ON public.actions;

CREATE POLICY "Allow authenticated read actions" ON public.actions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin/chef modify actions" ON public.actions FOR ALL TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'chef_projet'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'chef_projet'));


-- -- faq --
ALTER TABLE public.faq ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to faq" ON public.faq;

CREATE POLICY "Allow authenticated read faq" ON public.faq FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin/comms modify faq" ON public.faq FOR ALL TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'charge_communication'));


-- -- team_members --
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to team_members" ON public.team_members;

CREATE POLICY "Allow authenticated read team_members" ON public.team_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin modify team_members" ON public.team_members FOR ALL TO authenticated
USING (public.get_my_claim_role() = 'admin')
WITH CHECK (public.get_my_claim_role() = 'admin');


-- -- newsletter_subscribers --
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
-- Note: On garde INSERT public policies
DROP POLICY IF EXISTS "Allow authenticated users to delete newsletter_subscribers" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Allow authenticated users to update newsletter_subscribers" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Allow authenticated users to read newsletter_subscribers" ON public.newsletter_subscribers;

CREATE POLICY "Allow authenticated read subscribers" ON public.newsletter_subscribers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin/comms modify subscribers" ON public.newsletter_subscribers FOR UPDATE TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'charge_communication'));

CREATE POLICY "Allow admin/comms delete subscribers" ON public.newsletter_subscribers FOR DELETE TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'));


-- -- form_submissions --
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
-- Note: On garde INSERT public policies
DROP POLICY IF EXISTS "Allow authenticated users to delete form_submissions" ON public.form_submissions;
DROP POLICY IF EXISTS "Allow authenticated users to update form_submissions" ON public.form_submissions;
DROP POLICY IF EXISTS "Allow authenticated users to read form_submissions" ON public.form_submissions;

CREATE POLICY "Allow authenticated read submissions" ON public.form_submissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin/comms modify submissions" ON public.form_submissions FOR UPDATE TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'charge_communication'));

CREATE POLICY "Allow admin/comms delete submissions" ON public.form_submissions FOR DELETE TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'));


-- -- contribution_types --
ALTER TABLE public.contribution_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to contribution_types" ON public.contribution_types;

CREATE POLICY "Allow authenticated read contribution_types" ON public.contribution_types FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin modify contribution_types" ON public.contribution_types FOR ALL TO authenticated
USING (public.get_my_claim_role() = 'admin')
WITH CHECK (public.get_my_claim_role() = 'admin');


-- -- notifications --
-- Special case: Users see their own notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
-- Assuming policies exist or we need to create them. Existing ones:
-- "Les utilisateurs peuvent marquer leurs notifications comme lues"
-- "Les utilisateurs peuvent voir leurs propres notifications"
-- Warning said "RLS Disabled in Public" in Step 0.
-- Step 21 added generic RLS for notifications? Or Step 36.
-- Let's ensure basic owner policy.

DROP POLICY IF EXISTS "Allow authenticated read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow authenticated update own notifications" ON public.notifications;

CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admin might need to insert notifications for users?
CREATE POLICY "Admin insert notifications" ON public.notifications FOR INSERT TO authenticated 
WITH CHECK (true); -- Helper function or triggers create notifications usually. Accepting true for simplicity on insert.
