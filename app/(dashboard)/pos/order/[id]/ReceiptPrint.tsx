'use client'

type OrderItem = {
  id: string
  item_name: string
  category: string | null
  quantity: number
  unit_price: number
  discount: number
  voided_at: string | null
}

type Payment = { method: string; amount: number }

export type ReceiptData = {
  orderId: string
  tableName: string | null
  serverName: string | null
  covers: number
  openedAt: string
  closedAt: string | null
  items: OrderItem[]
  subtotal: number
  discountAmount: number
  discountLabel: string | null
  serviceCharge: number
  taxAmount: number
  total: number
  payments: Payment[]
  footerNote: string
  isPreliminary?: boolean
}

const W = 42 // chars per line on 80mm thermal

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
    cash: 'CASH',
    credit_card: 'CREDIT CARD',
    debit_card: 'DEBIT CARD',
    qr_payment: 'QR / DUITNOW',
  }
  return map[method] ?? method.toUpperCase()
}

// Left label, right value, padded to W chars
function row(label: string, value: string, bold = false): string {
  const gap = W - label.length - value.length
  return label + ' '.repeat(Math.max(1, gap)) + value
}

// Centred text
function centre(text: string): string {
  const pad = Math.max(0, Math.floor((W - text.length) / 2))
  return ' '.repeat(pad) + text
}

const DIVIDER = '-'.repeat(W)
const THICK   = '='.repeat(W)

export function ReceiptPrint({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  function handlePrint() {
    const style = document.createElement('style')
    style.id = '__receipt_print_style__'
    style.innerHTML = `
      @media print {
        body > *:not(#__receipt_root__) { display: none !important; }
        #__receipt_root__ { display: block !important; position: static !important; background: white !important; padding: 0 !important; }
        #__receipt_buttons__ { display: none !important; }
        #__receipt_paper__ {
          display: block !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          max-height: none !important;
          overflow: visible !important;
          margin: 0 !important;
          padding: 2mm 3mm !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        @page { margin: 0; size: 80mm auto; }
      }
    `
    document.head.appendChild(style)
    window.print()
    document.head.removeChild(style)
  }

  const activeItems = data.items.filter(i => !i.voided_at)
  const invoiceNum  = parseInt(data.orderId.replace(/-/g, '').slice(-6), 16) % 100000
  const totalPaid   = data.payments.reduce((s, p) => s + p.amount, 0)
  const change      = Math.max(0, totalPaid - data.total)

  const groups = activeItems.reduce<Record<string, OrderItem[]>>((acc, item) => {
    const cat = (item.category ?? 'OTHERS').toUpperCase()
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  const s: React.CSSProperties = {
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '11px',
    lineHeight: '1.5',
    color: '#000',
    whiteSpace: 'pre',
  }

  const lines: Array<{ text: string; bold?: boolean; centre?: boolean; size?: string }> = []

  const add = (text: string, opts?: { bold?: boolean; centre?: boolean; size?: string }) =>
    lines.push({ text, ...opts })

  // ── Preliminary banner ───────────────────────────────────────────
  if (data.isPreliminary) {
    add(centre('*** PRELIMINARY BILL ***'), { bold: true })
    add(centre('Payment not yet received'))
    add('')
  }

  // ── Header ──────────────────────────────────────────────────────
  add('ARKIB BAR', { bold: true, centre: true, size: '15px' })
  add('HIDDEN CHAMBERS VENTURE', { centre: true })
  add('(RA0123876-X)', { centre: true })
  add('133-1, 135-1 JALAN TUN TAN CHENG LOCK', { centre: true })
  add('75200 MELAKA', { centre: true })
  add('')
  add(DIVIDER)
  add(centre('INVOICE'), { bold: true })
  add(DIVIDER)

  // ── Meta ────────────────────────────────────────────────────────
  add(`INV#  ${String(invoiceNum).padStart(5, '0')}`)
  add(`Date: ${formatDateTime(data.closedAt ?? data.openedAt)}`)
  add(`Table: ${(data.tableName ?? 'Walk-in').toUpperCase()}   Covers: ${data.covers}`)
  add(`Served by: ${(data.serverName ?? 'Staff').toUpperCase()}`)
  add(DIVIDER)

  // ── Items ───────────────────────────────────────────────────────
  Object.entries(groups).forEach(([cat, catItems]) => {
    add(`[ ${cat} ]`, { bold: true })
    catItems.forEach(item => {
      const lineTotal = item.quantity * item.unit_price - (item.discount ?? 0)
      // Item name — wrap if longer than W
      const name = item.item_name
      if (name.length <= W) {
        add(name)
      } else {
        // break at word boundary
        const words = name.split(' ')
        let line = ''
        words.forEach(w => {
          if ((line + ' ' + w).trim().length > W) { add(line); line = w }
          else line = (line + ' ' + w).trim()
        })
        if (line) add(line)
      }
      // qty × price line
      const qtyPrice = `  ${item.quantity} x ${fmt(item.unit_price)}`
      const amtStr   = `RM ${fmt(lineTotal)}`
      const gap      = W - qtyPrice.length - amtStr.length
      add(qtyPrice + ' '.repeat(Math.max(1, gap)) + amtStr)
      if ((item.discount ?? 0) > 0) {
        add(`  Discount              -RM ${fmt(item.discount)}`)
      }
    })
  })

  add(DIVIDER)

  // ── Totals ──────────────────────────────────────────────────────
  add(row('Sub Total', `RM ${fmt(data.subtotal)}`))
  if (data.discountAmount > 0) {
    const dlabel = data.discountLabel ? `Discount (${data.discountLabel})` : 'Discount'
    add(row(dlabel, `-RM ${fmt(data.discountAmount)}`))
  }
  if (data.serviceCharge > 0) {
    add(row('Service Charge', `RM ${fmt(data.serviceCharge)}`))
  }
  if (data.taxAmount > 0) {
    add(row('Tax', `RM ${fmt(data.taxAmount)}`))
  }
  add(THICK)
  add(row('TOTAL', `RM ${fmt(data.total)}`), { bold: true, size: '13px' })
  add(THICK)

  // ── Payments ────────────────────────────────────────────────────
  data.payments.forEach(p => {
    add(row(payLabel(p.method), `RM ${fmt(p.amount)}`))
  })
  if (change > 0) {
    add(row('CHANGE', `RM ${fmt(change)}`))
  }

  add(DIVIDER)

  // ── Footer ──────────────────────────────────────────────────────
  add(centre('* * * * * * * * * * * * * *'))
  add(centre(data.footerNote || 'Thank you and Come Again!'), { centre: true })
  add(centre('* * * * * * * * * * * * * *'))
  add('')
  add(centre(`Ref: #${data.orderId.slice(-8).toUpperCase()}`), { size: '9px' })
  add('')

  return (
    <div
      id="__receipt_root__"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        id="__receipt_paper__"
        style={{
          backgroundColor: '#fff',
          color: '#000',
          width: '302px', // 80mm at 96dpi
          padding: '12px 10px',
          borderRadius: '4px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              ...s,
              fontSize: line.size ?? '11px',
              fontWeight: line.bold ? 'bold' : 'normal',
              textAlign: line.centre ? 'center' : 'left',
              whiteSpace: 'pre',
            }}
          >
            {line.text}
          </div>
        ))}
      </div>

      <div
        id="__receipt_buttons__"
        style={{ display: 'flex', gap: '12px', marginTop: '16px' }}
      >
        <button onClick={onClose} style={{
          padding: '10px 24px', borderRadius: '8px', border: '1px solid #3A3A42',
          background: '#1A1A1E', color: '#9896A4', fontSize: '14px', cursor: 'pointer',
        }}>Close</button>
        <button onClick={handlePrint} style={{
          padding: '10px 24px', borderRadius: '8px', border: 'none',
          background: '#8B5CF6', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
        }}>Print Receipt</button>
      </div>
    </div>
  )
}
