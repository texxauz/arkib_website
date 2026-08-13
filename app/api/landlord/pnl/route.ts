import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Contractual profit-share tiers per Tenancy Agreement
function getProfitShareRate(year: number, month: number): number {
  if (year === 2025) return 0.15
  if (year === 2026 && month <= 6) return 0.15
  if (year === 2026 && month >= 7) return 0.30
  if (year === 2027) return 0.30
  if (year === 2028 && month <= 7) return 0.30
  return 0
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()

  if (profile?.role !== 'owner' && profile?.role !== 'investor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const isOwner = profile?.role === 'owner'

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const year  = parseInt(searchParams.get('year')  ?? String(now.getFullYear()), 10)
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1), 10)

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 })
  }

  const monthStr  = `${year}-${String(month).padStart(2, '0')}`
  const startDate = `${monthStr}-01`
  const lastDay   = new Date(year, month, 0).getDate()
  const endDate   = `${monthStr}-${String(lastDay).padStart(2, '0')}`

  const [
    salesResult,
    cogsResult,
    expensesResult,
    rentalResult,
    auditResult,
    obligationsResult,
    remunerationResult,
    treasuryResult,
    allSalesForReconResult,
  ] = await Promise.all([
    supabase.from('daily_sales')
      .select('date, total_revenue, cocktails_revenue, beer_revenue, wine_revenue, food_revenue, others_revenue')
      .gte('date', startDate).lte('date', endDate)
      .is('deleted_at', null).order('date'),

    supabase.from('cocktail_sales')
      .select('date, cocktail_name, quantity, unit_cost, total_cogs')
      .gte('date', startDate).lte('date', endDate).order('date'),

    // Exclude rental (rental_records is authoritative) and capex items
    supabase.from('expenses')
      .select('id, date, expense_period, category, description, amount, supplier_name, receipt_url, is_capex')
      .is('deleted_at', null)
      .neq('category', 'rental'),

    supabase.from('rental_records')
      .select('id, amount, status, due_date, paid_date, payment_method, receipt_url, notes, fixed_costs(name, category)')
      .eq('month', month).eq('year', year),

    supabase.from('pos_audit_log')
      .select('id, actor_id, actor_name, event, entity_type, entity_id, payload, created_at')
      .eq('entity_type', 'daily_sales')
      .gte('created_at', `${startDate}T00:00:00Z`)
      .lte('created_at', `${endDate}T23:59:59Z`)
      .order('created_at', { ascending: false }),

    supabase.from('startup_recovery_items')
      .select('id, name, item_type, original_amount, paid_amount, notes, display_order')
      .eq('is_active', true)
      .order('display_order'),

    supabase.from('founder_remuneration_accruals')
      .select('month, year, accrual_amount, paid_amount, paid_date, notes')
      .order('year').order('month'),

    supabase.from('treasury_config')
      .select('opening_balance, opening_date')
      .order('created_at', { ascending: false }).limit(1).single(),

    // All daily_sales up to end of month for cash estimate
    supabase.from('daily_sales')
      .select('date, total_revenue').is('deleted_at', null),
  ])

  if (salesResult.error)  return NextResponse.json({ error: salesResult.error.message }, { status: 500 })
  if (cogsResult.error)   return NextResponse.json({ error: cogsResult.error.message }, { status: 500 })

  const salesRows  = salesResult.data ?? []
  const cogsRows   = cogsResult.data ?? []
  const auditRows  = auditResult.data ?? []

  // ── Revenue ─────────────────────────────────────────────────────────────────
  const revenue = {
    total:     salesRows.reduce((s, r) => s + (r.total_revenue ?? 0), 0),
    cocktails: salesRows.reduce((s, r) => s + (r.cocktails_revenue ?? 0), 0),
    beer:      salesRows.reduce((s, r) => s + (r.beer_revenue ?? 0), 0),
    wine:      salesRows.reduce((s, r) => s + (r.wine_revenue ?? 0), 0),
    food:      salesRows.reduce((s, r) => s + (r.food_revenue ?? 0), 0),
    others:    salesRows.reduce((s, r) => s + (r.others_revenue ?? 0), 0),
  }

  // ── COGS ────────────────────────────────────────────────────────────────────
  const cogsTotal = cogsRows.reduce((s, r) => s + (r.total_cogs ?? 0), 0)
  const cogsByName: Record<string, { qty: number; totalCogs: number }> = {}
  for (const r of cogsRows) {
    if (!cogsByName[r.cocktail_name]) cogsByName[r.cocktail_name] = { qty: 0, totalCogs: 0 }
    cogsByName[r.cocktail_name].qty += r.quantity ?? 0
    cogsByName[r.cocktail_name].totalCogs += r.total_cogs ?? 0
  }
  const cogsBreakdown = Object.entries(cogsByName)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.totalCogs - a.totalCogs)

  const cogsZeroCount = cogsBreakdown.filter(c => c.totalCogs === 0).length
  const cogsComplete  = cogsZeroCount === 0

  // ── Expenses: filter by period, split capex vs opex ─────────────────────────
  const allExpenses = expensesResult.data ?? []
  const monthExpenses = allExpenses.filter(e => {
    const period = e.expense_period ?? e.date
    return period >= startDate && period <= endDate
  })

  const opexExpenses  = monthExpenses.filter(e => !e.is_capex)
  const capexExpenses = monthExpenses.filter(e => e.is_capex)

  const expenseByCategory: Record<string, number> = {}
  for (const e of opexExpenses) {
    expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + e.amount
  }

  const totalNonRentalOpex = opexExpenses.reduce((s, e) => s + e.amount, 0)

  // Expense lines for detail view (payroll excluded for investor privacy)
  const expenseLines = opexExpenses
    .filter(e => isOwner || e.category !== 'salary')
    .map(e => ({
      id: e.id, date: e.date, category: e.category,
      description: e.description, amount: e.amount,
      supplier_name: e.supplier_name, receipt_url: e.receipt_url,
    }))

  const capexLines = capexExpenses.map(e => ({
    id: e.id, date: e.date, category: e.category,
    description: e.description, amount: e.amount,
    supplier_name: e.supplier_name, receipt_url: e.receipt_url,
  }))

  // ── Rental ──────────────────────────────────────────────────────────────────
  const rentalRows  = rentalResult.data ?? []
  const rentalTotal = rentalRows.reduce((s, r) => s + (r.amount ?? 0), 0)
  const rentalLines = rentalRows.map(r => {
    const fc = r.fixed_costs as unknown as { name: string; category: string } | null
    return {
      id: r.id, name: fc?.name ?? 'Rental', amount: r.amount,
      status: r.status, due_date: r.due_date, paid_date: r.paid_date,
      payment_method: r.payment_method, receipt_url: r.receipt_url, notes: r.notes,
    }
  })

  // ── P&L calculation ─────────────────────────────────────────────────────────
  const grossProfit           = revenue.total - cogsTotal
  const totalOperatingExpenses = totalNonRentalOpex + rentalTotal
  const grossOperatingProfit  = grossProfit - totalOperatingExpenses

  const profitShareRate             = getProfitShareRate(year, month)
  const isOutsideContractPeriod     = profitShareRate === 0
  const potentialInvestorEntitlement = grossOperatingProfit > 0 ? grossOperatingProfit * profitShareRate : 0
  const tenantProfit                = grossOperatingProfit - potentialInvestorEntitlement

  // ── Startup obligations ──────────────────────────────────────────────────────
  const rawObligations = obligationsResult.data ?? []
  const startupObligations = rawObligations.map(o => ({
    id: o.id, name: o.name, type: o.item_type,
    originalAmount: o.original_amount,
    paidAmount: o.paid_amount,
    remaining: Math.max(0, o.original_amount - o.paid_amount),
    notes: o.notes,
    status: (o.original_amount - o.paid_amount) <= 0 ? 'cleared' : 'outstanding',
  }))
  const totalObligationsRemaining = startupObligations.reduce((s, o) => s + o.remaining, 0)

  // ── Founder remuneration ─────────────────────────────────────────────────────
  const remunerationRows    = remunerationResult.data ?? []
  const founderTotalAccrued = remunerationRows.reduce((s, r) => s + (r.accrual_amount ?? 0), 0)
  const founderTotalPaid    = remunerationRows.reduce((s, r) => s + (r.paid_amount ?? 0), 0)
  const founderOutstanding  = Math.max(0, founderTotalAccrued - founderTotalPaid)

  const currentMonthRemuneration = remunerationRows.find(r => r.month === month && r.year === year)
  const founderCurrentMonthAccrual = currentMonthRemuneration?.accrual_amount ?? 5000

  // Founder remuneration is an operating expense for P&L purposes (earned, deferred payment)
  // It is already included in expenses.category='salary' if recorded there.
  // If NOT recorded in expenses, it should still appear in P&L.
  // We track separately to surface the liability position.

  // ── Distribution status ──────────────────────────────────────────────────────
  const deferralReasons: string[] = []
  if (grossOperatingProfit <= 0) deferralReasons.push('No gross operating profit generated this period')
  startupObligations.forEach(o => {
    if (o.remaining > 0) deferralReasons.push(`${o.name}: RM${o.remaining.toLocaleString('en-MY', { minimumFractionDigits: 2 })} outstanding`)
  })
  if (founderOutstanding > 0) deferralReasons.push(`Deferred founder remuneration: RM${founderOutstanding.toLocaleString('en-MY', { minimumFractionDigits: 2 })} outstanding`)

  const distributionStatus: string =
    grossOperatingProfit <= 0 ? 'deferred_negative_gop' :
    deferralReasons.length > 0 ? 'deferred_obligations' :
    'eligible'

  // ── Cash estimate (from treasury) ────────────────────────────────────────────
  let cashEstimate = 0
  const treasuryConfig = treasuryResult.data
  if (treasuryConfig) {
    const openingBalance = treasuryConfig.opening_balance ?? 0
    const openingDate    = treasuryConfig.opening_date ?? '2000-01-01'
    const allSales       = allSalesForReconResult.data ?? []
    const cumRevenue     = allSales
      .filter(s => s.date >= openingDate && s.date <= endDate)
      .reduce((s, r) => s + (r.total_revenue ?? 0), 0)
    const paidExpenses = allExpenses
      .filter(e => {
        const pd = (e as Record<string, unknown>).paid_at as string | null
        return pd && pd >= openingDate && pd.slice(0, 10) <= endDate
      })
      .reduce((s, e) => s + e.amount, 0)
    cashEstimate = openingBalance + cumRevenue - paidExpenses
  }

  // ── Manual adjustments ───────────────────────────────────────────────────────
  const manualAdjustments = auditRows
    .filter(r => r.event === 'manual_update' || (r.event ?? '').includes('manual'))
    .map(r => ({
      id: r.id, actorName: r.actor_name, event: r.event,
      entityId: r.entity_id, payload: r.payload as Record<string, unknown> | null,
      createdAt: r.created_at,
    }))

  return NextResponse.json({
    month: monthStr, year, monthNum: month,
    profitShareRate, isOutsideContractPeriod,
    revenue,
    cogs: cogsTotal, cogsBreakdown, cogsComplete, cogsZeroCount,
    grossProfit,
    operatingExpenses: {
      total: totalOperatingExpenses,
      nonRentalTotal: totalNonRentalOpex,
      byCategory: expenseByCategory,
      lines: expenseLines,
      rental: { total: rentalTotal, records: rentalLines },
    },
    capexItems: capexLines,
    grossOperatingProfit,
    potentialInvestorEntitlement,
    tenantProfit,
    hasManualAdjustments: manualAdjustments.length > 0,
    manualAdjustments,
    startupObligations,
    totalObligationsRemaining,
    founderRemuneration: {
      totalAccrued: founderTotalAccrued,
      totalPaid: founderTotalPaid,
      outstanding: founderOutstanding,
      currentMonthAccrual: founderCurrentMonthAccrual,
      records: isOwner ? remunerationRows : [], // only owner sees individual records
    },
    distributionStatus,
    distributionDeferralReasons: deferralReasons,
    actualInvestorDistribution: 0,
    cashEstimate: isOwner ? cashEstimate : null,
    isOwner,
  })
}
