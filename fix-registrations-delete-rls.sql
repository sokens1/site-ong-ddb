-- Fix : ajouter la politique DELETE manquante sur event_registrations
-- À exécuter dans Supabase > SQL Editor

-- Supprimer si déjà existante (idempotent)
DROP POLICY IF EXISTS "Allow authenticated to delete registrations" ON public.event_registrations;

-- Les utilisateurs authentifiés (admins) peuvent supprimer n'importe quelle inscription
CREATE POLICY "Allow authenticated to delete registrations"
ON public.event_registrations
FOR DELETE
TO authenticated
USING (true);
