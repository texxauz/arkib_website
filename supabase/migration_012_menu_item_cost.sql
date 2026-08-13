-- Add cost_price to menu_items for COGS tracking on non-cocktail items
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS cost_price numeric(10,4) NOT NULL DEFAULT 0;
