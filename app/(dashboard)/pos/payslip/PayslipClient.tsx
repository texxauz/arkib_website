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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 print:bg-transparent" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="relative bg-white text-black rounded-lg shadow-2xl w-full max-w-md mx-4 print:shadow-none print:rounded-none print:max-w-none print:mx-0 print:fixed print:inset-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 print:hidden">
          <span className="font-semibold text-sm text-gray-700">Payment Voucher</span>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors"
            >
              <Printer size={13} /> Print
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 transition-colors">
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-8 print:p-10" style={{ fontFamily: 'Georgia, serif' }}>
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-widest text-black">ARKIB</h1>
            <h2 className="text-sm tracking-wider text-gray-600 mt-1 uppercase">Payment Voucher</h2>
            <div className="mt-3 border-t border-b border-gray-300 py-2">
              <p className="text-sm text-gray-700">{formatMonth(record.month)}</p>
            </div>
          </div>

          <div className="mb-5 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Staff Name</span>
              <span className="font-semibold">{userName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Employment Type</span>
              <span className="font-semibold capitalize">{record.employment_type.replace('_', '-')}</span>
            </div>
          </div>

          <table className="w-full text-sm mb-6" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #374151' }}>
                <th className="text-left py-2 font-semibold text-gray-700">Description</th>
                <th className="text-right py-2 font-semibold text-gray-700">Amount (RM)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                <td className="py-2 text-gray-700">
                  {record.employment_type === 'part_time'
                    ? `${Number(record.hours_worked ?? 0).toFixed(2)} hrs × RM ${Number(record.hourly_rate ?? 0).toFixed(2)}/hr`
                    : 'Monthly Salary'}
                </td>
                <td className="py-2 text-right">{Number(record.basic_pay).toFixed(2)}</td>
              </tr>
              {(record.claims ?? []).map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td className="py-2 text-gray-600 pl-2">+ {c.label}</td>
                  <td className="py-2 text-right text-green-700">+{Number(c.amount).toFixed(2)}</td>
                </tr>
              ))}
              {(record.deductions ?? []).map((d, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td className="py-2 text-gray-600 pl-2">– {d.label}</td>
                  <td className="py-2 text-right text-red-600">-{Number(d.amount).toFixed(2)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #374151' }}>
                <td className="pt-3 font-bold text-black">Net Pay</td>
                <td className="pt-3 text-right font-bold text-black">RM {Number(record.net_pay).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          {record.notes && (
            <p className="text-xs text-gray-500 mb-6 italic">Note: {record.notes}</p>
          )}

          <div className="mt-8 pt-4 border-t border-gray-200 grid grid-cols-2 gap-6 text-xs text-gray-600">
            <div>
              <div className="border-b border-gray-400 mb-1 pb-6"></div>
              Prepared by
            </div>
            <div>
              <div className="border-b border-gray-400 mb-1 pb-6"></div>
              Received by
              <div className="mt-3 border-b border-gray-400 mb-1 pb-2"></div>
              Date
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print\\:fixed, .print\\:fixed * { visibility: visible !important; }
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
