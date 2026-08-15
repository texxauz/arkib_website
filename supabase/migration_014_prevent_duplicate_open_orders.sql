-- Migration 014: Prevent duplicate open orders per table
--
-- Race condition: open-order checks current_order_id then inserts separately.
-- Two simultaneous requests (e.g. double-tap) can both pass the check before
-- either updates pos_tables.current_order_id, creating two open orders for
-- the same physical table.
--
-- Fix: partial unique index on pos_orders(table_id) WHERE status = 'open'.
-- The DB rejects the second insert with a unique constraint violation, which
-- the API returns as a 409. table_id IS NOT NULL guard allows multiple
-- concurrent walk-in (tableId = null) orders.

CREATE UNIQUE INDEX IF NOT EXISTS pos_orders_one_open_per_table
  ON public.pos_orders (table_id)
  WHERE status = 'open' AND table_id IS NOT NULL;
