-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Prevent duplicate registrations (same email + same event)
-- Run this script in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 1: Remove existing duplicates, keeping only the FIRST registration
-- (lowest id = earliest inscription)
DELETE FROM event_registrations
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY event_id, LOWER(TRIM(email))
             ORDER BY id ASC
           ) AS rn
    FROM event_registrations
    WHERE email IS NOT NULL
      AND email != ''
      AND email != 'visiteur@ong-ddb.org'
  ) ranked
  WHERE rn > 1
);

-- STEP 2: Add a partial unique index on (event_id, email)
-- Partial = only applies to real emails, not visitor placeholders
-- This is the database-level lock: even if two requests arrive simultaneously,
-- only ONE insert will succeed.
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_registration_email
  ON event_registrations (event_id, LOWER(TRIM(email)))
  WHERE email IS NOT NULL
    AND email != ''
    AND email != 'visiteur@ong-ddb.org';

-- Verify: should return 0 duplicates after running
SELECT event_id, LOWER(TRIM(email)) AS email, COUNT(*) AS cnt
FROM event_registrations
WHERE email IS NOT NULL
  AND email != ''
  AND email != 'visiteur@ong-ddb.org'
GROUP BY event_id, LOWER(TRIM(email))
HAVING COUNT(*) > 1;
