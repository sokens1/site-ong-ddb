-- ============================================
-- FIX: RE-ENABLE RLS AND POLICIES FOR EVENTS
-- ============================================
-- Use this if events are not appearing on the public view.

-- 1. Ensure RLS is enabled on events
ALTER TABLE IF EXISTS public.events ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow public read access to events" ON public.events;
DROP POLICY IF EXISTS "Allow authenticated users full access to events" ON public.events;

-- 3. Re-create public read access
CREATE POLICY "Allow public read access to events" 
ON public.events FOR SELECT TO public USING (true);

-- 4. Re-create admin full access
CREATE POLICY "Allow authenticated users full access to events" 
ON public.events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Ensure registrations RLS
ALTER TABLE IF EXISTS public.event_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public to insert registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Allow authenticated users to read registrations" ON public.event_registrations;

CREATE POLICY "Allow public to insert registrations" 
ON public.event_registrations FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read registrations" 
ON public.event_registrations FOR SELECT TO authenticated USING (true);

-- 6. Grant sequence usage just in case (optional but safe)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
