-- Events log table
CREATE TABLE IF NOT EXISTS events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  event_date  date NOT NULL,
  revenue     numeric(10,2) NOT NULL DEFAULT 0,
  cost        numeric(10,2) NOT NULL DEFAULT 0,
  notes       text,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Owner/manager: full access
CREATE POLICY "events_admin" ON events
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner','manager'))
  );

-- Others: read-only (non-deleted)
CREATE POLICY "events_read" ON events
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid())
  );
