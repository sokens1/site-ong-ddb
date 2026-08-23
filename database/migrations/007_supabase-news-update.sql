-- Script SQL pour mettre à jour la table news
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- Ajouter la colonne description si elle n'existe pas
ALTER TABLE IF EXISTS public.news 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Ajouter la colonne status (brouillon ou publié) si elle n'existe pas
ALTER TABLE IF EXISTS public.news 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published'));

-- Mettre à jour les enregistrements existants pour avoir un status par défaut 'published'
UPDATE public.news 
SET status = 'published' 
WHERE status IS NULL;
