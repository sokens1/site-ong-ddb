-- ============================================================
-- SQL PERFORMANCE MIGRATION: DATABASE INDEXES
-- ============================================================

-- 1. Index on events status and date to speed up public listings and sorting
CREATE INDEX IF NOT EXISTS idx_events_status_date 
ON public.events(status, event_date DESC);

-- 2. Index on event registrations to speed up ticket retrieval and validation
CREATE INDEX IF NOT EXISTS idx_event_registrations_lookup 
ON public.event_registrations(event_id, email, fullname);

-- 3. Index on news status and date to speed up homepage blog loading
CREATE INDEX IF NOT EXISTS idx_news_status_date 
ON public.news(status, date DESC);

-- 4. Index on videos date for communication page
CREATE INDEX IF NOT EXISTS idx_videos_date 
ON public.videos(date DESC);
