-- SQL script to update events and registrations for the ticket system

-- Add price column to events if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='price') THEN
        ALTER TABLE events ADD COLUMN price NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Add ticket_ref column to event_registrations if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='event_registrations' AND column_name='ticket_ref') THEN
        ALTER TABLE event_registrations ADD COLUMN ticket_ref TEXT UNIQUE;
    END IF;
END $$;

-- Function to generate a unique ticket reference before insertion
CREATE OR REPLACE FUNCTION generate_ticket_ref() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ticket_ref IS NULL THEN
        NEW.ticket_ref := 'DDB-' || UPPER(SUBSTRING(MD5(NEW.event_id::text || NEW.email || now()::text), 1, 8));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before each insert
DROP TRIGGER IF EXISTS tr_generate_ticket_ref ON event_registrations;
CREATE TRIGGER tr_generate_ticket_ref
BEFORE INSERT ON event_registrations
FOR EACH ROW
EXECUTE FUNCTION generate_ticket_ref();

-- Update existing registrations that don't have a ref
UPDATE event_registrations 
SET ticket_ref = 'DDB-' || UPPER(SUBSTRING(MD5(id::text || created_at::text), 1, 8)) 
WHERE ticket_ref IS NULL;
