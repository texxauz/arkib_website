import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { getBusinessDate } from '@/lib/utils'

function fmt(n: number) { return n.toFixed(2) }

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy}  ${hh}:${min}`
}

function payLabel(method: string) {
  const map: Record<string, string> = {
    cash: 'Cash',
    credit_card: 'Credit Card',
    debit_card: 'Debit Card',
    qr_payment: 'QR / DuitNow',
  }
  return map[method] ?? method
}

function buildReceiptHtml(data: {
  orderId: string
  tableName: string | null
  serverName: string | null
  covers: number
  openedAt: string
  closedAt: string | null
  items: Array<{ item_name: string; category: string | null; quantity: number; unit_price: number; discount: number; voided_at: string | null }>
  subtotal: number
  discountAmount: number
  discountLabel: string | null
  serviceCharge: number
  taxAmount: number
  total: number
  payments: Array<{ method: string; amount: number }>
  footerNote: string
  isPreliminary: boolean
}) {
  const invoiceNum = parseInt(data.orderId.replace(/-/g, '').slice(-6), 16) % 100000
  const totalPaid = data.payments.reduce((s, p) => s + p.amount, 0)
  const change = Math.max(0, totalPaid - data.total)
  const activeItems = data.items.filter(i => !i.voided_at)

  const groups = activeItems.reduce<Record<string, typeof activeItems>>((acc, item) => {
    const cat = (item.category ?? 'Others').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  const itemRows = Object.entries(groups).map(([cat, items]) => `
    <tr><td colspan="3" style="padding:10px 0 4px;font-weight:700;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.05em;border-top:1px solid #eee">${cat}</td></tr>
    ${items.map(item => {
      const lineTotal = item.quantity * item.unit_price - (item.discount ?? 0)
      return `
      <tr>
        <td style="padding:3px 0;font-size:13px;color:#1a1a1a">${item.item_name}</td>
        <td style="padding:3px 0;font-size:13px;color:#555;text-align:center">${item.quantity} × RM ${fmt(item.unit_price)}</td>
        <td style="padding:3px 0;font-size:13px;color:#1a1a1a;text-align:right;white-space:nowrap">RM ${fmt(lineTotal)}</td>
      </tr>
      ${(item.discount ?? 0) > 0 ? `<tr><td colspan="2" style="font-size:11px;color:#888;padding-bottom:2px">Discount</td><td style="font-size:11px;color:#e55;text-align:right">-RM ${fmt(item.discount)}</td></tr>` : ''}
      `
    }).join('')}
  `).join('')

  const paymentRows = data.payments.map(p =>
    `<tr><td style="padding:2px 0;font-size:13px;color:#555">${payLabel(p.method)}</td><td style="text-align:right;font-size:13px;color:#1a1a1a">RM ${fmt(p.amount)}</td></tr>`
  ).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:#1a0a2e;padding:28px 32px 22px;text-align:center">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:0.12em">ARKIB BAR</h1>
      <p style="margin:6px 0 0;color:#a78bfa;font-size:12px;letter-spacing:0.06em">HIDDEN CHAMBERS VENTURE</p>
      <p style="margin:3px 0 0;color:#7c6fa0;font-size:11px">(RA0123876-X)</p>
      <p style="margin:3px 0 0;color:#7c6fa0;font-size:11px">133-1, 135-1 Jalan Tun Tan Cheng Lock, 75200 Melaka</p>
    </div>

    ${data.isPreliminary ? `
    <div style="background:#fff3cd;padding:10px 32px;text-align:center;border-bottom:1px solid #ffd;font-size:12px;color:#856404;font-weight:600">
      PRELIMINARY BILL — PAYMENT PENDING
    </div>` : ''}

    <!-- Meta -->
    <div style="padding:20px 32px 16px;border-bottom:1px solid #f0f0f0">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="font-size:12px;color:#888;padding-bottom:4px">Invoice</td>
          <td style="font-size:12px;color:#1a1a1a;text-align:right;font-weight:600">#${String(invoiceNum).padStart(5, '0')}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#888;padding-bottom:4px">Date</td>
          <td style="font-size:12px;color:#1a1a1a;text-align:right">${formatDateTime(data.closedAt ?? data.openedAt)}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#888;padding-bottom:4px">Table</td>
          <td style="font-size:12px;color:#1a1a1a;text-align:right">${(data.tableName ?? 'Walk-in').toUpperCase()}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#888;padding-bottom:4px">Covers</td>
          <td style="font-size:12px;color:#1a1a1a;text-align:right">${data.covers}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#888">Served by</td>
          <td style="font-size:12px;color:#1a1a1a;text-align:right">${(data.serverName ?? 'Staff').toUpperCase()}</td>
        </tr>
      </table>
    </div>

    <!-- Items -->
    <div style="padding:16px 32px">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:2px solid #eee">
            <th style="text-align:left;font-size:11px;color:#999;font-weight:600;padding-bottom:6px;text-transform:uppercase;letter-spacing:0.05em">Item</th>
            <th style="text-align:center;font-size:11px;color:#999;font-weight:600;padding-bottom:6px;text-transform:uppercase;letter-spacing:0.05em">Qty</th>
            <th style="text-align:right;font-size:11px;color:#999;font-weight:600;padding-bottom:6px;text-transform:uppercase;letter-spacing:0.05em">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>

    <!-- Totals -->
    <div style="padding:0 32px 20px">
      <div style="border-top:1px solid #eee;padding-top:12px">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:3px 0;font-size:13px;color:#555">Subtotal</td>
            <td style="text-align:right;font-size:13px;color:#1a1a1a">RM ${fmt(data.subtotal)}</td>
          </tr>
          ${data.discountAmount > 0 ? `<tr>
            <td style="padding:3px 0;font-size:13px;color:#555">${data.discountLabel ? `Discount (${data.discountLabel})` : 'Discount'}</td>
            <td style="text-align:right;font-size:13px;color:#e55">-RM ${fmt(data.discountAmount)}</td>
          </tr>` : ''}
          ${data.serviceCharge > 0 ? `<tr>
            <td style="padding:3px 0;font-size:13px;color:#555">Service Charge</td>
            <td style="text-align:right;font-size:13px;color:#1a1a1a">RM ${fmt(data.serviceCharge)}</td>
          </tr>` : ''}
          ${data.taxAmount > 0 ? `<tr>
            <td style="padding:3px 0;font-size:13px;color:#555">Tax</td>
            <td style="text-align:right;font-size:13px;color:#1a1a1a">RM ${fmt(data.taxAmount)}</td>
          </tr>` : ''}
          <tr style="border-top:2px solid #1a0a2e">
            <td style="padding:10px 0 6px;font-size:16px;font-weight:800;color:#1a0a2e">TOTAL</td>
            <td style="text-align:right;padding:10px 0 6px;font-size:16px;font-weight:800;color:#7c3aed">RM ${fmt(data.total)}</td>
          </tr>
          ${paymentRows}
          ${change > 0 ? `<tr>
            <td style="padding:3px 0;font-size:13px;color:#555">Change</td>
            <td style="text-align:right;font-size:13px;color:#1a1a1a">RM ${fmt(change)}</td>
          </tr>` : ''}
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f9f7ff;padding:20px 32px;text-align:center;border-top:1px solid #e9e4f5">
      <p style="margin:0;font-size:14px;color:#7c3aed;font-weight:600">${data.footerNote || 'Thank you and Come Again!'}</p>
      <p style="margin:8px 0 0;font-size:11px;color:#aaa">Ref: #${data.orderId.slice(-8).toUpperCase()}</p>
    </div>
  </div>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email service not configured. Add RESEND_API_KEY to environment variables.' }, { status: 503 })
  }
  const resend = new Resend(process.env.RESEND_API_KEY)

  const body = await req.json()
  // Fix: accept only orderId + email — never trust client-supplied receipt data
  const { email, orderId } = body as { email: string; orderId: string }

  if (!email || !orderId) {
    return NextResponse.json({ error: 'Missing email or orderId' }, { status: 400 })
  }

  // Fetch order data authoritatively from the database
  const [
    { data: order },
    { data: items },
    { data: payments },
    { data: config },
  ] = await Promise.all([
    supabase.from('pos_orders').select('*').eq('id', orderId).single(),
    supabase.from('pos_order_items').select('*').eq('order_id', orderId),
    supabase.from('pos_payments').select('method, amount').eq('order_id', orderId),
    supabase.from('pos_config').select('key, value').eq('key', 'receipt_footer'),
  ])

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status === 'voided') return NextResponse.json({ error: 'Cannot email a voided order' }, { status: 400 })

  const activeItems = (items ?? []).filter((i: any) => !i.voided_at)
  const subtotal = activeItems.reduce((s: number, i: any) => s + (i.quantity * i.unit_price - (i.discount ?? 0)), 0)
  const discountAmount = order.discount_amount ?? 0
  const serviceCharge = order.service_charge ?? 0
  const taxAmount = order.tax_amount ?? 0
  const total = subtotal - discountAmount + serviceCharge + taxAmount
  const isPreliminary = order.status === 'open'
  const footerNote = config?.[0]?.value ?? 'Thank you and Come Again!'

  const receiptData = {
    orderId: order.id,
    tableName: order.table_name,
    serverName: order.server_name,
    covers: order.covers,
    openedAt: order.opened_at,
    closedAt: order.closed_at ?? null,
    items: activeItems.map((i: any) => ({
      item_name: i.item_name,
      category: i.category,
      quantity: i.quantity,
      unit_price: i.unit_price,
      discount: i.discount ?? 0,
      voided_at: i.voided_at,
    })),
    subtotal,
    discountAmount,
    discountLabel: order.discount_label ?? null,
    serviceCharge,
    taxAmount,
    total,
    payments: (payments ?? []) as Array<{ method: string; amount: number }>,
    footerNote,
    isPreliminary,
  }

  const html = buildReceiptHtml(receiptData)
  const subject = isPreliminary
    ? `Your bill from ARKIB BAR — Table ${order.table_name ?? 'Walk-in'}`
    : `Receipt from ARKIB BAR — Table ${order.table_name ?? 'Walk-in'}`

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'receipt@arkibbar.com',
    to: email,
    subject,
    html,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
