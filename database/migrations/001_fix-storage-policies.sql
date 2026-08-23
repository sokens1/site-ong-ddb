-- Supprimer les anciennes politiques s'il y en a
DROP POLICY IF EXISTS "Allow authenticated users to upload CVs" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to CVs" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own CVs" ON storage.objects;

-- Activer RLS sur storage.objects si ce n'est pas déjà fait
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre l'upload (INSERT) - pour tous les utilisateurs
CREATE POLICY "Allow upload to cv-uploads bucket" ON storage.objects
FOR INSERT 
TO public
WITH CHECK (bucket_id = 'cv-uploads');

-- Politique pour permettre la lecture (SELECT) - pour tous les utilisateurs
CREATE POLICY "Allow public read access to cv-uploads bucket" ON storage.objects
FOR SELECT 
TO public
USING (bucket_id = 'cv-uploads');

-- Politique pour permettre la suppression (DELETE) - pour tous les utilisateurs
CREATE POLICY "Allow delete from cv-uploads bucket" ON storage.objects
FOR DELETE 
TO public
USING (bucket_id = 'cv-uploads');

-- Vérifier que le bucket existe et est public
-- (Cette requête devrait retourner une ligne si le bucket existe)
SELECT * FROM storage.buckets WHERE id = 'cv-uploads';

