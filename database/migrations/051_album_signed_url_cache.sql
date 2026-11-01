-- ==============================================================================
-- MIGRATION 051 : Cache des URLs signées des albums (bande passante)
-- ==============================================================================
-- Problème : une URL signée Supabase contient un jeton différent à chaque
-- signature. Si on signe à chaque ouverture de l'album, le navigateur ne
-- reconnaît jamais une image déjà téléchargée : un visiteur qui revient
-- re-télécharge toutes les miniatures (bande passante limitée sur le plan
-- gratuit).
--
-- Solution : chaque fichier est signé pour 7 jours et l'URL est mémorisée ici.
-- Tous les visiteurs reçoivent la MÊME URL pendant cette période :
--   - cache navigateur (fichiers immuables, max-age 1 an) → 0 octet re-téléchargé ;
--   - cache CDN de Supabase partagé entre visiteurs ;
--   - l'Edge Function ne re-signe presque jamais → réponse plus rapide.
-- L'URL est renouvelée automatiquement quand il lui reste moins de 2 jours.
--
-- Compromis assumé : une personne dont on retire l'accès garde pendant au plus
-- 7 jours les URLs qu'elle a déjà reçues (elle aurait pu aussi télécharger les
-- photos). Les nouvelles ouvertures de l'album lui sont refusées immédiatement.
--
-- Colonnes lisibles uniquement par le staff (RLS de event_media).
-- Prérequis : 049_event_albums.sql. Idempotent.
-- ==============================================================================

ALTER TABLE public.event_media
  ADD COLUMN IF NOT EXISTS signed_url TEXT,
  ADD COLUMN IF NOT EXISTS signed_thumb_url TEXT,
  ADD COLUMN IF NOT EXISTS signed_until TIMESTAMPTZ;

-- Mise à jour groupée en une requête : [{ id, url, thumb_url, until }, ...]
-- SECURITY INVOKER : la RLS s'applique (staff via l'admin, service role via l'Edge Function).
CREATE OR REPLACE FUNCTION public.store_event_media_signed_urls(p_rows jsonb)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.event_media m
  SET signed_url = x.url,
      signed_thumb_url = x.thumb_url,
      signed_until = x.until
  FROM jsonb_to_recordset(p_rows) AS x(id uuid, url text, thumb_url text, until timestamptz)
  WHERE m.id = x.id;
$$;

REVOKE EXECUTE ON FUNCTION public.store_event_media_signed_urls(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.store_event_media_signed_urls(jsonb) TO authenticated, service_role;
