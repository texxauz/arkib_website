-- Migration 013: Capex classification + startup recovery tracking

-- 1. Capex flag on expenses (excludes capital items from operating P&L)
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS is_capex boolean NOT NULL DEFAULT false;

-- 2. Startup recovery obligations (configurable by owner)
CREATE TABLE IF NOT EXISTS public.startup_recovery_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  item_type     text NOT NULL CHECK (item_type IN ('fitout','supplier_arrears','founder_remuneration','working_capital','other')),
  original_amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount     numeric(12,2) NOT NULL DEFAULT 0,
  notes         text,
  is_active     boolean NOT NULL DEFAULT true,
  display_order int     NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- 3. Founder remuneration accrual ledger (one row per month)
CREATE TABLE IF NOT EXISTS public.founder_remuneration_accruals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month          int  NOT NULL CHECK (month BETWEEN 1 AND 12),
  year           int  NOT NULL,
  accrual_amount numeric(12,2) NOT NULL DEFAULT 5000,
  paid_amount    numeric(12,2) NOT NULL DEFAULT 0,
  paid_date      date,
  notes          text,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (month, year)
);

-- 4. RLS
ALTER TABLE public.startup_recovery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_remuneration_accruals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_investor_read_startup_recovery" ON public.startup_recovery_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('owner','investor','manager')));

CREATE POLICY "owner_manage_startup_recovery" ON public.startup_recovery_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'));

CREATE POLICY "owner_investor_read_remuneration" ON public.founder_remuneration_accruals
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('owner','investor','manager')));

CREATE POLICY "owner_manage_remuneration" ON public.founder_remuneration_accruals
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'));

-- 5. Seed startup recovery items
INSERT INTO public.startup_recovery_items (name, item_type, original_amount, paid_amount, notes, display_order) VALUES
  ('Related-Party Fit-out Payable', 'fitout',          30000.00, 5000.00, 'Stained glass installation. RM30,000 total capex. RM5,000 paid Aug 2026. RM25,000 outstanding.', 1),
  ('Supplier Arrears',              'supplier_arrears', 20000.00, 0.00,   'Outstanding supplier invoices at inception. Update paid_amount as settled.',                     2),
  ('Working Capital Reserve',       'working_capital',  20000.00, 0.00,   'Minimum working capital before investor cash distributions become eligible.',                    3)
ON CONFLICT DO NOTHING;

-- 6. Seed founder remuneration accruals Feb–Aug 2026 (RM5,000/month combined)
INSERT INTO public.founder_remuneration_accruals (month, year, accrual_amount, paid_amount) VALUES
  (2, 2026, 5000.00, 0.00),
  (3, 2026, 5000.00, 0.00),
  (4, 2026, 5000.00, 0.00),
  (5, 2026, 5000.00, 0.00),
  (6, 2026, 5000.00, 0.00),
  (7, 2026, 5000.00, 0.00),
  (8, 2026, 5000.00, 0.00)
ON CONFLICT (month, year) DO NOTHING;

-- 7. Mark stained glass expense as capex so it is excluded from operating P&L.
--    REVIEW before running — verify the record first:
--    SELECT id, date, description, amount, category FROM expenses
--      WHERE description ILIKE '%stained%' OR description ILIKE '%glass%' OR amount = 5000;
--    Then uncomment and run:
-- UPDATE public.expenses SET is_capex = true
--   WHERE description ILIKE '%stained%glass%' AND amount = 5000;
