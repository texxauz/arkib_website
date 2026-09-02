'use client'

import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Printer, X, ChevronRight } from 'lucide-react'

interface LineItem { label: string; amount: number }
interface PayrollRecord {
  id: string; user_id: string; month: string; employment_type: string;
  basic_pay: number; hours_worked: number | null; hourly_rate: number | null;
  deductions: LineItem[]; deductions_total: number;
  claims: LineItem[]; claims_total: number;
  net_pay: number; notes: string | null; status: string;
}

function formatMonth(yyyyMm: string) {
  const [y, m] = yyyyMm.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

function VoucherModal({ record, userName, onClose }: { record: PayrollRecord; userName: string; onClose: () => void }) {
  const today = new Date().toLocaleDateString('en-MY', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const grossEarnings = Number(record.basic_pay) + Number(record.claims_total ?? 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 print:bg-transparent" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="relative bg-white text-black rounded-lg shadow-2xl w-full max-w-2xl mx-4 max-h-[92vh] overflow-y-auto print:shadow-none print:rounded-none print:max-w-none print:mx-0 print:fixed print:inset-0 print:overflow-visible" id="payslip-root">

        {/* Screen-only toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 print:hidden">
          <span className="font-semibold text-sm text-gray-600">Payment Statement</span>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors">
              <Printer size={13} /> Print
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 transition-colors">
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-10 print:p-12" style={{ fontFamily: "'Times New Roman', Times, serif" }}>

          {/* Company header */}
          <div className="text-center mb-6">
            <p className="text-xs tracking-widest text-gray-500 uppercase mb-0.5">Payment Statement</p>
            <h1 className="text-3xl font-bold tracking-widest text-black">ARKIB</h1>
            <p className="text-xs text-gray-500 mt-1">Kuala Lumpur, Malaysia</p>
          </div>

          <div style={{ borderTop: '2px solid black', borderBottom: '2px solid black', padding: '4px 0', textAlign: 'center', marginBottom: '20px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
              Payment Statement — {formatMonth(record.month)}
            </p>
          </div>

          {/* Employee info grid */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '12px' }}>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #9CA3AF', padding: '6px 10px', width: '25%', backgroundColor: '#F9FAFB', fontWeight: 600, color: '#374151' }}>Staff Name</td>
                <td style={{ border: '1px solid #9CA3AF', padding: '6px 10px', width: '25%' }}>{userName}</td>
                <td style={{ border: '1px solid #9CA3AF', padding: '6px 10px', width: '25%', backgroundColor: '#F9FAFB', fontWeight: 600, color: '#374151' }}>Period</td>
                <td style={{ border: '1px solid #9CA3AF', padding: '6px 10px', width: '25%' }}>{record.month}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #9CA3AF', padding: '6px 10px', backgroundColor: '#F9FAFB', fontWeight: 600, color: '#374151' }}>Employment Type</td>
                <td style={{ border: '1px solid #9CA3AF', padding: '6px 10px', textTransform: 'capitalize' }}>{record.employment_type.replace('_', '-')}</td>
                <td style={{ border: '1px solid #9CA3AF', padding: '6px 10px', backgroundColor: '#F9FAFB', fontWeight: 600, color: '#374151' }}>Date of Payment</td>
                <td style={{ border: '1px solid #9CA3AF', padding: '6px 10px' }}>{today}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #9CA3AF', padding: '6px 10px', backgroundColor: '#F9FAFB', fontWeight: 600, color: '#374151' }}>Mode of Payment</td>
                <td style={{ border: '1px solid #9CA3AF', padding: '6px 10px' }}>Cash / Bank Transfer</td>
                <td style={{ border: '1px solid #9CA3AF', padding: '6px 10px', backgroundColor: '#F9FAFB', fontWeight: 600, color: '#374151' }}>Status</td>
                <td style={{ border: '1px solid #9CA3AF', padding: '6px 10px', fontWeight: 600, color: '#059669' }}>Published</td>
              </tr>
            </tbody>
          </table>

          {/* Earnings / Deductions table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#1F2937', color: 'white' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, width: '60%' }}>Description</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, width: '40%' }}>Amount (RM)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ backgroundColor: '#F3F4F6' }}>
                <td colSpan={2} style={{ padding: '5px 10px', fontWeight: 700, fontSize: '11px', letterSpacing: '0.5px', textTransform: 'uppercase', color: '#374151', borderBottom: '1px solid #D1D5DB' }}>
                  Earnings
                </td>
              </tr>

              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                <td style={{ padding: '7px 10px', color: '#374151' }}>
                  {record.employment_type === 'part_time'
                    ? `Basic Pay (${Number(record.hours_worked ?? 0).toFixed(2)} hrs × RM ${Number(record.hourly_rate ?? 0).toFixed(2)}/hr)`
                    : 'Basic Pay (Monthly Salary)'}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Number(record.basic_pay).toFixed(2)}</td>
              </tr>

              {(record.claims ?? []).map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '7px 10px 7px 20px', color: '#374151' }}>{c.label}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Number(c.amount).toFixed(2)}</td>
                </tr>
              ))}

              <tr style={{ backgroundColor: '#F9FAFB', borderTop: '1px solid #9CA3AF', borderBottom: '2px solid #9CA3AF' }}>
                <td style={{ padding: '7px 10px', fontWeight: 700 }}>Gross Earnings</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{grossEarnings.toFixed(2)}</td>
              </tr>

              {(record.deductions ?? []).length > 0 && (
                <>
                  <tr style={{ backgroundColor: '#F3F4F6' }}>
                    <td colSpan={2} style={{ padding: '5px 10px', fontWeight: 700, fontSize: '11px', letterSpacing: '0.5px', textTransform: 'uppercase', color: '#374151', borderBottom: '1px solid #D1D5DB' }}>
                      Deductions
                    </td>
                  </tr>
                  {(record.deductions ?? []).map((d, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: '7px 10px 7px 20px', color: '#374151' }}>{d.label}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#DC2626' }}>({Number(d.amount).toFixed(2)})</td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: '#F9FAFB', borderTop: '1px solid #9CA3AF', borderBottom: '2px solid #9CA3AF' }}>
                    <td style={{ padding: '7px 10px', fontWeight: 700 }}>Total Deductions</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#DC2626' }}>({Number(record.deductions_total).toFixed(2)})</td>
                  </tr>
                </>
              )}

              <tr style={{ backgroundColor: '#1F2937', color: 'white' }}>
                <td style={{ padding: '10px 10px', fontWeight: 700, fontSize: '13px' }}>NET PAY</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, fontSize: '15px', fontVariantNumeric: 'tabular-nums' }}>RM {Number(record.net_pay).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          {record.notes && (
            <p style={{ fontSize: '11px', color: '#6B7280', fontStyle: 'italic', marginBottom: '20px' }}>Note: {record.notes}</p>
          )}

          <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', fontSize: '11px', color: '#6B7280' }}>
            <div>
              <div style={{ borderBottom: '1px solid #9CA3AF', marginBottom: '6px', paddingBottom: '28px' }}></div>
              <p>Authorised Signatory</p>
              <p style={{ marginTop: '4px', color: '#9CA3AF' }}>ARKIB Management</p>
            </div>
            <div>
              <div style={{ borderBottom: '1px solid #9CA3AF', marginBottom: '6px', paddingBottom: '28px' }}></div>
              <p>Received by: {userName}</p>
              <div style={{ borderBottom: '1px solid #9CA3AF', marginBottom: '6px', paddingBottom: '16px', marginTop: '16px' }}></div>
              <p>Date</p>
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: '10px', color: '#9CA3AF', marginTop: '32px' }}>
            This is a computer-generated document. No signature is required if printed electronically.
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #payslip-root, #payslip-root * { visibility: visible !important; }
          #payslip-root { position: fixed; inset: 0; overflow: visible; }
        }
      `}</style>
    </div>
  )
}

export function PayslipClient({ records, userName }: { records: PayrollRecord[]; userName: string }) {
  const [viewing, setViewing] = useState<PayrollRecord | null>(null)

  return (
    <div className="min-h-screen bg-[#0D0D10]">
      <TopBar title="My Payslips" subtitle="Your published payment vouchers" />

      <div className="p-4 lg:p-6 max-w-2xl mx-auto">
        {records.length === 0 ? (
          <div className="text-center py-16 text-[#5A5865]">
            <p className="text-lg mb-1">No payslips yet</p>
            <p className="text-sm">Your manager will publish your payslips here once generated.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {records.map(r => (
              <button
                key={r.id}
                onClick={() => setViewing(r)}
                className="w-full bg-[#141417] border border-[#2A2A30] rounded-xl px-4 py-3.5 flex items-center justify-between hover:border-[#8B5CF6]/40 transition-colors group"
              >
                <div className="text-left">
                  <p className="text-[#F0EEF6] font-medium text-sm">{formatMonth(r.month)}</p>
                  <p className="text-[#9896A4] text-xs mt-0.5 capitalize">{r.employment_type.replace('_', '-')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[#8B5CF6] font-semibold text-sm">RM {Number(r.net_pay).toFixed(2)}</p>
                    <p className="text-[10px] text-emerald-400 font-semibold uppercase">Published</p>
                  </div>
                  <ChevronRight size={15} className="text-[#5A5865] group-hover:text-[#9896A4] transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {viewing && (
        <VoucherModal record={viewing} userName={userName} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}
