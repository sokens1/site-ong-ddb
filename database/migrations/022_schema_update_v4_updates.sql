-- ============================================
-- MIGRATION: MULTI-DATES & LOGO FOR EVENTS
-- ============================================

-- 1. Add event_dates column to store multiple dates/times as an array of JSON objects
-- Example structure of each item: {"date": "2026-06-28T23:30", "label": "Jour 1"}
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_dates JSONB DEFAULT '[]'::jsonb;

-- 2. Add logo_url column to store optional event logo
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 3. Add scanned_at column to event_registrations to prevent double scanning
ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ;

