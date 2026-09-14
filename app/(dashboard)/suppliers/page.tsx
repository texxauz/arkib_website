import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SuppliersClient } from './SuppliersClient'

export const dynamic = 'force-dynamic'

export default async function SuppliersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['owner', 'manager', 'full_timer'].includes(profile.role)) redirect('/')

  const { data: suppliers, error: suppErr } = await supabase
    .from('suppliers')
    .select('id, name')
    .order('name')

  console.log('suppliers:', suppliers, 'error:', suppErr)

  const { data: categories, error: catErr } = await supabase
    .from('supplier_products')
    .select('category, supplier_id')
    .order('category')

  console.log('categories count:', categories?.length, 'error:', catErr)

  // Build category list per supplier
  const catMap: Record<string, Set<string>> = {}
  for (const row of categories ?? []) {
    if (!catMap[row.supplier_id]) catMap[row.supplier_id] = new Set()
    catMap[row.supplier_id].add(row.category)
  }
  const supplierCategories: Record<string, string[]> = {}
  for (const [sid, cats] of Object.entries(catMap)) {
    supplierCategories[sid] = Array.from(cats).sort()
  }

  return (
    <SuppliersClient
      suppliers={(suppliers ?? []) as any}
      supplierCategories={supplierCategories}
      userRole={profile.role}
    />
  )
}
