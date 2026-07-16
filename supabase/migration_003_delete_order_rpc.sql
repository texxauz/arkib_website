-- Migration 003: admin_delete_order RPC + pos_payments DELETE RLS
-- Run in Supabase SQL Editor.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. admin_delete_order RPC
--    Called by delete-order/route.ts to cascade-delete an order and all its
--    child rows while bypassing client-side RLS (SECURITY DEFINER).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_delete_order(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete child rows first (FK order matters)
  DELETE FROM cocktail_sales  WHERE order_id = p_order_id;
  DELETE FROM pos_payments    WHERE order_id = p_order_id;
  DELETE FROM pos_order_items WHERE order_id = p_order_id;
  DELETE FROM pos_orders      WHERE id        = p_order_id;
END;
$$;

-- Only authenticated users can call this RPC; role check is in the API layer.
REVOKE ALL ON FUNCTION admin_delete_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_order(UUID) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. pos_payments DELETE RLS policy
--    reopen-order needs to delete payments so they can be re-entered on close.
--    Restrict to managers/owners (same auth check as the API layer).
-- ─────────────────────────────────────────────────────────────────────────────
-- Ensure RLS is enabled on pos_payments
ALTER TABLE pos_payments ENABLE ROW LEVEL SECURITY;

-- Drop any conflicting policy first (idempotent)
DROP POLICY IF EXISTS "managers_delete_payments" ON pos_payments;

CREATE POLICY "managers_delete_payments" ON pos_payments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('owner', 'manager')
    )
  );
