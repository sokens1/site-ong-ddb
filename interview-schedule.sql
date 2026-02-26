-- =====================================================
-- Table: interview_schedules
-- Programmation d'entretiens pour les candidatures
-- =====================================================
-- Exécuter ce script dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS interview_schedules (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  interview_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  interview_type TEXT DEFAULT 'visio' CHECK (interview_type IN ('visio', 'presentiel')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_interview_submission ON interview_schedules(submission_id);
CREATE INDEX IF NOT EXISTS idx_interview_date ON interview_schedules(interview_date);

-- RLS (Row Level Security)
ALTER TABLE interview_schedules ENABLE ROW LEVEL SECURITY;

-- Politique: les utilisateurs authentifiés peuvent tout faire
CREATE POLICY "Authenticated users can manage interviews"
  ON interview_schedules
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_interview_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_interview_updated_at
  BEFORE UPDATE ON interview_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_interview_updated_at();
