'use client'

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderItem = {
  id: string
  item_name: string
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function payLabel(method: string) {
  const map: Record<string, string> = {
    cash: 'Cash',
    credit_card: 'Card',
    qr_payment: 'QR',
  }
  return map[method] ?? method
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReceiptPrint({
  data,
  onClose,
}: {
  data: ReceiptData
  onClose: () => void
}) {
  function handlePrint() {
    const style = document.createElement('style')
    style.id = '__receipt_print_style__'
    style.innerHTML = `
      @media print {
        body > *:not(#__receipt_root__) { display: none !important; }
        #__receipt_root__ { display: block !important; }
        #__receipt_root__ > * { display: none !important; }
        #__receipt_root__ > #__receipt_paper__ { display: block !important; }
      }
    `
    document.head.appendChild(style)
    window.print()
    document.head.removeChild(style)
  }

  const activeItems = data.items.filter(i => !i.voided_at)
  const shortId = data.orderId.slice(-8).toUpperCase()

  return (
    <div
      id="__receipt_root__"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Receipt paper */}
      <div
        id="__receipt_paper__"
        style={{
          backgroundColor: '#ffffff',
          color: '#000000',
          fontFamily: 'monospace',
          fontSize: '12px',
          lineHeight: '1.5',
          maxWidth: '300px',
          width: '100%',
          padding: '16px',
          borderRadius: '4px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '22px', fontWeight: 'bold', letterSpacing: '3px' }}>ARKIB</div>
          <div style={{ fontSize: '11px', opacity: 0.7 }}>Bar &amp; Lounge</div>
          <div style={{ fontSize: '11px', marginTop: '4px' }}>
            {formatDateTime(data.closedAt ?? data.openedAt)}
          </div>
        </div>

        <Dashes />

        {/* Table / server info */}
        <div style={{ marginBottom: '4px' }}>
          <Row label="Table" value={data.tableName ?? 'Walk-in'} />
          <Row label="Covers" value={String(data.covers)} />
          {data.serverName && <Row label="Server" value={data.serverName} />}
        </div>

        <Dashes />

        {/* Items */}
        <div style={{ marginBottom: '4px' }}>
          {activeItems.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
              <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.item_name}
              </div>
              <div style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                {item.quantity}&times;{fmt(item.unit_price)}
              </div>
            </div>
          ))}
        </div>

        <Dashes />

        {/* Totals */}
        <div style={{ marginBottom: '4px' }}>
          <Row label="Subtotal" value={`RM ${fmt(data.subtotal)}`} />
          {data.discountAmount > 0 && (
            <Row
              label={data.discountLabel ? `Disc (${data.discountLabel})` : 'Discount'}
              value={`- RM ${fmt(data.discountAmount)}`}
            />
          )}
          {data.serviceCharge > 0 && (
            <Row label="Service Charge" value={`RM ${fmt(data.serviceCharge)}`} />
          )}
          {data.taxAmount > 0 && (
            <Row label="Tax" value={`RM ${fmt(data.taxAmount)}`} />
          )}
        </div>

        {/* Bold total */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: 'bold',
            fontSize: '14px',
            marginBottom: '6px',
            borderTop: '1px solid #000',
            paddingTop: '4px',
          }}
        >
          <span>TOTAL</span>
          <span>RM {fmt(data.total)}</span>
        </div>

        {/* Payments */}
        <div style={{ marginBottom: '4px' }}>
          {data.payments.map((p, i) => (
            <Row key={i} label={payLabel(p.method)} value={`RM ${fmt(p.amount)}`} />
          ))}
        </div>

        <Dashes />

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: '11px', opacity: 0.7, marginBottom: '4px' }}>
          {data.footerNote || 'Thank you for visiting Arkib!'}
        </div>
        <div style={{ textAlign: 'center', fontSize: '10px', opacity: 0.4 }}>
          #{shortId}
        </div>
      </div>

      {/* Action buttons (hidden on print via the injected style) */}
      <div
        style={{
          position: 'absolute',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '12px',
        }}
      >
        <button
          onClick={onClose}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: '1px solid #3A3A42',
            background: '#1A1A1E',
            color: '#9896A4',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Close
        </button>
        <button
          onClick={handlePrint}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: '#8B5CF6',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Print Receipt
        </button>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Dashes() {
  return (
    <div
      style={{
        borderTop: '1px dashed #000',
        margin: '6px 0',
        opacity: 0.4,
      }}
    />
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}
