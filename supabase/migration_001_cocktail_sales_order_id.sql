-- =============================================================================
-- MIGRATION 001: Add order_id to cocktail_sales
-- Purpose: Allows reopen-order to correctly delete and reverse cocktail_sales
--          rows, preventing double-count on re-close.
-- Safe to re-run: uses IF NOT EXISTS / DO blocks.
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- Add order_id column with FK reference to pos_orders
ALTER TABLE public.cocktail_sales
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.pos_orders(id) ON DELETE SET NULL;

-- Index for fast lookup by order (used by reopen-order delete)
CREATE INDEX IF NOT EXISTS cocktail_sales_order_id_idx
  ON public.cocktail_sales(order_id);

-- Grant incremental_premix_serves floor fix: prevent negative sold_serves
-- (addresses L3 — increment_premix_serves missing floor at 0)
CREATE OR REPLACE FUNCTION public.increment_premix_serves(
  p_id    UUID,
  p_delta INTEGER
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.bar_premixes
  SET sold_serves = GREATEST(0, sold_serves + p_delta)
  WHERE id = p_id;
$$;
GRANT EXECUTE ON FUNCTION public.increment_premix_serves(UUID, INTEGER) TO authenticated;


-- =============================================================================
-- MIGRATION 002: Add database constraints for data integrity
-- Addresses L7 (pos_orders status), L8 (unit_price >= 0)
-- =============================================================================

-- Prevent invalid order status values at the database level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pos_orders_status_check'
  ) THEN
    ALTER TABLE public.pos_orders
      ADD CONSTRAINT pos_orders_status_check
      CHECK (status IN ('open', 'closed', 'voided'));
  END IF;
END $$;

-- Prevent negative unit prices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pos_order_items_unit_price_check'
  ) THEN
    ALTER TABLE public.pos_order_items
      ADD CONSTRAINT pos_order_items_unit_price_check
      CHECK (unit_price >= 0);
  END IF;
END $$;

-- Prevent table double-booking: only one order can be the "current" order per table
-- Uses a unique partial index (null values are excluded from unique constraints)
CREATE UNIQUE INDEX IF NOT EXISTS pos_tables_one_active_order
  ON public.pos_tables(current_order_id)
  WHERE current_order_id IS NOT NULL;


-- =============================================================================
-- MIGRATION 003: Performance indexes for POS tables
-- Addresses H6 — all POS tables currently have zero secondary indexes.
-- These are critical for report queries and will prevent performance degradation
-- as the database grows over months of operation.
-- =============================================================================

-- pos_orders: most frequently filtered columns
CREATE INDEX IF NOT EXISTS pos_orders_status_idx         ON public.pos_orders(status);
CREATE INDEX IF NOT EXISTS pos_orders_opened_at_idx      ON public.pos_orders(opened_at DESC);
CREATE INDEX IF NOT EXISTS pos_orders_shift_id_idx       ON public.pos_orders(shift_id);
CREATE INDEX IF NOT EXISTS pos_orders_server_id_idx      ON public.pos_orders(server_id);

-- pos_order_items: all item loads filter by order_id
CREATE INDEX IF NOT EXISTS pos_order_items_order_id_idx  ON public.pos_order_items(order_id);
CREATE INDEX IF NOT EXISTS pos_order_items_voided_at_idx ON public.pos_order_items(voided_at) WHERE voided_at IS NULL;

-- pos_payments: reopen-order and reports join on order_id
CREATE INDEX IF NOT EXISTS pos_payments_order_id_idx     ON public.pos_payments(order_id);

-- pos_audit_log: reports page queries by event type and date
CREATE INDEX IF NOT EXISTS pos_audit_log_event_idx       ON public.pos_audit_log(event, created_at DESC);
CREATE INDEX IF NOT EXISTS pos_audit_log_entity_idx      ON public.pos_audit_log(entity_type, entity_id);

-- cocktail_sales: analytics queries filter by date
-- (date index already exists from cocktail_sales.sql — order_id index added in migration 001)


-- =============================================================================
-- MIGRATION 004: Fix RLS policies
-- Addresses M4 — pos_config writable by all authenticated users
-- Addresses H5 (partial) — tighten RLS on financial config
-- =============================================================================

-- Fix pos_config: READ for all, WRITE only for owner/manager
-- Remove the overly permissive write policy and replace with role-gated one
DROP POLICY IF EXISTS "admin_write_pos_config" ON public.pos_config;

-- Role check via a SECURITY DEFINER function to avoid JWT claim inconsistency
CREATE OR REPLACE FUNCTION public.is_manager_or_owner()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('owner', 'manager')
    AND is_active = true
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_manager_or_owner() TO authenticated;

CREATE POLICY "manager_write_pos_config"
  ON public.pos_config
  FOR ALL
  TO authenticated
  USING (public.is_manager_or_owner())
  WITH CHECK (public.is_manager_or_owner());


-- =============================================================================
-- MIGRATION 005: Shift authorization
-- Addresses H7 — close-shift open-orders check scoped to shift
-- (The application-layer fix is in close-shift/route.ts — this migration
--  adds a helper function that the route can call safely.)
-- =============================================================================

-- Function to check whether all orders for a given shift are closed
-- Returns the count of open orders under that shift
CREATE OR REPLACE FUNCTION public.count_open_orders_for_shift(p_shift_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.pos_orders
  WHERE shift_id = p_shift_id
  AND status = 'open';
$$;
GRANT EXECUTE ON FUNCTION public.count_open_orders_for_shift(UUID) TO authenticated;
