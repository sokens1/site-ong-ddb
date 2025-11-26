-- ============================================
-- POLITIQUES STORAGE POUR LE BUCKET ong-backend
-- ============================================
-- ⚠️ ATTENTION IMPORTANTE ⚠️
-- Ce script NE PEUT PAS être exécuté directement car il nécessite des permissions
-- de propriétaire (owner) sur la table système storage.objects.
-- 
-- SOLUTION: Vous DEVEZ utiliser l'interface Supabase Dashboard pour configurer
-- les politiques Storage. Voir le fichier STORAGE-POLICIES-SETUP.md pour les
-- instructions détaillées étape par étape.
--
-- Ce fichier SQL est fourni uniquement à titre de référence pour comprendre
-- quelles politiques doivent être créées.

-- ============================================
-- NE PAS EXÉCUTER CE SCRIPT DIRECTEMENT
-- Utilisez l'interface Supabase Dashboard > Storage > ong-backend > Policies
-- ============================================

/*
-- Activer RLS sur storage.objects (fait automatiquement par Supabase)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Allow authenticated upload to ong-backend" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from ong-backend" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from ong-backend" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update in ong-backend" ON storage.objects;

-- Politique 1: Upload (INSERT) pour utilisateurs authentifiés
CREATE POLICY "Allow authenticated upload to ong-backend" 
ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'ong-backend');

-- Politique 2: Lecture publique (SELECT)
CREATE POLICY "Allow public read from ong-backend" 
ON storage.objects
FOR SELECT 
TO public
USING (bucket_id = 'ong-backend');

-- Politique 3: Mise à jour (UPDATE) pour utilisateurs authentifiés
CREATE POLICY "Allow authenticated update in ong-backend" 
ON storage.objects
FOR UPDATE 
TO authenticated
USING (bucket_id = 'ong-backend')
WITH CHECK (bucket_id = 'ong-backend');

-- Politique 4: Suppression (DELETE) pour utilisateurs authentifiés
CREATE POLICY "Allow authenticated delete from ong-backend" 
ON storage.objects
FOR DELETE 
TO authenticated
USING (bucket_id = 'ong-backend');

-- Vérification
-- Pour vérifier que les politiques sont créées :
-- SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%ong-backend%';
*/

