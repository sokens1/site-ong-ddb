# Index des migrations SQL

Ces fichiers étaient auparavant éparpillés à la racine du projet, sans ordre
ni statut clair. Ils sont maintenant **numérotés dans leur ordre chronologique
réel** (déduit de l'historique Git) et classés ci-dessous par statut.

**Rien n'a été supprimé ni modifié** — un fichier peut documenter une policy
déjà appliquée en production ; le supprimer effacerait la trace de ce qui a
été fait. Seul le rangement a changé.

## Comment lire ce tableau

- **ACTIF** : reflète l'état actuellement voulu en base pour cette table/ressource.
- **REMPLACÉ PAR #NNN** : ce fichier a fait quelque chose d'utile en son temps,
  mais un fichier plus récent a redéfini les mêmes règles différemment. Ne pas
  le ré-exécuter tel quel sur une base à jour (il ne casse rien de grave — les
  `DROP POLICY IF EXISTS` sont idempotents — mais il referait les anciennes
  règles trop permissives).
- **PERMANENT** : ajoute une colonne, un index, une fonction, une table — ce
  type de changement ne se "remplace" pas, il s'accumule. Toujours valide.
- **DOC / RÉFÉRENCE** : pas du SQL exécutable, juste des instructions.
- **PONCTUEL** : opération de nettoyage de données ponctuelle (le `DELETE`
  n'a de sens qu'une fois), mais peut contenir une contrainte permanente à part.

| # | Fichier | Date | Rôle | Statut |
|---|---|---|---|---|
| 001 | `fix-storage-policies.sql` | 2025-09-19 | Policies du bucket `cv-uploads` (upload/lecture/suppression) | ⚠️ Suppression **remplacée par #030** (elle était ouverte à `public`, faille corrigée) |
| 002 | `supabase-rls-policies-admin.sql` | 2025-11-25 | Premières policies "authenticated = accès complet" sur plusieurs tables de contenu | ❌ REMPLACÉ PAR #010 |
| 003 | `storage-policies.sql` | 2025-11-26 | Doc de référence pour les policies du bucket `ong-backend` (commenté, à appliquer via Dashboard) | 📄 DOC / RÉFÉRENCE |
| 004 | `supabase-rls-complete-global.sql` | 2025-11-26 | Policies globales (actions, reports, videos, news, team, faq, contribution_types, form_submissions, newsletter_subscribers) + storage `ong-backend` | ⚠️ Policies de contenu REMPLACÉES PAR #010. Storage `ong-backend` : probablement toujours actif (à vérifier dans le Dashboard, aucun fichier ne l'a explicitement remplacé) |
| 005 | `supabase-rls-policies-complete.sql` | 2025-11-26 | Quasi-doublon de #004 | ⚠️ Voir #004 — vérifier lequel des deux a réellement été exécuté |
| 006 | `supabase-tables-documents-users.sql` | 2026-01-07 | Création des tables `documents` et `user_profiles` | ✅ PERMANENT (structure des tables) — policies REMPLACÉES PAR #010 |
| 007 | `supabase-news-update.sql` | 2026-01-15 | Ajout colonnes `description`/`status` sur `news` | ✅ PERMANENT |
| 008 | `edge-functions-brevo.sql` | 2026-02-26 | Instructions de configuration des secrets Brevo dans le Dashboard | 📄 DOC / RÉFÉRENCE |
| 009 | `fix-rls-errors.sql` | 2026-02-26 | Active RLS sur `documents`, corrige des erreurs remontées par le linter Supabase | ✅ PERMANENT (activation RLS) |
| 010 | `fix-warnings.sql` | 2026-02-26 | **Durcissement RLS par rôle** (`get_my_claim_role()`) sur documents, user_profiles, projects, project_tasks, news, videos, reports, actions, faq, team_members, newsletter_subscribers, form_submissions, contribution_types, notifications | ✅ **ACTIF** — source de vérité actuelle pour ces tables |
| 011 | `interview-schedule.sql` | 2026-02-26 | Création table `interview_schedules` + policy "authenticated = tout" | ✅ Table PERMANENTE — policy REMPLACÉE PAR #030 |
| 012 | `migration-v2.sql` | 2026-02-27 | Contraintes `form_submissions`, table `discussion_messages`, `site_visits` | ✅ PERMANENT |
| 013 | `newsletter_metrics.sql` | 2026-03-16 | Table `sent_newsletters` (historique d'envoi newsletter) | ✅ PERMANENT — **⚠️ à exécuter si pas encore fait** (404 constaté en prod à une session précédente) |
| 014 | `fix-events-rls.sql` | 2026-03-23 | Première version RLS `events`/`event_registrations` (accès complet authenticated) | ❌ REMPLACÉ PAR #030 |
| 015 | `schema_update_v3.sql` | 2026-03-23 | Création tables `donations`, `events` + policies initiales | ✅ Tables PERMANENTES — policies REMPLACÉES PAR #030 |
| 016 | `update_ticket_schema.sql` | 2026-04-04 | Ajout `price` sur events, colonnes billet sur `event_registrations` | ✅ PERMANENT |
| 017 | `fix-event-registrations-rls.sql` | 2026-06-26 | Re-création policies insert/read `event_registrations` | ❌ REMPLACÉ PAR #030 |
| 018 | `schema_update_v3_features.sql` | 2026-06-26 | Ajout `form_fields`/`feedback_config` sur events, `custom_data` sur registrations, table `event_feedbacks` | ✅ Structure PERMANENTE — policies feedbacks REMPLACÉES PAR #030 |
| 019 | `supabase_v3_update.sql` | 2026-06-26 | Quasi-doublon de #018 | ✅ Voir #018 |
| 020 | `db_indexes_performance.sql` | 2026-06-30 | Index de performance (events, registrations, etc.) | ✅ PERMANENT |
| 021 | `migration_REQUIRED.sql` | 2026-06-30 | Ajout `logo_url` sur events + autres colonnes billet | ✅ PERMANENT |
| 022 | `schema_update_v4_updates.sql` | 2026-06-30 | Ajout `event_dates` (JSONB, dates multiples) | ✅ PERMANENT |
| 023 | `add-event-slug.sql` | 2026-07-01 | Ajout `slug` personnalisé sur events + extension `unaccent` | ✅ PERMANENT |
| 024 | `fix-duplicate-registrations.sql` | 2026-07-01 | Nettoyage des doublons existants + index unique `(event_id, email)` | ✅ PERMANENT (l'index reste ; le nettoyage était ponctuel) |
| 025 | `fix-registrations-delete-rls.sql` | 2026-07-01 | Ajout policy DELETE sur `event_registrations` | ❌ REMPLACÉ PAR #030 |
| 026 | `get-registration-name.sql` | 2026-07-01 | Fonction `get_registration_name()` (récupération d'affiche "J'y serai") | ✅ PERMANENT, toujours utilisée |
| 027 | `schema_update_v6_multi_logos.sql` | 2026-07-01 | Ajout `organizer_logos`/`partner_logos` (JSONB) sur events | ✅ PERMANENT |
| 028 | `add-poster-enabled.sql` | 2026-07-02 | Ajout `poster_enabled` (BOOLEAN) sur events | ✅ PERMANENT |
| 029 | `event_volunteers.sql` | 2026-07-06 | Création tables `event_volunteers` + `sent_event_emails` | ✅ Tables PERMANENTES — policies REMPLACÉES PAR #030 |
| 030 | `security-hardening-2026.sql` | 2026-08-23 | **Durcissement RLS** events/registrations/volunteers/donations/feedbacks/interviews + storage `cv-uploads` + création `security_events` | ✅ **ACTIF** — source de vérité actuelle pour ces tables |
| 035 | `fix-form-submissions-rls.sql` | 2026-09-10 | **Correctif critique** : RLS était désactivé sur `form_submissions` (candidatures lisibles par tous). Réactive RLS + 4 policies (insert public, select/update/delete staff) | ✅ **ACTIF** — source de vérité pour `form_submissions` (remplace le volet correspondant de #010 qui n'avait pas été appliqué) |
| 036 | `cleanup_schema.sql` | 2026-09-10 | Nettoyage post-audit : DROP table orpheline `discussions`, DROP colonnes mortes `documents.format`/`doc_type`, 10 index sur FK non indexées, ANALYZE. Partie B (types `donations.amount`/`videos.date`) laissée en commentaire | ✅ PERMANENT (partie A) |
| 037 | `schema_types_and_notifications.sql` | 2026-09-10 | Partie B exécutable : fusion doublon `notifications.read`/`is_read` → `read` (NOT NULL + défaut + index partiel), `videos.date` TEXT→DATE. `donations.amount` : reste en TEXT (choix assumé). Corrige aussi les 2 `is_read` de `Join.tsx` | ✅ PERMANENT |
| 038 | `secure_site_visits.sql` | 2026-09-10 | **Correctif sécurité** : `site_visits` avait une policy `FOR ALL USING(true)` (anon pouvait tout lire/modifier/supprimer). RLS remis : lecture `authenticated` seule, écriture uniquement via `increment_visit()` (SECURITY DEFINER, `search_path` fixé). Fallback SQL direct retiré de `App.tsx` | ✅ **ACTIF** — source de vérité pour `site_visits` |

## En clair : où regarder pour savoir "qui a le droit de faire quoi" aujourd'hui

- **Contenu du site** (projets, actus, rapports, équipe, FAQ, documents, newsletter, candidatures) → **#010** (`fix-warnings.sql`)
- **Événements, inscriptions, volontaires, dons, avis, entretiens, mails groupés** → **#030** (`security-hardening-2026.sql`)
- **Stockage de fichiers** (`ong-backend`, `cv-uploads`) → **#001** + **#030** pour `cv-uploads` ; **#004 ou #005** pour `ong-backend` (à confirmer directement dans le Dashboard Supabase, voir note ci-dessous)

## ⚠️ Point à vérifier manuellement

Les fichiers #004 et #005 sont quasiment identiques et créent tous les deux
les policies du bucket `ong-backend`. Impossible de savoir depuis les fichiers
seuls lequel a réellement été exécuté en dernier. Va dans **Dashboard Supabase
→ Storage → ong-backend → Policies** pour voir l'état réel, et n'exécute
aucun des deux sans avoir vérifié d'abord.

## Convention pour les prochaines migrations

À partir de maintenant, tout nouveau changement de schéma va dans ce dossier
avec le numéro suivant (`031_...`, `032_...`), jamais à la racine du projet.
Un fichier = un changement cohérent, avec en en-tête un commentaire qui dit
clairement ce qu'il fait et s'il remplace un fichier précédent.
