-- ============================================================
-- 036 — NETTOYAGE SCHÉMA (audit 2026-09-10)
-- ============================================================
-- Basé sur les blocs 5 (colonnes mortes) et 7 (FK sans index)
-- du script database/AUDIT.sql.
--
-- PARTIE A : sûre, à exécuter maintenant.
-- PARTIE B : à décider (change des types / touche des données),
--            laissée en commentaire.
-- ============================================================


-- ─────────────────────────────────────────────────────────────
--  PARTIE A — SÛRE
-- ─────────────────────────────────────────────────────────────

-- A1. Table `discussions` : orpheline.
--     0 ligne, aucune référence dans le code (le chat utilise
--     `discussion_messages`). Vestige d'une 1re version.
DROP TABLE IF EXISTS public.discussions;

-- A2. Colonnes mortes de `documents` (table à 0 ligne).
--     Le code écrit `file_format` / `file_type` ; `format` et
--     `doc_type` sont des colonnes antérieures jamais utilisées.
ALTER TABLE public.documents DROP COLUMN IF EXISTS format;
ALTER TABLE public.documents DROP COLUMN IF EXISTS doc_type;

-- A3. Index manquants sur les clés étrangères (bloc 7).
--     Sans ça : JOIN lents + chaque DELETE parent scanne toute
--     la table enfant. (Tables minuscules ici : lock negligeable.)
CREATE INDEX IF NOT EXISTS idx_projects_partner_id
  ON public.projects(partner_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id
  ON public.notifications(actor_id);
CREATE INDEX IF NOT EXISTS idx_interview_schedules_created_by
  ON public.interview_schedules(created_by);
CREATE INDEX IF NOT EXISTS idx_discussion_messages_recipient_id
  ON public.discussion_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_discussion_messages_user_id
  ON public.discussion_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_event_feedbacks_event_id
  ON public.event_feedbacks(event_id);
CREATE INDEX IF NOT EXISTS idx_event_volunteers_event_id
  ON public.event_volunteers(event_id);
CREATE INDEX IF NOT EXISTS idx_sent_event_emails_event_id
  ON public.sent_event_emails(event_id);

-- A4. Bonus : filtre le plus fréquent de l'app (badge messages
--     non lus, rechargé en continu dans AdminLayout).
CREATE INDEX IF NOT EXISTS idx_discussion_messages_unread
  ON public.discussion_messages(recipient_id) WHERE is_read = false;

-- A5. Stats à jour (plusieurs tables n'ont jamais été analysées).
ANALYZE;


-- ─────────────────────────────────────────────────────────────
--  PARTIE B — À DÉCIDER (ne pas exécuter à l'aveugle)
-- ─────────────────────────────────────────────────────────────

-- B1. `donations.amount` est stocké en TEXT alors que
--     `events.price` est NUMERIC. Incohérent, empêche SUM().
--     Nécessite d'adapter DonationsAdmin.tsx (parse/format).
-- ALTER TABLE public.donations
--   ALTER COLUMN amount TYPE numeric USING NULLIF(regexp_replace(amount, '[^0-9.]', '', 'g'), '')::numeric;

-- B2. `videos.date` est TEXT alors que `news.date` est DATE.
--     Table à 0 ligne -> conversion sans risque de données,
--     mais VideoCard / data/videos.ts traitent `date` en string.
-- ALTER TABLE public.videos ALTER COLUMN date TYPE date USING date::date;

-- B3. `notifications` : le code (useNotifications) utilise la
--     colonne `read`. Vérifier qu'il n'existe pas AUSSI une
--     colonne `is_read` en doublon :
--       SELECT column_name FROM information_schema.columns
--       WHERE table_name='notifications' AND column_name IN ('read','is_read');
--     Si les deux existent -> garder `read`, DROP `is_read`,
--     et corriger l'INSERT dans src/components/Join.tsx (il
--     envoie `is_read: false`).

-- B4. `event_registrations.phone` : 0/515 renseignés. La colonne
--     est bien câblée (EventDetailPage) mais aucun événement
--     n'a de champ "téléphone" dans son form_fields. Soit
--     ajouter le champ, soit accepter la colonne vide. Ne PAS
--     supprimer (feature active).

-- B5. `news.image2` / `news.description` : 0/8 renseignés MAIS
--     CreateNewsPage les écrit. Ce sont les 8 articles existants
--     qui sont antérieurs. Colonnes à garder.
