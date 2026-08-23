-- Vérifier et corriger les politiques RLS pour event_registrations
-- À exécuter dans Supabase > SQL Editor

-- Activer RLS
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Allow public to insert registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Allow authenticated to read registrations" ON public.event_registrations;

-- Permettre à tout le monde (y compris non connectés) de s'inscrire
CREATE POLICY "Allow public to insert registrations"
ON public.event_registrations
FOR INSERT
TO public
WITH CHECK (true);

-- Permettre aux admins connectés de lire les inscriptions
CREATE POLICY "Allow authenticated to read registrations"
ON public.event_registrations
FOR SELECT
TO authenticated
USING (true);
