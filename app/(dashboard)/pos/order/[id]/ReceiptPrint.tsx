'use client'

import { useState } from 'react'

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

const FONT = '"Courier New", Courier, monospace'
const FS = '11px'
const LH = '1.55'
const COLOR = '#000'

function fmt(n: number) { return `RM ${n.toFixed(2)}` }
function fmtNeg(n: number) { return `-RM ${n.toFixed(2)}` }

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
    visa: 'VISA',
    mastercard: 'MASTERCARD',
    qr_payment: 'QR / DUITNOW',
  }
  return map[method] ?? method.toUpperCase()
}

const base: React.CSSProperties = { fontFamily: FONT, fontSize: FS, lineHeight: LH, color: COLOR }

function Row({ label, value, bold, large }: { label: string; value: string; bold?: boolean; large?: boolean }) {
  return (
    <div style={{ ...base, display: 'flex', justifyContent: 'space-between', fontWeight: bold ? 'bold' : 'normal', fontSize: large ? '13px' : FS }}>
      <span>{label}</span>
      <span style={{ marginLeft: '8px', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

function Centre({ children, bold, large }: { children: React.ReactNode; bold?: boolean; large?: boolean }) {
  return (
    <div style={{ ...base, textAlign: 'center', fontWeight: bold ? 'bold' : 'normal', fontSize: large ? '15px' : FS }}>
      {children}
    </div>
  )
}

function Divider({ thick }: { thick?: boolean }) {
  return <div style={{ ...base, borderTop: `1px ${thick ? 'double' : 'dashed'} #000`, margin: '4px 0' }} />
}

export function ReceiptPrint({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  const [emailing, setEmailing] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  async function handleEmail() {
    const email = prompt('Enter customer email address:')
    if (!email || !email.includes('@')) return
    setEmailing(true)
    try {
      const res = await fetch('/api/pos/email-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: data.orderId, email }),
      })
      if (res.ok) {
        setEmailSent(true)
        alert(`Receipt sent to ${email}`)
      } else {
        const d = await res.json()
        alert(d.error ?? 'Failed to send email')
      }
    } catch {
      alert('Failed to send email')
    } finally {
      setEmailing(false)
    }
  }

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
          color: COLOR,
          fontFamily: FONT,
          fontSize: FS,
          width: '300px',
          maxWidth: 'calc(100vw - 32px)',
          padding: '14px 12px',
          borderRadius: '4px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
      >
        {/* Preliminary banner */}
        {data.isPreliminary && (
          <>
            <Centre bold>*** PRELIMINARY BILL ***</Centre>
            <Centre>Payment not yet received</Centre>
            <div style={{ height: '6px' }} />
          </>
        )}

        {/* Header */}
        <Centre bold large>ARKIB BAR</Centre>
        <Centre>HIDDEN CHAMBERS VENTURE</Centre>
        <Centre>(RA0123876-X)</Centre>
        <Centre>133-1, 135-1 JALAN TUN TAN CHENG LOCK</Centre>
        <Centre>75200 MELAKA</Centre>
        <div style={{ height: '4px' }} />
        <Divider />
        <Centre bold>INVOICE</Centre>
        <Divider />

        {/* Meta */}
        <div style={{ ...base }}>
          <div>INV#&nbsp; {String(invoiceNum).padStart(5, '0')}</div>
          <div>Date: {formatDateTime(data.closedAt ?? data.openedAt)}</div>
          <div>Table: {(data.tableName ?? 'Walk-in').toUpperCase()}&nbsp;&nbsp; Covers: {data.covers}</div>
          <div>Served by: {(data.serverName ?? 'Staff').toUpperCase()}</div>
        </div>
        <Divider />

        {/* Items */}
        {Object.entries(groups).map(([cat, catItems]) => (
          <div key={cat}>
            <div style={{ ...base, fontWeight: 'bold', marginTop: '2px' }}>[ {cat} ]</div>
            {catItems.map((item, i) => {
              const lineTotal = item.quantity * item.unit_price - (item.discount ?? 0)
              return (
                <div key={i} style={{ marginBottom: '3px' }}>
                  <div style={{ ...base }}>{item.item_name}</div>
                  <div style={{ ...base, display: 'flex', justifyContent: 'space-between', paddingLeft: '12px' }}>
                    <span style={{ color: '#444' }}>{item.quantity} x {item.unit_price.toFixed(2)}</span>
                    <span style={{ whiteSpace: 'nowrap' }}>{fmt(lineTotal)}</span>
                  </div>
                  {(item.discount ?? 0) > 0 && (
                    <div style={{ ...base, display: 'flex', justifyContent: 'space-between', paddingLeft: '12px' }}>
                      <span style={{ color: '#444' }}>Discount</span>
                      <span style={{ whiteSpace: 'nowrap' }}>{fmtNeg(item.discount)}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        <Divider />

        {/* Totals */}
        <Row label="Sub Total" value={fmt(data.subtotal)} />
        {data.discountAmount > 0 && (
          <Row
            label={data.discountLabel ? `Discount (${data.discountLabel})` : 'Discount'}
            value={fmtNeg(data.discountAmount)}
          />
        )}
        {data.serviceCharge > 0 && <Row label="Service Charge" value={fmt(data.serviceCharge)} />}
        {data.taxAmount > 0 && <Row label="Tax" value={fmt(data.taxAmount)} />}
        <Divider thick />
        <Row label="TOTAL" value={fmt(data.total)} bold large />
        <Divider thick />

        {/* Payments */}
        {data.payments.map((p, i) => (
          <Row key={i} label={payLabel(p.method)} value={fmt(p.amount)} />
        ))}
        {change > 0 && <Row label="CHANGE" value={fmt(change)} />}

        <Divider />

        {/* Footer */}
        <div style={{ height: '4px' }} />
        <Centre>* * * * * * * * * * * * * *</Centre>
        <Centre>{data.footerNote || 'Thank you and Come Again!'}</Centre>
        <Centre>* * * * * * * * * * * * * *</Centre>
        <div style={{ height: '4px' }} />
        <Centre><span style={{ fontSize: '9px', color: '#666' }}>Ref: #{data.orderId.slice(-8).toUpperCase()}</span></Centre>
        <div style={{ height: '8px' }} />
      </div>

      <div
        id="__receipt_buttons__"
        style={{ display: 'flex', gap: '12px', marginTop: '16px' }}
      >
        <button onClick={onClose} style={{
          padding: '10px 24px', borderRadius: '8px', border: '1px solid #3A3A42',
          background: '#1A1A1E', color: '#9896A4', fontSize: '14px', cursor: 'pointer',
        }}>Close</button>
        <button onClick={handleEmail} disabled={emailing} style={{
          padding: '10px 24px', borderRadius: '8px', border: '1px solid #3A3A42',
          background: emailSent ? '#1A3A2E' : '#1A1A2E', color: emailSent ? '#34D399' : '#A78BFA',
          fontSize: '14px', cursor: emailing ? 'wait' : 'pointer', opacity: emailing ? 0.6 : 1,
        }}>{emailing ? 'Sending…' : emailSent ? '✓ Email Sent' : 'Email Receipt'}</button>
        <button onClick={handlePrint} style={{
          padding: '10px 24px', borderRadius: '8px', border: 'none',
          background: '#8B5CF6', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
        }}>Print Receipt</button>
      </div>
    </div>
  )
}
