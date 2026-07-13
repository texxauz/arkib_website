-- =============================================================================
-- Inventory Revert RPCs
-- Run in Supabase SQL Editor after security_fixes.sql
-- Used by delete-order and reopen-order to atomically reverse inventory
-- =============================================================================

-- Decrement premix sold_serves (floor at 0)
CREATE OR REPLACE FUNCTION public.decrement_premix_serves(
  p_id    UUID,
  p_delta INTEGER
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.bar_premixes
  SET sold_serves = GREATEST(0, sold_serves - p_delta)
  WHERE id = p_id;
$$;

-- Increment spirit full_bottles (restore bottles when reverting)
CREATE OR REPLACE FUNCTION public.increment_spirit_bottles(
  p_id    UUID,
  p_delta INTEGER
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.bar_spirits
  SET full_bottles = full_bottles + p_delta
  WHERE id = p_id;
$$;

-- Decrement spirit used_classics_ml (floor at 0)
CREATE OR REPLACE FUNCTION public.decrement_spirit_ml(
  p_id UUID,
  p_ml NUMERIC
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.bar_spirits
  SET used_classics_ml = GREATEST(0, used_classics_ml - p_ml)
  WHERE id = p_id;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_premix_serves(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_spirit_bottles(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_spirit_ml(UUID, NUMERIC) TO authenticated;
