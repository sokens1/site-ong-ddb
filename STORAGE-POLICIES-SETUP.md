# Configuration des Politiques Storage pour ong-backend

## ⚠️ IMPORTANT : Utilisez UNIQUEMENT l'Interface Supabase

**Le script SQL ne peut PAS être exécuté directement** car il nécessite des permissions de propriétaire sur les tables système. Vous devez utiliser l'interface Supabase Dashboard.

## Méthode : Via l'Interface Supabase (SEULE MÉTHODE DISPONIBLE)

### Étapes détaillées :

1. **Accédez au bucket**
   - Allez dans Supabase Dashboard
   - Cliquez sur **Storage** dans le menu de gauche
   - Cliquez sur le bucket **ong-backend**

2. **Accédez aux politiques**
   - Dans la page du bucket, cliquez sur l'onglet **"Policies"** (en haut)

3. **Créez la première politique : Upload (INSERT)**
   - Cliquez sur **"New Policy"**
   - Choisissez **"Create a policy from scratch"** ou **"For full customization"**
   - Configurez :
     - **Policy name**: `Allow authenticated upload to ong-backend`
     - **Allowed operation**: `INSERT`
     - **Target roles**: `authenticated`
     - **USING expression**: `bucket_id = 'ong-backend'`
     - **WITH CHECK expression**: `bucket_id = 'ong-backend'`
   - Cliquez sur **"Review"** puis **"Save policy"**

4. **Créez la deuxième politique : Lecture publique (SELECT)**
   - Cliquez sur **"New Policy"**
   - Configurez :
     - **Policy name**: `Allow public read from ong-backend`
     - **Allowed operation**: `SELECT`
     - **Target roles**: `public`
     - **USING expression**: `bucket_id = 'ong-backend'`
   - Cliquez sur **"Review"** puis **"Save policy"**

5. **Créez la troisième politique : Suppression (DELETE)**
   - Cliquez sur **"New Policy"**
   - Configurez :
     - **Policy name**: `Allow authenticated delete from ong-backend`
     - **Allowed operation**: `DELETE`
     - **Target roles**: `authenticated`
     - **USING expression**: `bucket_id = 'ong-backend'`
   - Cliquez sur **"Review"** puis **"Save policy"**

## Méthode 2 : Via SQL Editor (Si vous avez les permissions)

Si vous avez les permissions nécessaires, vous pouvez exécuter le script dans `storage-policies.sql`.

## Vérification

Après avoir créé les politiques, testez l'upload d'un fichier dans l'interface admin. L'erreur "new row violates row-level security policy" ne devrait plus apparaître.

