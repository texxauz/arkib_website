-- =============================================================================
-- MIGRATION 009: Prevent user self-role escalation
--
-- The existing "Users can update own profile" policy has no WITH CHECK clause,
-- so a user can UPDATE their own role column to escalate privileges.
-- This migration replaces it with a policy that blocks role changes for non-owners.
--
-- Staff can still update their own profile (name, pin, etc.).
-- Only owners/managers can change a user's role.
--
-- Rollback:
--   DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
--   CREATE POLICY "Users can update own profile" ON public.users
--     FOR UPDATE USING (auth.uid() = id);
-- =============================================================================

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- role column must stay unchanged unless the caller is owner/manager
    role = (SELECT role FROM public.users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  );
