-- =============================================================================
-- MIGRATION 006: Clock PIN hashing
--
-- APPLY IN THIS ORDER:
--   1. Run this file (adds clock_pin_hash column — safe to re-run)
--   2. node supabase/hash_clock_pins.js   (backfills bcrypt hashes)
--   3. Deploy the code that uses clock_pin_hash for verification
--   4. Verify kiosk clock-in/out still works end-to-end
--   5. Run Part B below to drop the plain-text column
--
-- Part A — add hash column (idempotent)
-- =============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS clock_pin_hash TEXT;

-- =============================================================================
-- Part B — drop plain-text column (run ONLY after completing hash migration)
-- Uncomment and run separately after verifying hashed PINs work end-to-end.
-- Rollback: ALTER TABLE public.users ADD COLUMN clock_pin TEXT;
--           (data is gone — restore from backup taken before running Part B)
-- =============================================================================
-- ALTER TABLE public.users DROP COLUMN IF EXISTS clock_pin;
