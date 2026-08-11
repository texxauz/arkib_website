-- =============================================================================
-- MIGRATION 010: Inventory revert RPCs — add DB-level role check
--
-- decrement_premix_serves, increment_spirit_bottles, decrement_spirit_ml are
-- SECURITY DEFINER functions callable by any authenticated user via Supabase REST.
-- The API routes (delete-order, reopen-order) already check owner/manager/pos_perm.
-- This adds a matching guard inside each function body as defence-in-depth.
--
-- Rollback: recreate without role check (see supabase/inventory_revert_rpcs.sql)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.decrement_premix_serves(
  p_id    UUID,
  p_delta INTEGER
)
RETURNS void
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
  UPDATE public.bar_premixes
  SET sold_serves = GREATEST(0, sold_serves - p_delta)
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_spirit_bottles(
  p_id    UUID,
  p_delta INTEGER
)
RETURNS void
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
  UPDATE public.bar_spirits
  SET full_bottles = full_bottles + p_delta
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_spirit_ml(
  p_id UUID,
  p_ml NUMERIC
)
RETURNS void
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
  UPDATE public.bar_spirits
  SET used_classics_ml = GREATEST(0, used_classics_ml - p_ml)
  WHERE id = p_id;
END;
$$;
