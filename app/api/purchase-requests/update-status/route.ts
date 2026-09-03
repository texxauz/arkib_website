import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['owner', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { requestId, status, reviewNotes } = await request.json()
  if (!requestId || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const validTransitions: Record<string, string[]> = {
    approved: ['pending'],
    rejected: ['pending'],
    ordered: ['approved'],
    received: ['ordered'],
  }

  const { data: existing } = await supabase.from('purchase_requests').select('status').eq('id', requestId).single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!validTransitions[status]?.includes(existing.status)) {
    return NextResponse.json({ error: `Cannot move from ${existing.status} to ${status}` }, { status: 400 })
  }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'approved' || status === 'rejected') {
    patch.reviewed_by = user.id
    patch.review_notes = reviewNotes ?? null
  }
  if (status === 'ordered') patch.ordered_by = user.id
  if (status === 'received') patch.received_by = user.id

  const { data, error } = await supabase.from('purchase_requests').update(patch).eq('id', requestId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ request: data })
}
