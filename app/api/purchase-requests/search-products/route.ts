import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? ''
  const supplierId = searchParams.get('supplierId') ?? ''

  if (q.length < 2) return NextResponse.json({ products: [] })

  // Split into words so "st remy" matches "ST.REMY AUTHENTIC VSOP"
  const words = q.trim().split(/\s+/).filter(Boolean)

  let query = supabase
    .from('supplier_products')
    .select('id, item_name, brand, category, size, price_rm, supplier_id, suppliers(name)')
    .order('item_name')
    .limit(12)

  // Each word must appear somewhere in item_name or brand
  for (const word of words) {
    query = query.or(`item_name.ilike.%${word}%,brand.ilike.%${word}%`)
  }

  if (supplierId) query = query.eq('supplier_id', supplierId)

  const { data } = await query
  return NextResponse.json({ products: data ?? [] })
}
