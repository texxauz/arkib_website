-- =============================================================================
-- ARKIB OS Security Fixes
-- Run this entire file in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE / DO blocks
-- =============================================================================


-- -----------------------------------------------------------------------------
-- FIX 1: Prevent duplicate open shifts (race condition)
-- Two staff members opening a shift simultaneously would create two open shifts.
-- This unique partial index makes the second INSERT fail at the database level.
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS pos_shifts_one_open
  ON public.pos_shifts (status)
  WHERE status = 'open';


-- -----------------------------------------------------------------------------
-- FIX 2: Atomic premix inventory deduction
-- Replaces read-modify-write (race-prone) with a single atomic SQL UPDATE.
-- Called by close-order route for house_cocktail category items.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_premix_serves(
  p_id    UUID,
  p_delta INTEGER
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.bar_premixes
  SET sold_serves = sold_serves + p_delta
  WHERE id = p_id;
$$;


-- -----------------------------------------------------------------------------
-- FIX 3: Atomic spirit bottle deduction (wine / whisky full bottles)
-- Floor at 0 so stock never goes negative.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decrement_spirit_bottles(
  p_id    UUID,
  p_delta INTEGER
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.bar_spirits
  SET full_bottles = GREATEST(0, full_bottles - p_delta)
  WHERE id = p_id;
$$;


-- -----------------------------------------------------------------------------
-- FIX 4: Atomic spirit ml accumulation (classic cocktails)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_spirit_ml(
  p_id UUID,
  p_ml NUMERIC
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.bar_spirits
  SET used_classics_ml = used_classics_ml + p_ml
  WHERE id = p_id;
$$;


-- -----------------------------------------------------------------------------
-- FIX 5: Hashed manager PINs
--
-- The manager_pin column currently stores PINs as plain text.
-- This migration adds a manager_pin_hash column (bcrypt) and keeps the legacy
-- column temporarily so no functionality breaks while you migrate.
--
-- STEPS AFTER RUNNING THIS SQL:
--   1. In your Next.js app, install bcryptjs:
--        npm install bcryptjs
--        npm install --save-dev @types/bcryptjs
--   2. Run the Node script below to backfill hashed PINs:
--        node supabase/hash_pins.js
--   3. After verifying all PINs work, remove the .eq('manager_pin', ...) queries
--      and replace them with bcrypt.compare() checks against manager_pin_hash.
--   4. Drop the plain-text column: ALTER TABLE users DROP COLUMN manager_pin;
--
-- The hash_pins.js script is created in this same PR.
-- -----------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS manager_pin_hash TEXT;


-- -----------------------------------------------------------------------------
-- FIX 6: Grant EXECUTE on new RPCs to authenticated users
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.increment_premix_serves(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_spirit_bottles(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_spirit_ml(UUID, NUMERIC) TO authenticated;
