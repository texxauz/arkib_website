import { createClient } from '@/lib/supabase/server'
import { InventoryClient } from './InventoryClient'

export default async function InventoryPage() {
  const supabase = await createClient()

  const [{ data: ingredients }, { data: suppliers }] = await Promise.all([
    supabase.from('ingredients').select('*, suppliers(name)').is('deleted_at', null).order('name'),
    supabase.from('suppliers').select('id, name').eq('is_active', true).order('name'),
  ])

  return <InventoryClient ingredients={(ingredients as any) ?? []} suppliers={suppliers ?? []} />
}
