-- Politiques RLS (Row Level Security) pour l'interface Admin
-- Ces politiques permettent aux utilisateurs authentifiés d'accéder aux données

-- ============================================
-- TABLE: form_submissions
-- ============================================

-- Activer RLS sur la table
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture aux utilisateurs authentifiés
CREATE POLICY "Allow authenticated users to read form_submissions" 
ON form_submissions
FOR SELECT 
TO authenticated
USING (true);

-- Politique pour permettre l'insertion (déjà géré par le formulaire public)
-- Si vous voulez que seuls les admins puissent voir, utilisez cette politique à la place :
-- CREATE POLICY "Allow authenticated users to read form_submissions" 
-- ON form_submissions
-- FOR SELECT 
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM auth.users 
--     WHERE auth.users.id = auth.uid() 
--     AND auth.users.email = 'votre-email-admin@example.com'
--   )
-- );

-- ============================================
-- TABLE: newsletter_subscribers
-- ============================================

-- Activer RLS sur la table
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture aux utilisateurs authentifiés
CREATE POLICY "Allow authenticated users to read newsletter_subscribers" 
ON newsletter_subscribers
FOR SELECT 
TO authenticated
USING (true);

-- ============================================
-- TABLES: actions, reports, videos, news, team_members, faq, contribution_types
-- ============================================

-- Pour chaque table, activez RLS et créez les politiques nécessaires

-- ACTIONS
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to actions" 
ON actions
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- REPORTS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to reports" 
ON reports
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- VIDEOS
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to videos" 
ON videos
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- NEWS
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to news" 
ON news
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- TEAM_MEMBERS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to team_members" 
ON team_members
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- FAQ
ALTER TABLE faq ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to faq" 
ON faq
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- CONTRIBUTION_TYPES
ALTER TABLE contribution_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to contribution_types" 
ON contribution_types
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- NOTES IMPORTANTES
-- ============================================

-- 1. Ces politiques permettent à TOUS les utilisateurs authentifiés d'accéder aux données
--    Si vous voulez restreindre à certains utilisateurs, modifiez les politiques

-- 2. Pour vérifier qu'un utilisateur est connecté dans votre code :
--    const { data: { session } } = await supabase.auth.getSession();

-- 3. Si vous voulez permettre l'accès public en lecture seule pour certaines tables :
--    CREATE POLICY "Allow public read access" 
--    ON table_name
--    FOR SELECT 
--    TO public
--    USING (true);

-- 4. Pour supprimer une politique existante :
--    DROP POLICY IF EXISTS "policy_name" ON table_name;

