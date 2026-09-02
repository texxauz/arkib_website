CREATE TABLE IF NOT EXISTS payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month text NOT NULL, -- 'YYYY-MM'
  employment_type text NOT NULL, -- 'full_time' | 'part_time'
  basic_pay numeric(10,2) NOT NULL DEFAULT 0,
  hours_worked numeric(8,2), -- null for full_time
  hourly_rate numeric(8,2), -- null for full_time
  deductions jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{label, amount}]
  deductions_total numeric(10,2) NOT NULL DEFAULT 0,
  net_pay numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'draft', -- 'draft' | 'published'
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, month)
);

ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;

-- Owner/manager: full access
CREATE POLICY "payroll_admin" ON payroll_records
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner','manager'))
  );

-- Staff: view only their own published records
CREATE POLICY "payroll_own" ON payroll_records
  FOR SELECT USING (
    user_id = auth.uid() AND status = 'published'
  );
