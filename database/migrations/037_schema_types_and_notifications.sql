-- ============================================================
-- 037 — PARTIE B DE L'AUDIT : types & doublon notifications
-- ============================================================
-- Fait suite à 036 (partie A). Ici on touche des TYPES de
-- colonnes et on résout le doublon read / is_read.
--
-- ⚠️ La "Partie B" écrite dans le fichier 036 est en COMMENTAIRE
--    (lignes préfixées `--`). La coller dans le SQL Editor
--    n'exécute RIEN. C'EST CE FICHIER 037 qu'il faut exécuter.
--
-- À lancer bloc par bloc. Chaque bloc est idempotent.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- B3 — notifications : UNE seule colonne « read »
-- ────────────────────────────────────────────────────────────
-- src/hooks/useNotifications.ts lit/écrit `read`.
-- src/components/Join.tsx insérait `is_read` (2 endroits, corrigés
-- côté code en même temps que cette migration).
-- Ce bloc converge vers `read` quel que soit l'état de départ.

DO $$
DECLARE
  has_read    boolean;
  has_is_read boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='notifications'
                   AND column_name='read')    INTO has_read;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='notifications'
                   AND column_name='is_read') INTO has_is_read;

  IF has_read AND has_is_read THEN
    EXECUTE 'UPDATE public.notifications
               SET read = COALESCE(read, is_read, false)
             WHERE read IS NULL';
    EXECUTE 'ALTER TABLE public.notifications DROP COLUMN is_read';
    RAISE NOTICE 'notifications: is_read fusionné dans read puis supprimé.';

  ELSIF has_is_read AND NOT has_read THEN
    EXECUTE 'ALTER TABLE public.notifications RENAME COLUMN is_read TO read';
    RAISE NOTICE 'notifications: is_read renommé en read.';

  ELSIF has_read AND NOT has_is_read THEN
    RAISE NOTICE 'notifications: déjà OK (colonne read seule).';

  ELSE
    RAISE EXCEPTION 'notifications: ni read ni is_read — schéma inattendu, stop.';
  END IF;
END $$;

-- Normalise : NOT NULL + défaut false + index partiel des non-lues
UPDATE public.notifications SET read = false WHERE read IS NULL;
ALTER TABLE public.notifications ALTER COLUMN read SET DEFAULT false;
ALTER TABLE public.notifications ALTER COLUMN read SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications(user_id) WHERE read = false;


-- ────────────────────────────────────────────────────────────
-- B2 — videos.date : TEXT → DATE
-- ────────────────────────────────────────────────────────────
-- Cohérence avec news.date (déjà DATE). Table videos = 0 ligne,
-- conversion sans risque de données. PostgREST renvoie une date
-- en 'YYYY-MM-DD' (string JSON) -> le front continue de marcher.
-- Le USING nettoie tout texte parasite, met NULL si non parsable.

ALTER TABLE public.videos
  ALTER COLUMN date TYPE date
  USING (NULLIF(regexp_replace(date, '[^0-9-]', '', 'g'), '')::date);


-- ────────────────────────────────────────────────────────────
-- B1 — donations.amount : TEXT → NUMERIC   ❌ NON RECOMMANDÉ
-- ────────────────────────────────────────────────────────────
-- `amount` vient d'un <input> texte libre du formulaire public
-- de don (Join.tsx / DonationForm) : « 50000 », « 50 000 FCFA »,
-- « environ 100k »… Nulle part le code ne fait de SUM() ni de
-- calcul dessus — il est seulement affiché « {amount} FCFA ».
-- Passer en NUMERIC = imposer une validation sur un formulaire
-- grand public pour zéro bénéfice. On GARDE le TEXT.
--
-- Si un jour besoin de reporting chiffré, colonne dédiée sans
-- casser la saisie libre :
--   ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS amount_num numeric;
--   UPDATE public.donations
--     SET amount_num = NULLIF(regexp_replace(amount,'[^0-9.]','','g'),'')::numeric
--     WHERE amount_num IS NULL AND amount IS NOT NULL;
