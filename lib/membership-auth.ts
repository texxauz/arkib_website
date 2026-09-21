export type MembershipAccess = 'none' | 'view' | 'edit'

/**
 * Derive the caller's membership access level from their role and tab_permissions.
 * owner/manager always get edit. Other roles need explicit tab_permissions['membership'].
 */
export function getMembershipAccess(
  role: string | null | undefined,
  tabPerms: Record<string, string> | null | undefined,
): MembershipAccess {
  if (role === 'owner' || role === 'manager') return 'edit'
  const perm = tabPerms?.['membership']
  if (perm === 'edit') return 'edit'
  if (perm === 'view') return 'view'
  return 'none'
}
