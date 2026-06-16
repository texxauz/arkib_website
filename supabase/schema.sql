-- ============================================================
-- ARKIB BAR MANAGEMENT SYSTEM - Complete Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('owner', 'manager', 'staff');
CREATE TYPE salary_type AS ENUM ('hourly', 'fixed');
CREATE TYPE payment_method AS ENUM ('cash', 'credit_card', 'qr_payment', 'online', 'bank_transfer', 'other');
CREATE TYPE expense_category AS ENUM (
  'alcohol', 'fresh_ingredients', 'garnish', 'food', 'equipment',
  'repair', 'cleaning', 'marketing', 'salary', 'rental', 'utilities', 'others'
);
CREATE TYPE stock_movement_type AS ENUM ('added', 'used', 'wasted', 'adjusted');
CREATE TYPE fixed_cost_status AS ENUM ('paid', 'unpaid', 'overdue');
CREATE TYPE profit_distribution_status AS ENUM ('retained', 'paid_out');

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'staff',
  avatar_url TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- EMPLOYEES
-- ============================================================

CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  salary_type salary_type NOT NULL DEFAULT 'hourly',
  hourly_rate DECIMAL(10,2),
  fixed_monthly_salary DECIMAL(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- ATTENDANCE
-- ============================================================

CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  hours_worked DECIMAL(5,2),
  is_public_holiday BOOLEAN NOT NULL DEFAULT false,
  ph_multiplier DECIMAL(3,1) DEFAULT 1.0,
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SALARY RECORDS
-- ============================================================

CREATE TABLE public.salary_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  total_hours DECIMAL(8,2),
  normal_hours DECIMAL(8,2),
  ph_hours DECIMAL(8,2),
  base_salary DECIMAL(10,2) NOT NULL,
  ph_bonus DECIMAL(10,2) DEFAULT 0,
  deductions DECIMAL(10,2) DEFAULT 0,
  total_salary DECIMAL(10,2) NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  payment_method payment_method,
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SALES CATEGORIES
-- ============================================================

CREATE TABLE public.sales_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#8B5CF6',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default sales categories
INSERT INTO public.sales_categories (name, color, sort_order) VALUES
  ('Cocktails', '#8B5CF6', 1),
  ('Beer', '#F59E0B', 2),
  ('Wine', '#EF4444', 3),
  ('Food', '#10B981', 4),
  ('Others', '#6B7280', 5);

-- ============================================================
-- DAILY SALES
-- ============================================================

CREATE TABLE public.daily_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  cocktails_revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
  beer_revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
  wine_revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
  food_revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
  others_revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_revenue DECIMAL(10,2) GENERATED ALWAYS AS (
    cocktails_revenue + beer_revenue + wine_revenue + food_revenue + others_revenue
  ) STORED,
  cash_collected DECIMAL(10,2) NOT NULL DEFAULT 0,
  credit_card_collected DECIMAL(10,2) NOT NULL DEFAULT 0,
  qr_collected DECIMAL(10,2) NOT NULL DEFAULT 0,
  online_collected DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_collected DECIMAL(10,2) GENERATED ALWAYS AS (
    cash_collected + credit_card_collected + qr_collected + online_collected
  ) STORED,
  is_balanced BOOLEAN GENERATED ALWAYS AS (
    ABS((cocktails_revenue + beer_revenue + wine_revenue + food_revenue + others_revenue) -
        (cash_collected + credit_card_collected + qr_collected + online_collected)) < 0.01
  ) STORED,
  transaction_count INTEGER DEFAULT 0,
  notes TEXT,
  attachment_url TEXT,
  entered_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- SUPPLIERS
-- ============================================================

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  category expense_category,
  payment_terms TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- EXPENSES
-- ============================================================

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  expense_period DATE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  category expense_category NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method payment_method NOT NULL,
  receipt_url TEXT,
  notes TEXT,
  entered_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- expense_period: the month this cost should be attributed to for P&L purposes
-- (accrual basis). Defaults to `date` (cash/payment basis) when left null.

-- ============================================================
-- RECEIPTS
-- ============================================================

CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  ocr_extracted BOOLEAN DEFAULT false,
  ocr_supplier_name TEXT,
  ocr_date DATE,
  ocr_amount DECIMAL(10,2),
  ocr_raw_text TEXT,
  uploaded_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INGREDIENTS
-- ============================================================

CREATE TABLE public.ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'spirits',
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  unit TEXT NOT NULL DEFAULT 'ml',
  bottle_size_ml DECIMAL(10,2),
  cost_per_bottle DECIMAL(10,2),
  cost_per_unit DECIMAL(10,2) GENERATED ALWAYS AS (
    CASE WHEN bottle_size_ml > 0 THEN cost_per_bottle / bottle_size_ml ELSE NULL END
  ) STORED,
  current_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
  min_stock_level DECIMAL(10,2) DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- COCKTAILS
-- ============================================================

CREATE TABLE public.cocktails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  selling_price DECIMAL(10,2) NOT NULL,
  garnish_cost DECIMAL(10,2) DEFAULT 0,
  ice_cost DECIMAL(10,2) DEFAULT 0,
  other_cost DECIMAL(10,2) DEFAULT 0,
  total_cost DECIMAL(10,2),
  gross_profit DECIMAL(10,2),
  profit_margin DECIMAL(5,2),
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_on_menu BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- COCKTAIL RECIPES
-- ============================================================

CREATE TABLE public.cocktail_recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cocktail_id UUID NOT NULL REFERENCES public.cocktails(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity_ml DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cocktail_id, ingredient_id)
);

-- ============================================================
-- INVENTORY
-- ============================================================

CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  movement_type stock_movement_type NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  reference_id UUID,
  notes TEXT,
  recorded_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FIXED COSTS
-- ============================================================

CREATE TABLE public.fixed_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'rental',
  amount DECIMAL(10,2) NOT NULL,
  due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
  is_recurring BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- RENTAL RECORDS (monthly tracking of fixed costs)
-- ============================================================

CREATE TABLE public.rental_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fixed_cost_id UUID NOT NULL REFERENCES public.fixed_costs(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status fixed_cost_status NOT NULL DEFAULT 'unpaid',
  due_date DATE,
  paid_date DATE,
  payment_method payment_method,
  receipt_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PARTNERS
-- ============================================================

CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  ownership_percentage DECIMAL(5,2) NOT NULL CHECK (ownership_percentage > 0 AND ownership_percentage <= 100),
  email TEXT,
  phone TEXT,
  join_date DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- PROFIT DISTRIBUTION
-- ============================================================

CREATE TABLE public.profit_distribution (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  total_revenue DECIMAL(10,2) NOT NULL,
  total_expenses DECIMAL(10,2) NOT NULL,
  net_profit DECIMAL(10,2) NOT NULL,
  ownership_percentage DECIMAL(5,2) NOT NULL,
  partner_share DECIMAL(10,2) NOT NULL,
  status profit_distribution_status NOT NULL DEFAULT 'retained',
  paid_date DATE,
  payment_method payment_method,
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REPORTS
-- ============================================================

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_type TEXT NOT NULL,
  title TEXT NOT NULL,
  month INTEGER CHECK (month BETWEEN 1 AND 12),
  year INTEGER,
  date_from DATE,
  date_to DATE,
  data JSONB,
  file_url TEXT,
  generated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MONTHLY TARGETS
-- ============================================================

CREATE TABLE public.monthly_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  revenue_target DECIMAL(10,2) NOT NULL,
  expense_budget DECIMAL(10,2),
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(month, year)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_daily_sales_date ON public.daily_sales(date);
CREATE INDEX idx_expenses_date ON public.expenses(date);
CREATE INDEX idx_expenses_category ON public.expenses(category);
CREATE INDEX idx_attendance_employee ON public.attendance(employee_id);
CREATE INDEX idx_attendance_date ON public.attendance(date);
CREATE INDEX idx_inventory_ingredient ON public.inventory(ingredient_id);
CREATE INDEX idx_salary_records_employee ON public.salary_records(employee_id);
CREATE INDEX idx_salary_records_period ON public.salary_records(year, month);
CREATE INDEX idx_rental_records_period ON public.rental_records(year, month);
CREATE INDEX idx_profit_distribution_period ON public.profit_distribution(year, month);
CREATE INDEX idx_cocktail_recipes_cocktail ON public.cocktail_recipes(cocktail_id);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_daily_sales_updated_at BEFORE UPDATE ON public.daily_sales FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_ingredients_updated_at BEFORE UPDATE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_cocktails_updated_at BEFORE UPDATE ON public.cocktails FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_fixed_costs_updated_at BEFORE UPDATE ON public.fixed_costs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- COCKTAIL COST CALCULATION FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_cocktail_cost(cocktail_uuid UUID)
RETURNS TABLE(total_cost DECIMAL, gross_profit DECIMAL, profit_margin DECIMAL) AS $$
DECLARE
  v_selling_price DECIMAL;
  v_ingredient_cost DECIMAL;
  v_garnish_cost DECIMAL;
  v_ice_cost DECIMAL;
  v_other_cost DECIMAL;
  v_total DECIMAL;
BEGIN
  SELECT c.selling_price, c.garnish_cost, c.ice_cost, c.other_cost
  INTO v_selling_price, v_garnish_cost, v_ice_cost, v_other_cost
  FROM public.cocktails c WHERE c.id = cocktail_uuid;

  SELECT COALESCE(SUM(cr.quantity_ml * i.cost_per_unit), 0)
  INTO v_ingredient_cost
  FROM public.cocktail_recipes cr
  JOIN public.ingredients i ON i.id = cr.ingredient_id
  WHERE cr.cocktail_id = cocktail_uuid;

  v_total := v_ingredient_cost + COALESCE(v_garnish_cost, 0) + COALESCE(v_ice_cost, 0) + COALESCE(v_other_cost, 0);

  total_cost := v_total;
  gross_profit := v_selling_price - v_total;
  profit_margin := CASE WHEN v_selling_price > 0 THEN ((v_selling_price - v_total) / v_selling_price * 100) ELSE 0 END;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cocktails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cocktail_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profit_distribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_targets ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID)
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = user_uuid;
$$ LANGUAGE sql SECURITY DEFINER;

-- USERS policies
CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Owner can view all users" ON public.users FOR SELECT USING (get_user_role(auth.uid()) = 'owner');
CREATE POLICY "Owner can manage users" ON public.users FOR ALL USING (get_user_role(auth.uid()) = 'owner');
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- DAILY SALES policies
CREATE POLICY "Owner and manager can view sales" ON public.daily_sales FOR SELECT
  USING (get_user_role(auth.uid()) IN ('owner', 'manager'));
CREATE POLICY "Owner and manager can manage sales" ON public.daily_sales FOR ALL
  USING (get_user_role(auth.uid()) IN ('owner', 'manager'));

-- EXPENSES policies
CREATE POLICY "Owner and manager can view expenses" ON public.expenses FOR SELECT
  USING (get_user_role(auth.uid()) IN ('owner', 'manager'));
CREATE POLICY "Owner and manager can manage expenses" ON public.expenses FOR ALL
  USING (get_user_role(auth.uid()) IN ('owner', 'manager'));

-- EMPLOYEES policies
CREATE POLICY "Owner and manager can view employees" ON public.employees FOR SELECT
  USING (get_user_role(auth.uid()) IN ('owner', 'manager'));
CREATE POLICY "Owner can manage employees" ON public.employees FOR ALL
  USING (get_user_role(auth.uid()) = 'owner');
CREATE POLICY "Staff can view own employee record" ON public.employees FOR SELECT
  USING (user_id = auth.uid());

-- ATTENDANCE policies
CREATE POLICY "Owner and manager can view all attendance" ON public.attendance FOR SELECT
  USING (get_user_role(auth.uid()) IN ('owner', 'manager'));
CREATE POLICY "Staff can view own attendance" ON public.attendance FOR SELECT
  USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));
CREATE POLICY "Staff can clock in/out" ON public.attendance FOR INSERT
  WITH CHECK (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));
CREATE POLICY "Owner and manager can manage attendance" ON public.attendance FOR ALL
  USING (get_user_role(auth.uid()) IN ('owner', 'manager'));

-- SALARY policies (owner only)
CREATE POLICY "Owner can manage salary" ON public.salary_records FOR ALL
  USING (get_user_role(auth.uid()) = 'owner');

-- COCKTAILS, INGREDIENTS, RECIPES, INVENTORY policies
CREATE POLICY "All authenticated users can view cocktails" ON public.cocktails FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner and manager can manage cocktails" ON public.cocktails FOR ALL USING (get_user_role(auth.uid()) IN ('owner', 'manager'));
CREATE POLICY "All authenticated users can view ingredients" ON public.ingredients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner and manager can manage ingredients" ON public.ingredients FOR ALL USING (get_user_role(auth.uid()) IN ('owner', 'manager'));
CREATE POLICY "All authenticated users can view recipes" ON public.cocktail_recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner and manager can manage recipes" ON public.cocktail_recipes FOR ALL USING (get_user_role(auth.uid()) IN ('owner', 'manager'));
CREATE POLICY "Owner and manager can view inventory" ON public.inventory FOR SELECT USING (get_user_role(auth.uid()) IN ('owner', 'manager'));
CREATE POLICY "Owner and manager can manage inventory" ON public.inventory FOR ALL USING (get_user_role(auth.uid()) IN ('owner', 'manager'));

-- FIXED COSTS, RENTAL, PARTNERS, PROFIT (owner only)
CREATE POLICY "Owner can manage fixed costs" ON public.fixed_costs FOR ALL USING (get_user_role(auth.uid()) = 'owner');
CREATE POLICY "Owner can manage rental records" ON public.rental_records FOR ALL USING (get_user_role(auth.uid()) = 'owner');
CREATE POLICY "Owner can manage partners" ON public.partners FOR ALL USING (get_user_role(auth.uid()) = 'owner');
CREATE POLICY "Owner can manage profit distribution" ON public.profit_distribution FOR ALL USING (get_user_role(auth.uid()) = 'owner');
CREATE POLICY "Owner can manage suppliers" ON public.suppliers FOR ALL USING (get_user_role(auth.uid()) IN ('owner', 'manager'));
CREATE POLICY "Manager can view suppliers" ON public.suppliers FOR SELECT USING (get_user_role(auth.uid()) IN ('owner', 'manager'));
CREATE POLICY "Owner can manage reports" ON public.reports FOR ALL USING (get_user_role(auth.uid()) = 'owner');
CREATE POLICY "Owner can manage targets" ON public.monthly_targets FOR ALL USING (get_user_role(auth.uid()) = 'owner');
CREATE POLICY "Owner and manager can view receipts" ON public.receipts FOR SELECT USING (get_user_role(auth.uid()) IN ('owner', 'manager'));
CREATE POLICY "Owner and manager can manage receipts" ON public.receipts FOR ALL USING (get_user_role(auth.uid()) IN ('owner', 'manager'));
CREATE POLICY "Owner can view sales categories" ON public.sales_categories FOR SELECT TO authenticated USING (true);
