ALTER TABLE payroll_records
  ADD COLUMN IF NOT EXISTS claims jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS claims_total numeric(10,2) NOT NULL DEFAULT 0;
