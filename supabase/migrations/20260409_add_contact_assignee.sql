-- Add assignee column to contacts so each contact can have Owner / Manager / Assignee
-- (Owner is already represented by user_email; manager already exists; assignee is new.)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS assignee text;

-- Optional: index for fast filtering
CREATE INDEX IF NOT EXISTS contacts_assignee_idx ON contacts (assignee);
CREATE INDEX IF NOT EXISTS contacts_manager_idx ON contacts (manager);
