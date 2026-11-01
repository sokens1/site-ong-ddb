-- ==============================================================================
-- MIGRATION 050 : Liens d'album courts et lisibles
-- ==============================================================================
-- La clé du mode "Tous les utilisateurs disposant du lien" passe de 64
-- caractères hexadécimaux à 10 caractères :
--   /album/forum-jeunesse-2026?cle=k7mq2xpa9c
--
-- Alphabet de 32 caractères sans les signes ambigus à l'écrit comme à l'oral
-- (pas de l, o, 0 ni 1) : 10 caractères = 50 bits aléatoires, soit environ
-- un million de milliards de combinaisons — impossible à deviner, d'autant
-- que chaque essai passe par l'Edge Function.
--
-- Prérequis : 049_event_albums.sql. Idempotent.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.gen_short_key(p_len integer DEFAULT 10)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  alphabet constant text := 'abcdefghijkmnpqrstuvwxyz23456789'; -- 32 caractères
  b bytea;
  result text := '';
  i integer;
BEGIN
  WHILE length(result) < p_len LOOP
    b := uuid_send(gen_random_uuid());
    FOR i IN 0..15 LOOP
      -- Octets 6 et 8 d'un UUID v4 : bits de version/variante en partie fixes
      CONTINUE WHEN i IN (6, 8);
      EXIT WHEN length(result) >= p_len;
      -- & 31 : 5 bits aléatoires par caractère, sans biais (alphabet de 32)
      result := result || substr(alphabet, (get_byte(b, i) & 31) + 1, 1);
    END LOOP;
  END LOOP;
  RETURN result;
END;
$$;

ALTER TABLE public.event_albums
  ALTER COLUMN link_key SET DEFAULT public.gen_short_key(10);

-- Raccourcit les clés longues déjà créées (les anciens liens "?k=..." cessent
-- de fonctionner : à re-partager si des albums étaient déjà en mode lien).
UPDATE public.event_albums
SET link_key = public.gen_short_key(10), updated_at = now()
WHERE length(link_key) > 16;
