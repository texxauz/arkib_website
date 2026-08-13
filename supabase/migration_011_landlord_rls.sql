-- =============================================================================
-- MIGRATION 011: Investor read access for Landlord P&L view
--
-- Grants investor role SELECT-only access to:
--   - rental_records  (authoritative rental payment records per period)
--   - fixed_costs     (recurring cost definitions — names/amounts only)
--   - receipts        (only receipts linked to expenses investor already sees)
--
-- Investor already has SELECT on daily_sales and expenses (existing policies).
-- No write access is granted to any table.
--
-- Rollback:
--   DROP POLICY IF EXISTS "investor_read_rental_records" ON public.rental_records;
--   DROP POLICY IF EXISTS "investor_read_fixed_costs"    ON public.fixed_costs;
--   DROP POLICY IF EXISTS "investor_read_receipts"       ON public.receipts;
-- =============================================================================

-- rental_records: investor can read (needed for landlord P&L rental line)
DROP POLICY IF EXISTS "investor_read_rental_records" ON public.rental_records;
CREATE POLICY "investor_read_rental_records" ON public.rental_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('owner', 'investor'))
  );

-- fixed_costs: investor can read definitions (context for rental records)
DROP POLICY IF EXISTS "investor_read_fixed_costs" ON public.fixed_costs;
CREATE POLICY "investor_read_fixed_costs" ON public.fixed_costs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('owner', 'investor'))
  );

-- receipts: investor can read receipts linked to expenses they can already see
-- This does NOT expose receipts without an expense link, or receipts linked
-- to salary/payroll entries.
DROP POLICY IF EXISTS "investor_read_receipts" ON public.receipts;
CREATE POLICY "investor_read_receipts" ON public.receipts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('owner', 'investor'))
    AND expense_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = receipts.expense_id
        AND e.deleted_at IS NULL
        AND e.category != 'salary'
    )
  );
