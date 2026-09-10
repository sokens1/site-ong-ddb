-- ============================================================
--  AUDIT COMPLET DE LA BASE — ONG DDB
--  100 % lecture seule. Aucune modification.
--  À coller dans Supabase → SQL Editor → Run.
--  Chaque bloc renvoie un résultat ; lance-les un par un
--  ou tout d'un coup (le dernier résultat s'affiche, scrolle
--  les onglets de résultats).
-- ============================================================

-- ── 1. INVENTAIRE DES TABLES : taille, lignes, RLS ──────────
SELECT
  t.table_name,
  c.reltuples::bigint                              AS lignes_estimees,
  pg_size_pretty(pg_total_relation_size(c.oid))    AS taille_totale,
  pg_size_pretty(pg_relation_size(c.oid))          AS taille_donnees,
  pg_size_pretty(pg_indexes_size(c.oid))           AS taille_index,
  c.relrowsecurity                                 AS rls_active,
  c.relforcerowsecurity                            AS rls_forcee
FROM information_schema.tables t
JOIN pg_class c     ON c.relname = t.table_name
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY pg_total_relation_size(c.oid) DESC;

-- ── 2. TABLES SANS RLS (faille potentielle) ────────────────
SELECT n.nspname AS schema, c.relname AS table_sans_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false
ORDER BY c.relname;

-- ── 3. TABLES SANS CLÉ PRIMAIRE ────────────────────────────
SELECT t.table_name AS table_sans_pk
FROM information_schema.tables t
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public' AND tc.table_name = t.table_name
      AND tc.constraint_type = 'PRIMARY KEY')
ORDER BY t.table_name;

-- ── 4. INVENTAIRE DES COLONNES (types, null, défauts) ──────
SELECT
  table_name,
  ordinal_position                AS pos,
  column_name,
  data_type
    || COALESCE('(' || character_maximum_length || ')', '') AS type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- ── 5. COLONNES 100 % NULL (candidates suppression / archaïsme) ─
-- Une seule requête, aucun copier-coller. Toute ligne avec
-- non_null = 0 et total > 0  =>  colonne morte, à supprimer.
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  (xpath('/row/c/text()', query_to_xml(
     format('SELECT count(%I) AS c FROM public.%I', c.column_name, c.table_name),
     false, true, '')))[1]::text::bigint AS non_null,
  (xpath('/row/c/text()', query_to_xml(
     format('SELECT count(*) AS c FROM public.%I', c.table_name),
     false, true, '')))[1]::text::bigint AS total
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.is_nullable = 'YES'
ORDER BY non_null ASC, c.table_name, c.column_name;

-- ── 6. TABLES SANS created_at / updated_at (traçabilité) ───
SELECT t.table_name,
       bool_or(c.column_name = 'created_at') AS a_created_at,
       bool_or(c.column_name = 'updated_at') AS a_updated_at
FROM information_schema.tables t
JOIN information_schema.columns c
  ON c.table_schema = t.table_schema AND c.table_name = t.table_name
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name
HAVING NOT bool_or(c.column_name = 'created_at')
ORDER BY t.table_name;

-- ── 7. CLÉS ÉTRANGÈRES SANS INDEX (lenteur JOIN + DELETE) ──
SELECT
  con.conrelid::regclass       AS table_enfant,
  a.attname                    AS colonne_fk,
  con.confrelid::regclass      AS table_parent
FROM pg_constraint con
JOIN pg_attribute a
  ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
WHERE con.contype = 'f'
  AND con.connamespace = 'public'::regnamespace
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = con.conrelid
      AND i.indkey[0] = a.attnum)   -- FK doit être la colonne de tête
ORDER BY table_enfant, colonne_fk;

-- ── 8. INDEX JAMAIS UTILISÉS (poids mort, ralentit les writes) ─
SELECT
  schemaname, relname AS table_name, indexrelname AS index_name,
  idx_scan AS nb_utilisations,
  pg_size_pretty(pg_relation_size(indexrelid)) AS taille
FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND idx_scan = 0
  AND indexrelid NOT IN (SELECT conindid FROM pg_constraint WHERE contype IN ('p','u'))
ORDER BY pg_relation_size(indexrelid) DESC;

-- ── 9. INDEX DUPLIQUÉS (même colonnes, redondants) ────────
SELECT
  indrelid::regclass AS table_name,
  array_agg(indexrelid::regclass) AS index_redondants
FROM pg_index
GROUP BY indrelid, indkey
HAVING count(*) > 1;

-- ── 10. BLOAT / VACUUM : lignes mortes non nettoyées ──────
SELECT
  relname AS table_name,
  n_live_tup AS lignes_vivantes,
  n_dead_tup AS lignes_mortes,
  CASE WHEN n_live_tup > 0
       THEN round(100.0 * n_dead_tup / n_live_tup, 1) ELSE 0 END AS pct_mortes,
  last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC;

-- ── 11. FONCTIONS SECURITY DEFINER (à auditer une par une) ─
SELECT
  p.proname AS fonction,
  pg_get_function_identity_arguments(p.oid) AS args,
  r.rolname AS proprietaire
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles r ON r.oid = p.proowner
WHERE n.nspname = 'public' AND p.prosecdef = true
ORDER BY p.proname;

-- ── 12. POLICIES RLS PAR TABLE (vue d'ensemble) ───────────
SELECT
  tablename,
  policyname,
  cmd        AS commande,
  roles,
  qual       AS condition_using,
  with_check AS condition_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- ── 13. TABLES SANS AUCUNE POLICY mais RLS ACTIVE (=verrou total) ─
SELECT c.relname AS table_rls_sans_policy
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true
  AND NOT EXISTS (SELECT 1 FROM pg_policies p
                  WHERE p.schemaname = 'public' AND p.tablename = c.relname)
ORDER BY c.relname;

-- ── 14. STOCKAGE : poids par bucket + nb de fichiers ──────
SELECT
  bucket_id,
  count(*)                                              AS nb_fichiers,
  pg_size_pretty(sum((metadata->>'size')::bigint))      AS poids_total,
  min(created_at)                                       AS plus_ancien,
  max(created_at)                                       AS plus_recent
FROM storage.objects
GROUP BY bucket_id
ORDER BY sum((metadata->>'size')::bigint) DESC NULLS LAST;

-- ── 15. LOGS / ANALYTICS : âge des données (rétention) ────
-- Adapte les noms de tables si besoin.
SELECT 'security_events' AS source,
       count(*) AS total,
       count(*) FILTER (WHERE created_at < now() - interval '90 days') AS plus_de_90j,
       min(created_at) AS plus_ancien
FROM public.security_events
UNION ALL
SELECT 'discussion_messages',
       count(*),
       count(*) FILTER (WHERE created_at < now() - interval '180 days'),
       min(created_at)
FROM public.discussion_messages
UNION ALL
SELECT 'site_visits',
       count(*),
       count(*) FILTER (WHERE visit_date < current_date - 365),
       min(visit_date)::timestamptz
FROM public.site_visits;

-- ── 16. DOUBLONS DE DONNÉES sur colonnes censées être uniques ─
-- Exemple newsletter (mêmes emails) — adapte à tes tables.
SELECT lower(email) AS email, count(*)
FROM public.newsletter_subscribers
GROUP BY lower(email) HAVING count(*) > 1;

-- ── 17. TAILLE GLOBALE DE LA BASE (quota 500 Mo free) ─────
SELECT pg_size_pretty(pg_database_size(current_database())) AS taille_base;


-- ── 18. FICHIERS STORAGE ORPHELINS (référencés nulle part) ─
-- Construit un "haystack" de toutes les colonnes qui stockent une
-- URL/chemin de fichier, puis liste les objets du storage dont le
-- `name` n'apparaît dans aucune de ces colonnes.
-- ⚠️ Si une colonne n'existe pas -> erreur "column X does not exist" :
--    commente la ligne fautive et relance.
WITH refs AS (
  SELECT string_agg(t, ' ') AS haystack FROM (
    SELECT coalesce(image,'')||' '||coalesce(image2,'')||' '||coalesce(content,'') AS t FROM public.news
    UNION ALL SELECT coalesce(filepath,'')||' '||coalesce(thumbnailpath,'')||' '||coalesce(videourl,'') FROM public.videos
    UNION ALL SELECT coalesce(image,'') FROM public.team_members
    UNION ALL SELECT coalesce(image_url,'')||' '||coalesce(document_url,'') FROM public.projects
    UNION ALL SELECT coalesce(document_url,'') FROM public.project_tasks
    UNION ALL SELECT coalesce(image,'')||' '||coalesce("fileUrl",'') FROM public.reports
    UNION ALL SELECT coalesce(image,'') FROM public.actions
    UNION ALL SELECT coalesce(file_url,'') FROM public.documents
    UNION ALL SELECT coalesce(avatar_url,'') FROM public.user_profiles
    UNION ALL SELECT coalesce(cv_url,'') FROM public.form_submissions
    UNION ALL SELECT coalesce(image_url,'')||' '||coalesce(logo_url,'')||' '||
                     coalesce(organizer_logos::text,'')||' '||coalesce(partner_logos::text,'')||' '||
                     coalesce(program::text,'')||' '||coalesce(form_fields::text,'')||' '||
                     coalesce(poster_template,'')||' '||coalesce(ticket_template,'')||' '||
                     coalesce(certificate_template,'') FROM public.events
  ) x
)
SELECT o.bucket_id, o.name,
       pg_size_pretty((o.metadata->>'size')::bigint) AS taille,
       o.created_at
FROM storage.objects o, refs
WHERE o.bucket_id IN ('ong-backend','ong-backend2','cv-uploads','thumbnails')
  AND position(o.name IN refs.haystack) = 0
ORDER BY (o.metadata->>'size')::bigint DESC NULLS LAST;


-- ── 19. Le bucket ong-backend2 est-il encore référencé ? ──
-- 0 partout => bucket mort, supprimable en entier.
WITH h AS (
  SELECT string_agg(t,' ') AS s FROM (
    SELECT coalesce(image,'')||coalesce(image2,'')||coalesce(content,'') t FROM public.news
    UNION ALL SELECT coalesce(image_url,'')||coalesce(document_url,'') FROM public.projects
    UNION ALL SELECT coalesce(image,'')||coalesce("fileUrl",'') FROM public.reports
    UNION ALL SELECT coalesce(image,'') FROM public.actions
    UNION ALL SELECT coalesce(image,'') FROM public.team_members
    UNION ALL SELECT coalesce(file_url,'') FROM public.documents
    UNION ALL SELECT coalesce(avatar_url,'') FROM public.user_profiles
    UNION ALL SELECT coalesce(image_url,'')||coalesce(logo_url,'')||coalesce(organizer_logos::text,'')||coalesce(partner_logos::text,'') FROM public.events
  ) x
)
SELECT (SELECT count(*) FROM storage.objects WHERE bucket_id='ong-backend2') AS fichiers_bucket2,
       (position('ong-backend2' IN (SELECT s FROM h)) > 0)                   AS encore_reference;
