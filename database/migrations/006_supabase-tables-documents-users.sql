-- ============================================
-- TABLE: documents
-- ============================================
-- Table pour stocker les documents de la plateforme

CREATE TABLE IF NOT EXISTS public.documents (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_documents_updated_at_trigger
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();

-- Activer RLS (Row Level Security)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre l'accès complet aux utilisateurs authentifiés
CREATE POLICY "Allow authenticated users full access to documents"
ON public.documents
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- TABLE: user_profiles
-- ============================================
-- Table pour stocker les profils utilisateurs avec leurs rôles

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'membre' CHECK (role IN ('admin', 'charge_communication', 'chef_projet', 'partenaire', 'membre')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ajouter les colonnes si elles n'existent pas déjà (pour les tables existantes)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'email') THEN
    ALTER TABLE public.user_profiles ADD COLUMN email TEXT;
    UPDATE public.user_profiles SET email = (SELECT email FROM auth.users WHERE auth.users.id = user_profiles.id) WHERE email IS NULL;
    ALTER TABLE public.user_profiles ALTER COLUMN email SET NOT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'is_active') THEN
    ALTER TABLE public.user_profiles ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON public.user_profiles(created_at DESC);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at_trigger
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();

-- Activer RLS (Row Level Security)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre l'accès complet aux utilisateurs authentifiés
CREATE POLICY "Allow authenticated users full access to user_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- NOTES IMPORTANTES
-- ============================================
-- 1. Pour le module Documents :
--    - Les fichiers doivent être uploadés dans le bucket 'ong-backend' dans le dossier 'documents'
--    - Assurez-vous que les politiques RLS pour le bucket Storage sont configurées
--
-- 2. Pour le module Utilisateurs :
--    - Cette table complète la table auth.users de Supabase
--    - Les rôles disponibles sont : admin, charge_communication, chef_projet, partenaire, membre
--    - La création d'utilisateurs nécessite les permissions admin de Supabase (supabase.auth.admin)
--
-- 3. Permissions requises :
--    - Pour créer/modifier/supprimer des utilisateurs, vous devez utiliser l'API Admin de Supabase
--    - Assurez-vous que votre clé API Supabase a les permissions nécessaires
--
-- 4. Pour tester :
--    - Insérez quelques documents de test dans la table documents
--    - Créez quelques utilisateurs via l'interface admin et vérifiez qu'ils apparaissent dans user_profiles


