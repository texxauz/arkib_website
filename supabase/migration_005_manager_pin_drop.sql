-- =============================================================================
-- MIGRATION 005: Drop plain-text manager_pin column
--
-- PREREQUISITES — apply in this order:
--   1. migration_002_pin_hashing.sql (Part A) — adds manager_pin_hash column
--   2. node supabase/hash_pins.js            — backfills bcrypt hashes
--   3. Deploy the code that removes the plain-text fallback
--   4. Verify manager PIN login still works end-to-end
--   5. THEN run this file to drop the plain-text column
--
-- Rollback: ALTER TABLE public.users ADD COLUMN manager_pin TEXT;
--           (data is gone — restore from a backup taken before step 5)
-- =============================================================================

ALTER TABLE public.users DROP COLUMN IF EXISTS manager_pin;
