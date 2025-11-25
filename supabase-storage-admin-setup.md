# Configuration Supabase Storage pour l'interface Admin

## Buckets nécessaires

Pour que les uploads d'images et fichiers fonctionnent dans l'interface admin, vous devez créer les buckets suivants dans Supabase :

### 1. Bucket "images"
Pour stocker toutes les images (actions, rapports, actualités, équipe, vidéos).

**Configuration :**
- Nom : `images`
- Public : ✅ Oui
- Politiques SQL :

```sql
-- Politique d'upload (authentifié)
CREATE POLICY "Allow authenticated upload to images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'images');

-- Politique de lecture (public)
CREATE POLICY "Allow public read access to images" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'images');

-- Politique de suppression (authentifié)
CREATE POLICY "Allow authenticated delete from images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'images');
```

### 2. Bucket "files"
Pour stocker les fichiers PDF et autres documents (rapports).

**Configuration :**
- Nom : `files`
- Public : ✅ Oui
- Politiques SQL :

```sql
-- Politique d'upload (authentifié)
CREATE POLICY "Allow authenticated upload to files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'files');

-- Politique de lecture (public)
CREATE POLICY "Allow public read access to files" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'files');

-- Politique de suppression (authentifié)
CREATE POLICY "Allow authenticated delete from files" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'files');
```

### 3. Bucket "videos" (optionnel)
Si vous voulez stocker des vidéos directement dans Supabase Storage.

**Configuration :**
- Nom : `videos`
- Public : ✅ Oui
- Politiques SQL :

```sql
-- Politique d'upload (authentifié)
CREATE POLICY "Allow authenticated upload to videos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'videos');

-- Politique de lecture (public)
CREATE POLICY "Allow public read access to videos" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'videos');

-- Politique de suppression (authentifié)
CREATE POLICY "Allow authenticated delete from videos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'videos');
```

## Structure des dossiers

Les fichiers seront organisés automatiquement dans les dossiers suivants :

- `images/actions/` - Images des actions
- `images/reports/` - Images des rapports
- `images/news/` - Images des actualités
- `images/team/` - Photos des membres de l'équipe
- `images/videos/` - Vignettes des vidéos
- `files/reports/` - Fichiers PDF des rapports

## Instructions de création

1. Allez dans votre tableau de bord Supabase
2. Cliquez sur **Storage** dans le menu de gauche
3. Cliquez sur **"New bucket"**
4. Entrez le nom du bucket (ex: `images`)
5. Cochez **"Public bucket"**
6. Cliquez sur **"Create bucket"**
7. Allez dans **SQL Editor**
8. Exécutez les politiques SQL correspondantes (voir ci-dessus)
9. Répétez pour chaque bucket

## Alternative : Bucket unique

Si vous préférez utiliser un seul bucket pour tout :

1. Créez un bucket `uploads` (public)
2. Les fichiers seront organisés automatiquement dans des sous-dossiers
3. Utilisez les mêmes politiques en remplaçant `images` ou `files` par `uploads`

## Vérification

Après configuration :
1. Testez l'upload d'une image dans l'interface admin
2. Vérifiez que le fichier apparaît dans le bucket correspondant
3. Vérifiez que l'URL générée est accessible publiquement

## Notes importantes

- Les fichiers sont nommés avec un timestamp pour éviter les conflits
- La taille maximale par défaut est de 5MB pour les images et 10MB pour les fichiers
- Vous pouvez modifier ces limites dans les composants `ImageUpload.tsx` et `FileUpload.tsx`
- Les utilisateurs peuvent toujours entrer une URL manuellement si nécessaire

