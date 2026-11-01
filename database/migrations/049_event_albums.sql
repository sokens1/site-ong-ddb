-- ==============================================================================
-- MIGRATION 049 : Albums photos & vidéos des événements (partage façon Drive)
-- ==============================================================================
-- Chaque événement peut avoir un album (photos + vidéos) consultable et
-- téléchargeable après l'événement. Le partage reprend le modèle de Google
-- Drive :
--   - "Personnes ayant accès" : emails ajoutés un par un (rôle Lecteur),
--     avec notification par email optionnelle ;
--   - "Accès général" : Limité / Participants inscrits / Participants présents
--     (billet scanné) / Tous les utilisateurs disposant du lien / Public ;
--   - "Les lecteurs peuvent télécharger" ;
--   - "Demander l'accès" pour les visiteurs refusés.
--
-- Les fichiers sont dans un bucket PRIVÉ (`event-albums`) : aucune URL n'est
-- devinable, tout passe par des URLs signées délivrées par l'Edge Function
-- `album-access` après vérification des droits (identité prouvée par un code
-- envoyé par email, comme la connexion Google exigée par Drive).
--
-- Réutilise public.get_my_claim_role() (fix-warnings.sql / #010).
-- Idempotent : peut être relancé sans casse.
-- ==============================================================================


-- ── 1. BUCKET PRIVÉ ─────────────────────────────────────────────────────────
-- 50 Mo max par fichier = limite du plan gratuit Supabase.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-albums', 'event-albums', false, 52428800,
  ARRAY['image/jpeg', 'image/webp', 'image/png', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Seuls admin / charge_communication manipulent les fichiers directement.
-- Les visiteurs n'ont AUCUNE policy : ils passent par des URLs signées.
DROP POLICY IF EXISTS "Album files: staff read" ON storage.objects;
CREATE POLICY "Album files: staff read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'event-albums' AND public.get_my_claim_role() IN ('admin', 'charge_communication'));

DROP POLICY IF EXISTS "Album files: staff upload" ON storage.objects;
CREATE POLICY "Album files: staff upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-albums' AND public.get_my_claim_role() IN ('admin', 'charge_communication'));

DROP POLICY IF EXISTS "Album files: staff update" ON storage.objects;
CREATE POLICY "Album files: staff update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'event-albums' AND public.get_my_claim_role() IN ('admin', 'charge_communication'))
WITH CHECK (bucket_id = 'event-albums' AND public.get_my_claim_role() IN ('admin', 'charge_communication'));

DROP POLICY IF EXISTS "Album files: staff delete" ON storage.objects;
CREATE POLICY "Album files: staff delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'event-albums' AND public.get_my_claim_role() IN ('admin', 'charge_communication'));


-- ── 2. PARAMÈTRES DE PARTAGE (1 ligne par événement) ────────────────────────
CREATE TABLE IF NOT EXISTS public.event_albums (
  event_id BIGINT PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  general_access TEXT NOT NULL DEFAULT 'restricted'
    CHECK (general_access IN ('restricted', 'participants', 'attendees', 'link', 'public')),
  allow_download BOOLEAN NOT NULL DEFAULT true,
  -- Clé secrète du mode "Tous les utilisateurs disposant du lien" (2 UUID v4 = 244 bits aléatoires)
  link_key TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ── 3. MÉDIAS ───────────────────────────────────────────────────────────────
-- Chemins dans le bucket : {event_id}/{media_id}/full.jpg | video.mp4 | thumb.webp
CREATE TABLE IF NOT EXISTS public.event_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
  path TEXT NOT NULL,
  thumb_path TEXT,                -- NULL si le navigateur n'a pas pu extraire d'image de la vidéo
  placeholder TEXT,               -- mini aperçu flouté (data URL ~500 octets) affiché instantanément
  width INTEGER,
  height INTEGER,
  duration REAL,                  -- secondes (vidéos)
  size_bytes BIGINT NOT NULL DEFAULT 0,   -- taille stockée (fichier + miniature)
  mime_type TEXT,
  original_name TEXT,
  caption TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_media_event_position
  ON public.event_media (event_id, position, created_at);


-- ── 4. PERSONNES AYANT ACCÈS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_album_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer')),
  invite_token_hash TEXT,         -- lien personnel envoyé par email (valable 30 jours)
  invite_expires_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  added_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, email)
);

CREATE INDEX IF NOT EXISTS idx_event_album_shares_invite
  ON public.event_album_shares (invite_token_hash) WHERE invite_token_hash IS NOT NULL;


-- ── 5. DEMANDES D'ACCÈS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_album_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  message TEXT CHECK (char_length(message) <= 500),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_album_requests_pending
  ON public.event_album_access_requests (event_id, email) WHERE status = 'pending';


-- ── 6. CODES DE VÉRIFICATION & SESSIONS VISITEURS ───────────────────────────
-- Accès service role uniquement (Edge Function) : RLS activée, aucune policy.
CREATE TABLE IF NOT EXISTS public.event_album_otps (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_album_otps_lookup
  ON public.event_album_otps (event_id, email, created_at DESC);

CREATE TABLE IF NOT EXISTS public.event_album_sessions (
  token_hash TEXT PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ── 7. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.event_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_album_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_album_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_album_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_album_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admin/comms manage event_albums" ON public.event_albums;
CREATE POLICY "Allow admin/comms manage event_albums" ON public.event_albums FOR ALL TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'charge_communication'));

DROP POLICY IF EXISTS "Allow admin/comms manage event_media" ON public.event_media;
CREATE POLICY "Allow admin/comms manage event_media" ON public.event_media FOR ALL TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'charge_communication'));

DROP POLICY IF EXISTS "Allow admin/comms manage event_album_shares" ON public.event_album_shares;
CREATE POLICY "Allow admin/comms manage event_album_shares" ON public.event_album_shares FOR ALL TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'charge_communication'));

DROP POLICY IF EXISTS "Allow admin/comms manage event_album_access_requests" ON public.event_album_access_requests;
CREATE POLICY "Allow admin/comms manage event_album_access_requests" ON public.event_album_access_requests FOR ALL TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'charge_communication'));


-- ── 8. FONCTIONS ────────────────────────────────────────────────────────────

-- Résumé public pour la carte "Album" de la page événement : uniquement des
-- compteurs, jamais d'email ni de chemin de fichier. Les albums en mode "lien"
-- restent invisibles (comme un fichier Drive partagé par lien).
CREATE OR REPLACE FUNCTION public.get_event_album_summary(p_event_id bigint)
RETURNS TABLE(general_access text, photo_count integer, video_count integer)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT a.general_access,
         count(*) FILTER (WHERE m.kind = 'image')::integer,
         count(*) FILTER (WHERE m.kind = 'video')::integer
  FROM public.event_albums a
  JOIN public.event_media m ON m.event_id = a.event_id
  WHERE a.event_id = p_event_id
    AND a.general_access <> 'link'
  GROUP BY a.general_access;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_album_summary(bigint) TO anon, authenticated;

-- Cet email a-t-il accès à l'album ? (personnes ajoutées + participants selon
-- le mode d'accès général). Appelée uniquement par l'Edge Function.
CREATE OR REPLACE FUNCTION public.album_email_has_access(p_event_id bigint, p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_mode text;
  v_email text := lower(trim(p_email));
BEGIN
  SELECT general_access INTO v_mode FROM public.event_albums WHERE event_id = p_event_id;
  IF v_mode IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM public.event_album_shares WHERE event_id = p_event_id AND email = v_email) THEN
    RETURN true;
  END IF;

  IF v_mode IN ('participants', 'attendees') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.event_registrations r
      WHERE r.event_id = p_event_id
        AND (lower(r.email) = v_email OR lower(r.custom_data->>'buyer_email') = v_email)
        AND (v_mode = 'participants' OR r.scanned_at IS NOT NULL)
    );
  END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.album_email_has_access(bigint, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.album_email_has_access(bigint, text) TO service_role;

-- Réordonnancement en un seul appel (glisser-déposer de l'admin).
-- SECURITY INVOKER : la RLS de event_media s'applique (staff uniquement).
CREATE OR REPLACE FUNCTION public.reorder_event_media(p_event_id bigint, p_ids uuid[])
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.event_media m
  SET position = o.ord::integer
  FROM unnest(p_ids) WITH ORDINALITY AS o(id, ord)
  WHERE m.id = o.id AND m.event_id = p_event_id;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_event_media(bigint, uuid[]) TO authenticated;

-- Occupation réelle du stockage Supabase par bucket (jauge du plan gratuit : 1 Go).
CREATE OR REPLACE FUNCTION public.get_storage_usage()
RETURNS TABLE(bucket_id text, total_bytes bigint, file_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, storage
AS $$
BEGIN
  -- coalesce : un visiteur non connecté a un rôle NULL, et NULL NOT IN (...) n'est pas vrai
  IF coalesce(public.get_my_claim_role(), '') NOT IN ('admin', 'charge_communication') THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
    SELECT o.bucket_id::text,
           coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint,
           count(*)::integer
    FROM storage.objects o
    GROUP BY o.bucket_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_storage_usage() TO authenticated;

-- Nettoyage des codes et sessions expirés (appelé en best-effort par l'Edge Function)
CREATE OR REPLACE FUNCTION public.cleanup_album_auth()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.event_album_otps WHERE expires_at < now() - interval '1 day';
  DELETE FROM public.event_album_sessions WHERE expires_at < now();
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_album_auth() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_album_auth() TO service_role;
