-- ============================================================
-- TEAM ACCESS CONTROL
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add tab_permissions column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tab_permissions JSONB DEFAULT NULL;

-- Add bartender to the user_role enum (safe to run even if already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'bartender'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
    ALTER TYPE user_role ADD VALUE 'bartender';
  END IF;
END $$;

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
