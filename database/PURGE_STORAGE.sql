-- ============================================================
--  PURGE DES FICHIERS STORAGE ORPHELINS  (opération ponctuelle)
-- ============================================================
--  À lancer dans Supabase → SQL Editor.
--
--  Principe : on construit un "haystack" avec toutes les colonnes
--  de la base qui contiennent une URL/chemin de fichier, puis on
--  vise les objets du storage dont le `name` n'apparaît nulle part.
--
--  Garde-fous :
--   - uniquement les buckets listés
--   - uniquement les fichiers de plus de 30 jours
--   - jamais les .emptyFolderPlaceholder
--
--  ⚠️ Fais TOUJOURS l'ÉTAPE 1 (aperçu) avant l'ÉTAPE 2 (suppression).
--  Si une colonne n'existe pas -> "column X does not exist" :
--  commente la ligne fautive dans le bloc `refs` et relance.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
--  ÉTAPE 1 — APERÇU : ce qui SERA supprimé (n'efface rien)
-- ══════════════════════════════════════════════════════════════
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
  AND o.name NOT LIKE '%.emptyFolderPlaceholder'
  AND o.created_at < now() - interval '30 days'
ORDER BY (o.metadata->>'size')::bigint DESC NULLS LAST;


-- ══════════════════════════════════════════════════════════════
--  ÉTAPE 2 — SUPPRESSION
-- ══════════════════════════════════════════════════════════════
--  ❌ Impossible en SQL : Supabase bloque `DELETE FROM storage.objects`
--     (trigger storage.protect_delete → "Use the Storage API instead").
--
--  ✅ Utiliser le script Node qui passe par l'API Storage :
--
--     scripts/purge-storage.mjs
--
--  Il recalcule les orphelins avec la MÊME logique que l'ÉTAPE 1
--  (haystack + garde-fou 30 jours), affiche la liste (dry-run),
--  puis supprime avec --delete. Voir l'en-tête du script.


-- ══════════════════════════════════════════════════════════════
--  ÉTAPE 3 — CONTRÔLE : nouveau poids par bucket
-- ══════════════════════════════════════════════════════════════
-- SELECT bucket_id, count(*) AS nb,
--        pg_size_pretty(sum((metadata->>'size')::bigint)) AS poids
-- FROM storage.objects GROUP BY bucket_id ORDER BY 3 DESC;
