-- ============================================
-- FIX: CORRECTION DES ERREURS RLS (SUPABASE LINTER)
-- ============================================

-- 1. documents
-- Erreur: Policy Exists RLS Disabled, RLS Disabled in Public
ALTER TABLE IF EXISTS "public"."documents" ENABLE ROW LEVEL SECURITY;

-- 2. notifications
-- Erreur: Policy Exists RLS Disabled, RLS Disabled in Public
ALTER TABLE IF EXISTS "public"."notifications" ENABLE ROW LEVEL SECURITY;

-- 3. user_profiles
-- Erreur: Policy Exists RLS Disabled, RLS Disabled in Public
ALTER TABLE IF EXISTS "public"."user_profiles" ENABLE ROW LEVEL SECURITY;

-- 4. project_tasks
-- Erreur: RLS Disabled in Public (et probablement pas de politiques)
ALTER TABLE IF EXISTS "public"."project_tasks" ENABLE ROW LEVEL SECURITY;

-- Création des politiques manquantes pour project_tasks
DROP POLICY IF EXISTS "Allow authenticated users full access to project_tasks" ON "public"."project_tasks";

CREATE POLICY "Allow authenticated users full access to project_tasks"
ON "public"."project_tasks"
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 5. projects
-- Erreur: RLS Disabled in Public (et probablement pas de politiques)
ALTER TABLE IF EXISTS "public"."projects" ENABLE ROW LEVEL SECURITY;

-- Création des politiques manquantes pour projects
DROP POLICY IF EXISTS "Allow authenticated users full access to projects" ON "public"."projects";
DROP POLICY IF EXISTS "Allow public read access to projects" ON "public"."projects";

CREATE POLICY "Allow authenticated users full access to projects"
ON "public"."projects"
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public read access to projects"
ON "public"."projects"
FOR SELECT
TO public
USING (true);
