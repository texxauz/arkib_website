-- ============================================================
-- ARKIB POS SYSTEM — Phase 2A
-- ============================================================

-- Pre-flight: document columns that exist in production but were missing from SQL source
ALTER TABLE public.cocktail_sales
  ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE public.bar_spirits
  ADD COLUMN IF NOT EXISTS min_bottles INT NOT NULL DEFAULT 0;

-- ============================================================
-- POS CONFIGURATION
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pos_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.pos_config (key, value) VALUES
  ('service_charge_pct', '10'),
  ('service_charge_enabled', 'false'),
  ('tax_pct', '0'),
  ('tax_enabled', 'false'),
  ('currency', 'MYR')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- FLOOR PLAN
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pos_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  section TEXT NOT NULL,
  capacity INT NOT NULL DEFAULT 4,
  pos_x NUMERIC(5,2) DEFAULT 20,
  pos_y NUMERIC(5,2) DEFAULT 20,
  shape TEXT DEFAULT 'rect',
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  current_order_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SHIFTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pos_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by UUID NOT NULL REFERENCES auth.users(id),
  closed_by UUID REFERENCES auth.users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_float NUMERIC(10,2) NOT NULL DEFAULT 0,
  closing_cash NUMERIC(10,2),
  expected_cash NUMERIC(10,2),
  variance NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT
);

-- ============================================================
-- ORDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pos_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID REFERENCES public.pos_shifts(id),
  table_id UUID REFERENCES public.pos_tables(id) ON DELETE SET NULL,
  table_name TEXT,
  section TEXT,
  server_id UUID NOT NULL REFERENCES auth.users(id),
  server_name TEXT,
  covers INT DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open',
  subtotal NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  discount_label TEXT,
  service_charge NUMERIC(10,2) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
);

-- FK back from pos_tables to current order
ALTER TABLE public.pos_tables
  ADD CONSTRAINT fk_current_order
  FOREIGN KEY (current_order_id) REFERENCES public.pos_orders(id) ON DELETE SET NULL;

-- ============================================================
-- ORDER ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pos_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id UUID,
  item_name TEXT NOT NULL,
  category TEXT,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  unit_cost NUMERIC(10,2) DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  modifiers TEXT[],
  notes TEXT,
  status TEXT DEFAULT 'pending',
  kds_sent_at TIMESTAMPTZ,
  made_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES auth.users(id),
  void_reason TEXT,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PAYMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pos_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.pos_orders(id),
  method TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  reference TEXT,
  captured_at TIMESTAMPTZ DEFAULT now(),
  captured_by UUID REFERENCES auth.users(id)
);

-- ============================================================
-- DISCOUNTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pos_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'percent',
  value NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false
);

INSERT INTO public.pos_discounts (name, type, value, requires_approval) VALUES
  ('Staff Discount', 'percent', 20, false),
  ('VIP', 'percent', 10, false),
  ('Promotion', 'percent', 15, false),
  ('Complimentary', 'percent', 100, true),
  ('Manager Discount', 'percent', 30, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- RESERVATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pos_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  covers INT NOT NULL DEFAULT 2,
  section TEXT,
  table_id UUID REFERENCES public.pos_tables(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'confirmed',
  occasion TEXT,
  notes TEXT,
  order_id UUID REFERENCES public.pos_orders(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pos_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  actor_name TEXT,
  event TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.pos_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_pos_config" ON public.pos_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_pos_config" ON public.pos_config FOR ALL TO authenticated USING (true);

CREATE POLICY "auth_all_pos_tables" ON public.pos_tables FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_all_pos_shifts" ON public.pos_shifts FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_all_pos_orders" ON public.pos_orders FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_all_pos_order_items" ON public.pos_order_items FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_read_pos_payments" ON public.pos_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_pos_payments" ON public.pos_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_all_pos_discounts" ON public.pos_discounts FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_all_pos_reservations" ON public.pos_reservations FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_read_pos_audit" ON public.pos_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_pos_audit" ON public.pos_audit_log FOR INSERT TO authenticated WITH CHECK (true);
