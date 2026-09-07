import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export const POS_MENU_TAG = 'pos-menu'

export const getCachedCocktails = unstable_cache(
  async () => {
    const { data } = await admin()
      .from('cocktails')
      .select('id, name, selling_price, total_cost')
      .eq('is_on_menu', true)
      .is('deleted_at', null)
      .order('name')
    return data ?? []
  },
  ['pos-cocktails'],
  { tags: [POS_MENU_TAG], revalidate: 60 },
)

export const getCachedMenuItems = unstable_cache(
  async () => {
    const { data } = await admin()
      .from('menu_items')
      .select('id, name, category, price, cost_price, is_active, sort_order, stock_qty')
      .eq('is_active', true)
      .order('category')
      .order('sort_order')
      .order('name')
    return data ?? []
  },
  ['pos-menu-items'],
  { tags: [POS_MENU_TAG], revalidate: 60 },
)
