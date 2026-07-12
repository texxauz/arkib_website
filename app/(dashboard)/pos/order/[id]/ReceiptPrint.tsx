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
}

function fmt(n: number) {
  return n.toFixed(2)
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  const day = d.getDate()
  const month = d.getMonth() + 1
  const year = d.getFullYear()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${day}/${month}/${year} ${h}:${m}:${s}`
}

function payLabel(method: string) {
  const map: Record<string, string> = {
    cash: 'CASH',
    credit_card: 'CARD',
    qr_payment: 'QR/DUITNOW',
  }
  return map[method] ?? method.toUpperCase()
}

function pad(str: string, len: number, right = false): string {
  const s = String(str)
  if (right) return s.padStart(len, ' ').slice(-len)
  return s.padEnd(len, ' ').slice(0, len)
}

const LINE = '------------------------------------------------'
const STAR = '************************************************'
const DASH = '------------------------------------------------'

export function ReceiptPrint({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  function handlePrint() {
    const style = document.createElement('style')
    style.id = '__receipt_print_style__'
    style.innerHTML = `
      @media print {
        body > *:not(#__receipt_root__) { display: none !important; }
        #__receipt_root__ { display: block !important; background: white !important; }
        #__receipt_root__ > * { display: none !important; }
        #__receipt_root__ > #__receipt_paper__ { display: block !important; }
        @page { margin: 4mm; size: 80mm auto; }
      }
    `
    document.head.appendChild(style)
    window.print()
    document.head.removeChild(style)
  }

  const activeItems = data.items.filter(i => !i.voided_at)
  const invoiceNum = parseInt(data.orderId.replace(/-/g, '').slice(-6), 16) % 100000
  const totalPaid = data.payments.reduce((s, p) => s + p.amount, 0)
  const change = Math.max(0, totalPaid - data.total)

  // Group items by category
  const groups = activeItems.reduce<Record<string, OrderItem[]>>((acc, item) => {
    const cat = (item.category ?? 'OTHERS').toUpperCase()
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  const s: React.CSSProperties = {
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '11px',
    lineHeight: '1.45',
    color: '#000',
    whiteSpace: 'pre',
    letterSpacing: '0.02em',
  }

  return (
    <div
      id="__receipt_root__"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        id="__receipt_paper__"
        style={{
          backgroundColor: '#fff',
          color: '#000',
          maxWidth: '340px',
          width: '100%',
          padding: '16px 12px',
          borderRadius: '4px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ ...s, textAlign: 'center', marginBottom: '4px' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', letterSpacing: '4px' }}>ARKIB BAR</div>
          <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '2px' }}>HIDDEN CHAMBERS VENTURE (RA0123876-X)</div>
          <div style={{ fontSize: '10px', marginTop: '2px', lineHeight: '1.5' }}>
            {'133-1, 135-1 JALAN TUN TAN CHENG LOCK\n75200 MELAKA'}
          </div>
        </div>

        <div style={{ ...s, textAlign: 'center', margin: '6px 0', borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '3px 0', fontWeight: 'bold', letterSpacing: '6px' }}>
          INVOICE
        </div>

        {/* Invoice meta */}
        <div style={s}>
          {`Invoice  ${String(invoiceNum).padStart(5, '0')}    Waiter: ${(data.serverName ?? 'STAFF').toUpperCase()}`}
          {'\n'}
          {`Date: ${formatDateTime(data.closedAt ?? data.openedAt)}`}
          {'\n'}
          {`TABLE: ${(data.tableName ?? 'WALK-IN').toUpperCase()}`}
          {'  '}
          {`Covers: ${data.covers}`}
        </div>

        <div style={{ ...s, borderTop: '1px dashed #000', margin: '4px 0' }} />

        {/* Column header */}
        <div style={{ ...s, fontWeight: 'bold' }}>
          {pad('ITEM', 20)}{pad('QTY', 4)}{pad('U.P(RM)', 8, true)}{pad('DISC(RM)', 8, true)}{pad('AMT(RM)', 8, true)}
        </div>

        <div style={{ ...s, borderTop: '1px dashed #000', margin: '2px 0' }} />

        {/* Items grouped by category */}
        {Object.entries(groups).map(([cat, catItems]) => (
          <div key={cat} style={s}>
            <div style={{ fontWeight: 'bold', marginTop: '2px' }}>{cat}</div>
            {catItems.map(item => {
              const amt = item.quantity * item.unit_price - (item.discount ?? 0)
              return (
                <div key={item.id}>
                  {pad(item.item_name, 20)}{pad(String(item.quantity), 4)}{pad(fmt(item.unit_price), 8, true)}{pad(fmt(item.discount), 6, true)}{pad(fmt(amt), 8, true)}
                </div>
              )
            })}
          </div>
        ))}

        <div style={{ ...s, borderTop: '1px dashed #000', margin: '4px 0' }} />

        {/* Totals */}
        <div style={s}>
          {`${pad('Sub Total Before Discount', 32)}${pad('RM ' + fmt(data.subtotal), 14, true)}`}
          {'\n'}
          {data.discountAmount > 0
            ? `${pad(`Discount${data.discountLabel ? ' (' + data.discountLabel + ')' : ''}`, 32)}${pad('RM ' + fmt(data.discountAmount), 14, true)}\n`
            : ''}
          {data.serviceCharge > 0
            ? `${pad('Service Charge', 32)}${pad('RM ' + fmt(data.serviceCharge), 14, true)}\n`
            : `${pad('Service Charge', 32)}${pad('RM 0.00', 14, true)}\n`}
          {data.taxAmount > 0
            ? `${pad('Tax', 32)}${pad('RM ' + fmt(data.taxAmount), 14, true)}\n`
            : ''}
          {`${pad('Total Sales', 32)}${pad('RM ' + fmt(data.total), 14, true)}`}
          {'\n'}
          {`${pad('Rounding Adjustment', 32)}${pad('RM 0.00', 14, true)}`}
        </div>

        <div style={{ ...s, borderTop: '1px solid #000', margin: '4px 0' }} />

        {/* TOTAL */}
        <div style={{ ...s, fontWeight: 'bold', fontSize: '13px' }}>
          {`${pad('TOTAL', 32)}${pad('RM ' + fmt(data.total), 14, true)}`}
        </div>

        {/* Payments */}
        <div style={{ ...s, marginTop: '2px' }}>
          {data.payments.map((p, i) => (
            `${pad(payLabel(p.method), 32)}${pad('RM ' + fmt(p.amount), 14, true)}\n`
          )).join('')}
          {`${pad('CHANGE', 32)}${pad('RM ' + fmt(change), 14, true)}`}
        </div>

        <div style={{ ...s, borderTop: '1px solid #000', margin: '4px 0' }} />

        {/* Footer */}
        <div style={{ ...s, textAlign: 'center', marginTop: '4px', fontSize: '10px' }}>
          {'* * * * * * * * * * * * * * * * * * * * * * *\n'}
          {(data.footerNote || 'Thank you and Come Again')}
          {'\n'}
          {'* * * * * * * * * * * * * * * * * * * * * * *'}
        </div>
        <div style={{ ...s, textAlign: 'center', fontSize: '9px', opacity: 0.4, marginTop: '4px' }}>
          #{data.orderId.slice(-8).toUpperCase()}
        </div>
      </div>

      {/* Buttons */}
      <div style={{
        position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: '12px',
      }}>
        <button onClick={onClose} style={{
          padding: '10px 20px', borderRadius: '8px', border: '1px solid #3A3A42',
          background: '#1A1A1E', color: '#9896A4', fontSize: '14px', cursor: 'pointer',
        }}>Close</button>
        <button onClick={handlePrint} style={{
          padding: '10px 20px', borderRadius: '8px', border: 'none',
          background: '#8B5CF6', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
        }}>Print Receipt</button>
      </div>
    </div>
  )
}
