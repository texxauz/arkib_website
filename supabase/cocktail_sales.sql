-- ============================================================
-- COCKTAIL SALES TABLE
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cocktail_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  cocktail_name TEXT NOT NULL,
  cocktail_id UUID REFERENCES public.cocktails(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_revenue NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  total_cogs NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  gross_profit NUMERIC(10,2) GENERATED ALWAYS AS (quantity * (unit_price - unit_cost)) STORED,
  logged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cocktail_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_cocktail_sales" ON public.cocktail_sales FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS cocktail_sales_date_idx ON public.cocktail_sales(date);
