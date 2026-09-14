import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const supplierId = searchParams.get('supplierId')
  const search = searchParams.get('search') ?? ''
  const category = searchParams.get('category') ?? ''
  const offset = parseInt(searchParams.get('offset') ?? '0')
  const limit = parseInt(searchParams.get('limit') ?? '50')

  if (!supplierId) return NextResponse.json({ error: 'supplierId required' }, { status: 400 })

  let query = supabase
    .from('supplier_products')
    .select('id, item_name, brand, category, size, price_rm, trade_offer')
    .eq('supplier_id', supplierId)
    .order('category')
    .order('item_name')
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`item_name.ilike.%${search}%,brand.ilike.%${search}%`)
  }
  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ products: data })
}
