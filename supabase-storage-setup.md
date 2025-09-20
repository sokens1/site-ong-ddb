# Configuration Supabase Storage pour l'upload de CV

## 1. Créer le bucket "cv-uploads"

Dans votre tableau de bord Supabase :

1. Allez dans **Storage** dans le menu de gauche
2. Cliquez sur **"New bucket"**
3. Nom du bucket : `cv-uploads`
4. Cochez **"Public bucket"** (pour permettre l'accès aux fichiers)
5. Cliquez sur **"Create bucket"**

## 2. Configurer les politiques de sécurité

### Politique pour l'upload (INSERT)
```sql
CREATE POLICY "Allow authenticated users to upload CVs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cv-uploads');
```

### Politique pour la lecture (SELECT)
```sql
CREATE POLICY "Allow public access to CVs" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'cv-uploads');
```

### Politique pour la suppression (DELETE) - Optionnel
```sql
CREATE POLICY "Allow authenticated users to delete their own CVs" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'cv-uploads');
```

## 3. Exécuter les politiques

1. Allez dans **SQL Editor** dans Supabase
2. Collez et exécutez chaque politique une par une
3. Ou exécutez toutes les politiques en une fois :

```sql
-- Politique d'upload
CREATE POLICY "Allow authenticated users to upload CVs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cv-uploads');

-- Politique de lecture
CREATE POLICY "Allow public access to CVs" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'cv-uploads');

-- Politique de suppression
CREATE POLICY "Allow authenticated users to delete their own CVs" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'cv-uploads');
```

## 4. Vérification

Après avoir créé le bucket et les politiques :
1. Testez l'upload d'un CV dans votre formulaire
2. Vérifiez que le fichier apparaît dans le bucket `cv-uploads`
3. Vérifiez que l'URL générée est accessible

## 5. Alternative : Bucket privé

Si vous préférez un bucket privé (plus sécurisé), modifiez le code pour utiliser l'authentification :

```typescript
// Dans Join.tsx, remplacez la ligne de création d'URL publique par :
const { data } = supabase.storage.from('cv-uploads').createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 jours
cvUrl = data?.signedUrl;
```

Et utilisez cette politique pour un bucket privé :
```sql
CREATE POLICY "Allow authenticated users to upload CVs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cv-uploads');

CREATE POLICY "Allow authenticated users to read CVs" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'cv-uploads');
```

