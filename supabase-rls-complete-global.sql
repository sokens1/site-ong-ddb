-- ============================================
-- CONFIGURATION COMPLÈTE RLS POUR L'INTERFACE ADMIN
-- ============================================
-- Ce fichier contient toutes les politiques RLS nécessaires pour l'interface admin
-- 
-- INSTRUCTIONS:
-- 1. Exécutez ce script dans Supabase Dashboard > SQL Editor
-- 2. Pour les politiques Storage (lignes commentées), utilisez l'interface Supabase Dashboard
--    (Storage > ong-backend > Policies)
-- ============================================

-- ============================================
-- TABLE: actions
-- ============================================
ALTER TABLE IF EXISTS actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users full access to actions" ON actions;
DROP POLICY IF EXISTS "Allow public read access to actions" ON actions;

CREATE POLICY "Allow authenticated users full access to actions" 
ON actions
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public read access to actions" 
ON actions
FOR SELECT 
TO public
USING (true);

-- ============================================
-- TABLE: reports
-- ============================================
ALTER TABLE IF EXISTS reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users full access to reports" ON reports;
DROP POLICY IF EXISTS "Allow public read access to reports" ON reports;

CREATE POLICY "Allow authenticated users full access to reports" 
ON reports
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public read access to reports" 
ON reports
FOR SELECT 
TO public
USING (true);

-- ============================================
-- TABLE: videos
-- ============================================
ALTER TABLE IF EXISTS videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users full access to videos" ON videos;
DROP POLICY IF EXISTS "Allow public read access to videos" ON videos;

CREATE POLICY "Allow authenticated users full access to videos" 
ON videos
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public read access to videos" 
ON videos
FOR SELECT 
TO public
USING (true);

-- ============================================
-- TABLE: news
-- ============================================
ALTER TABLE IF EXISTS news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users full access to news" ON news;
DROP POLICY IF EXISTS "Allow public read access to news" ON news;

CREATE POLICY "Allow authenticated users full access to news" 
ON news
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public read access to news" 
ON news
FOR SELECT 
TO public
USING (true);

-- ============================================
-- TABLE: team_members
-- ============================================
ALTER TABLE IF EXISTS team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users full access to team_members" ON team_members;
DROP POLICY IF EXISTS "Allow public read access to team_members" ON team_members;

CREATE POLICY "Allow authenticated users full access to team_members" 
ON team_members
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public read access to team_members" 
ON team_members
FOR SELECT 
TO public
USING (true);

-- ============================================
-- TABLE: faq
-- ============================================
ALTER TABLE IF EXISTS faq ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users full access to faq" ON faq;
DROP POLICY IF EXISTS "Allow public read access to faq" ON faq;

CREATE POLICY "Allow authenticated users full access to faq" 
ON faq
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public read access to faq" 
ON faq
FOR SELECT 
TO public
USING (true);

-- ============================================
-- TABLE: contribution_types
-- ============================================
ALTER TABLE IF EXISTS contribution_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users full access to contribution_types" ON contribution_types;
DROP POLICY IF EXISTS "Allow public read access to contribution_types" ON contribution_types;

CREATE POLICY "Allow authenticated users full access to contribution_types" 
ON contribution_types
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public read access to contribution_types" 
ON contribution_types
FOR SELECT 
TO public
USING (true);

-- ============================================
-- TABLE: form_submissions
-- ============================================
ALTER TABLE IF EXISTS form_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read form_submissions" ON form_submissions;
DROP POLICY IF EXISTS "Allow public to insert form_submissions" ON form_submissions;
DROP POLICY IF EXISTS "Allow authenticated users to update form_submissions" ON form_submissions;
DROP POLICY IF EXISTS "Allow authenticated users to delete form_submissions" ON form_submissions;

-- Permettre l'insertion publique (pour le formulaire de candidature)
CREATE POLICY "Allow public to insert form_submissions" 
ON form_submissions
FOR INSERT 
TO public
WITH CHECK (true);

-- Permettre la lecture aux utilisateurs authentifiés (admin)
CREATE POLICY "Allow authenticated users to read form_submissions" 
ON form_submissions
FOR SELECT 
TO authenticated
USING (true);

-- Permettre la mise à jour aux utilisateurs authentifiés
CREATE POLICY "Allow authenticated users to update form_submissions" 
ON form_submissions
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

-- Permettre la suppression aux utilisateurs authentifiés
CREATE POLICY "Allow authenticated users to delete form_submissions" 
ON form_submissions
FOR DELETE 
TO authenticated
USING (true);

-- ============================================
-- TABLE: newsletter_subscribers
-- ============================================
ALTER TABLE IF EXISTS newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read newsletter_subscribers" ON newsletter_subscribers;
DROP POLICY IF EXISTS "Allow public to insert newsletter_subscribers" ON newsletter_subscribers;
DROP POLICY IF EXISTS "Allow authenticated users to update newsletter_subscribers" ON newsletter_subscribers;
DROP POLICY IF EXISTS "Allow authenticated users to delete newsletter_subscribers" ON newsletter_subscribers;

-- Permettre l'insertion publique (pour le formulaire newsletter)
CREATE POLICY "Allow public to insert newsletter_subscribers" 
ON newsletter_subscribers
FOR INSERT 
TO public
WITH CHECK (true);

-- Permettre la lecture aux utilisateurs authentifiés (admin)
CREATE POLICY "Allow authenticated users to read newsletter_subscribers" 
ON newsletter_subscribers
FOR SELECT 
TO authenticated
USING (true);

-- Permettre la mise à jour aux utilisateurs authentifiés
CREATE POLICY "Allow authenticated users to update newsletter_subscribers" 
ON newsletter_subscribers
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

-- Permettre la suppression aux utilisateurs authentifiés
CREATE POLICY "Allow authenticated users to delete newsletter_subscribers" 
ON newsletter_subscribers
FOR DELETE 
TO authenticated
USING (true);

-- ============================================
-- STORAGE: Politiques pour le bucket ong-backend
-- ============================================
-- ⚠️ ATTENTION: Cette section NE PEUT PAS être exécutée via SQL Editor
-- car elle nécessite des permissions de propriétaire sur storage.objects
--
-- VOUS DEVEZ configurer ces politiques via l'interface Supabase:
-- 1. Allez dans Supabase Dashboard > Storage > ong-backend
-- 2. Cliquez sur l'onglet "Policies"
-- 3. Créez les 3 politiques suivantes:
--
-- POLITIQUE 1: Upload (INSERT)
-- - Policy name: Allow authenticated upload to ong-backend
-- - Allowed operation: INSERT
-- - Target roles: authenticated
-- - WITH CHECK expression: bucket_id = 'ong-backend'
--
-- POLITIQUE 2: Lecture publique (SELECT)
-- - Policy name: Allow public read from ong-backend
-- - Allowed operation: SELECT
-- - Target roles: public
-- - USING expression: bucket_id = 'ong-backend'
--
-- POLITIQUE 3: Suppression (DELETE)
-- - Policy name: Allow authenticated delete from ong-backend
-- - Allowed operation: DELETE
-- - Target roles: authenticated
-- - USING expression: bucket_id = 'ong-backend'
--
-- Voir le fichier STORAGE-POLICIES-SETUP.md pour les instructions détaillées

/*
-- NE PAS EXÉCUTER - Référence uniquement
ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated upload to ong-backend" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from ong-backend" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from ong-backend" ON storage.objects;

CREATE POLICY "Allow authenticated upload to ong-backend" 
ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'ong-backend');

CREATE POLICY "Allow public read from ong-backend" 
ON storage.objects
FOR SELECT 
TO public
USING (bucket_id = 'ong-backend');

CREATE POLICY "Allow authenticated delete from ong-backend" 
ON storage.objects
FOR DELETE 
TO authenticated
USING (bucket_id = 'ong-backend');
*/

-- ============================================
-- VÉRIFICATION
-- ============================================
-- Pour vérifier que les politiques sont bien créées, exécutez :
-- SELECT schemaname, tablename, policyname, cmd, roles 
-- FROM pg_policies 
-- WHERE tablename IN ('actions', 'reports', 'videos', 'news', 'team_members', 'faq', 'contribution_types', 'form_submissions', 'newsletter_subscribers')
-- ORDER BY tablename, policyname;

