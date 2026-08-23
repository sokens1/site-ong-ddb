# Base de données — ONG DDB

Tout ce qui concerne le schéma Supabase (tables, policies RLS, index,
fonctions) vit ici, plus aucun fichier `.sql` ne traîne à la racine du projet.

## Structure

- **`migrations/`** — historique complet des migrations SQL, numérotées dans
  l'ordre chronologique réel. Voir **[migrations/INDEX.md](migrations/INDEX.md)**
  pour savoir quel fichier fait quoi et lequel est la source de vérité actuelle
  pour chaque table.
- **`INSTALL_EMAILS.md`** — configuration Brevo (billets, newsletter).
- **`GOOGLE_MAIL_SETUP_LEGACY.md`** — ancienne méthode d'envoi via Google Apps
  Script, **remplacée** par le canal Gmail OAuth2 (`supabase/functions/send-event-email`).
  Conservé pour référence historique uniquement.

## Comment appliquer une migration

1. Ouvre le fichier concerné dans `migrations/`.
2. Colle son contenu dans **Dashboard Supabase → SQL Editor** → Run.
3. Pour une nouvelle migration, crée `NNN_description.sql` (numéro suivant)
   dans `migrations/` et ajoute une ligne dans `migrations/INDEX.md`.

## Où trouver les règles d'accès actuelles (RLS)

Ne devine pas en lisant tous les fichiers un par un — **`migrations/INDEX.md`**
liste explicitement, pour chaque table, quel fichier fait foi aujourd'hui.
