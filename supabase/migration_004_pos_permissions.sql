-- Add pos_permissions JSONB column to users table
-- Controls granular POS actions per staff member
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pos_permissions JSONB DEFAULT '{}'::jsonb;

-- Default structure (all false for existing staff)
-- {
--   "reopen_order": false,
--   "delete_order": false,
--   "apply_approval_discounts": false,
--   "close_any_table": false
-- }
