-- =============================================================================
-- MIGRATION 002: Complete manager PIN hashing
-- PIN column was added in security_fixes.sql but never populated.
-- This migration must be run AFTER the Next.js hash_pins.js script has been run
-- to backfill manager_pin_hash for all existing users.
--
-- STEPS:
--   1. Run this SQL (adds column if not already present — safe to re-run)
--   2. Run: node supabase/hash_pins.js   (backfills hashes)
--   3. After verifying all PINs work via /api/pos/verify-manager-pin, run Part B
--      below to drop the plain-text column.
-- =============================================================================

-- Part A — ensure the hash column exists (idempotent)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS manager_pin_hash TEXT;

-- -----------------------------------------------------------------------
-- Part B — drop plain-text column (run ONLY after completing PIN migration)
-- Uncomment and run separately after verifying hashed PINs work end-to-end.
-- -----------------------------------------------------------------------
-- ALTER TABLE public.users DROP COLUMN IF EXISTS manager_pin;
