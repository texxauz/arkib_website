-- =============================================================================
-- MIGRATION 007: Restrict pos_config writes to owner only
--
-- Previously any authenticated user could write to pos_config.
-- This restricts writes (INSERT/UPDATE/DELETE) to the owner role only.
-- All authenticated users retain read access (existing auth_read_pos_config policy).
--
-- Rollback:
--   DROP POLICY IF EXISTS "owner_write_pos_config" ON public.pos_config;
--   CREATE POLICY "manager_write_pos_config" ON public.pos_config
--     FOR ALL TO authenticated
--     USING (
--       EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('owner','manager'))
--     )
--     WITH CHECK (
--       EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('owner','manager'))
--     );
-- =============================================================================

-- Remove any existing write policies (idempotent)
DROP POLICY IF EXISTS "admin_write_pos_config"   ON public.pos_config;
DROP POLICY IF EXISTS "manager_write_pos_config" ON public.pos_config;
DROP POLICY IF EXISTS "owner_write_pos_config"   ON public.pos_config;

-- Owner-only writes
CREATE POLICY "owner_write_pos_config" ON public.pos_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner')
  );
