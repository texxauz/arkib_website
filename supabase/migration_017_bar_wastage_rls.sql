-- ================================================================
-- migration_017_bar_wastage_rls.sql
-- Adds missing RLS policies for bar_wastage table.
-- The table was created in Supabase dashboard with no policies,
-- causing INSERT to silently fail for non-admin staff.
-- Already applied directly in Supabase SQL Editor on 2026-10-18.
-- ================================================================

-- Allow any authenticated staff to log wastage entries
CREATE POLICY "wastage_insert_authenticated"
  ON public.bar_wastage
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated staff to read wastage history
CREATE POLICY "wastage_select_authenticated"
  ON public.bar_wastage
  FOR SELECT
  TO authenticated
  USING (true);

-- Only owner/manager can delete wastage entries (API also enforces this)
CREATE POLICY "wastage_delete_admin"
  ON public.bar_wastage
  FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('owner', 'manager'));
