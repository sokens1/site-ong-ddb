-- Fonction : vérifier l'inscription d'un participant et retourner son nom
-- SECURITY DEFINER : bypass RLS, s'exécute avec les droits du propriétaire
-- À exécuter dans Supabase > SQL Editor

CREATE OR REPLACE FUNCTION public.get_registration_name(
  p_event_id bigint,
  p_email    text
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(TRIM(fullname), ''),
    (SELECT value::text
     FROM jsonb_each_text(COALESCE(custom_data, '{}'::jsonb))
     LIMIT 1),
    p_email
  )
  FROM public.event_registrations
  WHERE event_id = p_event_id
    AND LOWER(email) = LOWER(TRIM(p_email))
  LIMIT 1;
$$;

-- Autoriser l'appel depuis le client anon (public)
GRANT EXECUTE ON FUNCTION public.get_registration_name(bigint, text) TO anon, authenticated;
