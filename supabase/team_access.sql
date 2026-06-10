-- ============================================================
-- TEAM ACCESS CONTROL
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add tab_permissions column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tab_permissions JSONB DEFAULT NULL;

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
