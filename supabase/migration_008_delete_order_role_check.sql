-- =============================================================================
-- MIGRATION 008: admin_delete_order — add DB-level role check
--
-- The API route (delete-order/route.ts) already checks owner/manager before
-- calling this RPC. This adds a matching check inside the SECURITY DEFINER
-- function so direct REST API calls cannot bypass the API layer.
--
-- Rollback: recreate without the role check (see migration_003_delete_order_rpc.sql)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_delete_order(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  IF v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Forbidden: owner or manager role required';
  END IF;

  DELETE FROM public.cocktail_sales  WHERE order_id = p_order_id;
  DELETE FROM public.pos_payments    WHERE order_id = p_order_id;
  DELETE FROM public.pos_order_items WHERE order_id = p_order_id;
  DELETE FROM public.pos_orders      WHERE id        = p_order_id;
END;
$$;
