CREATE TABLE IF NOT EXISTS purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  brand text,
  quantity numeric(10,2) NOT NULL,
  unit text NOT NULL DEFAULT 'bottles',
  urgency text NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent')),
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'ordered', 'received')),
  requested_by uuid NOT NULL REFERENCES users(id),
  reviewed_by uuid REFERENCES users(id),
  review_notes text,
  ordered_by uuid REFERENCES users(id),
  received_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;

-- Owners and managers have full access
CREATE POLICY "pr_admin_all" ON purchase_requests
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'manager'))
  );

-- Full timers can view all requests and insert their own
CREATE POLICY "pr_full_timer_select" ON purchase_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'full_timer')
  );

CREATE POLICY "pr_full_timer_insert" ON purchase_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'full_timer')
    AND requested_by = auth.uid()
  );
