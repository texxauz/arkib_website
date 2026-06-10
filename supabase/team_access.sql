-- ============================================================
-- TEAM ACCESS CONTROL
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add tab_permissions column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tab_permissions JSONB DEFAULT NULL;

-- Update role check to include bartender
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('owner', 'manager', 'staff', 'bartender'));

-- Set full permissions for existing owner/manager rows
UPDATE public.users SET tab_permissions = '{
  "dashboard": "edit",
  "sales": "edit",
  "expenses": "edit",
  "receipts": "edit",
  "inventory": "edit",
  "bar-inventory": "edit",
  "cocktails": "edit",
  "suppliers": "edit",
  "rent": "edit",
  "reports": "edit",
  "settings": "edit"
}'::jsonb
WHERE tab_permissions IS NULL AND role IN ('owner', 'manager');

-- Default bartender permissions (bar-inventory + sales only)
-- (applied when creating new bartender accounts)
