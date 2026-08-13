import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Contractual profit-share tiers per Tenancy Agreement
// 01 Jul 2025 – 30 Jun 2026 = 15%
// 01 Jul 2026 – 31 Jul 2028 = 30%
function getProfitShareRate(year: number, month: number): number {
  if (year === 2025) return 0.15
  if (year === 2026 && month <= 6) return 0.15
  if (year === 2026 && month >= 7) return 0.30
  if (year === 2027) return 0.30
  if (year === 2028 && month <= 7) return 0.30
  return 0 // Outside defined contract period
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'owner' && profile?.role !== 'investor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()), 10)
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1), 10)

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 })
  }

  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  const startDate = `${monthStr}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${monthStr}-${String(lastDay).padStart(2, '0')}`

  // Run all queries in parallel.
  // Expenses: fetch all non-rental records without a date filter;
  // date filtering happens in JS to handle expense_period vs date correctly.
  const [salesResult, cogsResult, expensesResult, rentalResult, auditResult] =
    await Promise.all([
      supabase
        .from('daily_sales')
        .select('date, total_revenue, cocktails_revenue, beer_revenue, wine_revenue, food_revenue, others_revenue')
        .gte('date', startDate)
        .lte('date', endDate)
        .is('deleted_at', null)
        .order('date'),

      supabase
        .from('cocktail_sales')
        .select('date, cocktail_name, quantity, unit_cost, total_cogs')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date'),

      // Exclude rental category — rental_records is the authoritative rental source
      supabase
        .from('expenses')
        .select('id, date, expense_period, category, description, amount, supplier_name, receipt_url')
        .is('deleted_at', null)
        .neq('category', 'rental'),

      supabase
        .from('rental_records')
        .select('id, amount, status, due_date, paid_date, payment_method, receipt_url, notes, fixed_costs(name, category)')
        .eq('month', month)
        .eq('year', year),

      supabase
        .from('pos_audit_log')
        .select('id, actor_id, actor_name, event, entity_type, entity_id, payload, created_at')
        .eq('entity_type', 'daily_sales')
        .gte('created_at', `${startDate}T00:00:00Z`)
        .lte('created_at', `${endDate}T23:59:59Z`)
        .order('created_at', { ascending: false }),
    ])

  if (salesResult.error) return NextResponse.json({ error: salesResult.error.message }, { status: 500 })
  if (cogsResult.error) return NextResponse.json({ error: cogsResult.error.message }, { status: 500 })

  const salesRows = salesResult.data ?? []
  const cogsRows = cogsResult.data ?? []
  const auditRows = auditResult.data ?? []

  // Revenue aggregation
  const revenue = {
    total: salesRows.reduce((s, r) => s + (r.total_revenue ?? 0), 0),
    cocktails: salesRows.reduce((s, r) => s + (r.cocktails_revenue ?? 0), 0),
    beer: salesRows.reduce((s, r) => s + (r.beer_revenue ?? 0), 0),
    wine: salesRows.reduce((s, r) => s + (r.wine_revenue ?? 0), 0),
    food: salesRows.reduce((s, r) => s + (r.food_revenue ?? 0), 0),
    others: salesRows.reduce((s, r) => s + (r.others_revenue ?? 0), 0),
  }

  // COGS
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

  // Filter expenses to the reporting period using expense_period when set, otherwise date
  const allExpenses = expensesResult.data ?? []
  const monthExpenses = allExpenses.filter(e => {
    const period = e.expense_period ?? e.date
    return period >= startDate && period <= endDate
  })

  const expenseByCategory: Record<string, number> = {}
  for (const e of monthExpenses) {
    expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + e.amount
  }

  // Individual lines — payroll excluded for privacy (shown as aggregate only)
  const expenseLines = monthExpenses
    .filter(e => e.category !== 'salary')
    .map(e => ({
      id: e.id,
      date: e.date,
      category: e.category,
      description: e.description,
      amount: e.amount,
      supplier_name: e.supplier_name,
      receipt_url: e.receipt_url,
    }))

  const totalNonRentalExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0)

  // Rental from rental_records (authoritative source)
  const rentalRows = rentalResult.data ?? []
  const rentalTotal = rentalRows.reduce((s, r) => s + (r.amount ?? 0), 0)
  const rentalLines = rentalRows.map(r => {
    const fc = r.fixed_costs as unknown as { name: string; category: string } | null
    return {
      id: r.id,
      name: fc?.name ?? 'Rental',
      amount: r.amount,
      status: r.status,
      due_date: r.due_date,
      paid_date: r.paid_date,
      payment_method: r.payment_method,
      receipt_url: r.receipt_url,
      notes: r.notes,
    }
  })

  const grossProfit = revenue.total - cogsTotal
  const totalOperatingExpenses = totalNonRentalExpenses + rentalTotal
  const grossOperatingProfit = grossProfit - totalOperatingExpenses

  const profitShareRate = getProfitShareRate(year, month)
  const isOutsideContractPeriod = profitShareRate === 0
  const landlordEntitlement = grossOperatingProfit > 0 ? grossOperatingProfit * profitShareRate : 0
  const tenantProfit = grossOperatingProfit - landlordEntitlement

  const manualAdjustments = auditRows
    .filter(r => r.event === 'manual_update' || (r.event ?? '').includes('manual'))
    .map(r => ({
      id: r.id,
      actorName: r.actor_name,
      event: r.event,
      entityId: r.entity_id,
      payload: r.payload as Record<string, unknown> | null,
      createdAt: r.created_at,
    }))

  const hasManualAdjustments = manualAdjustments.length > 0

  return NextResponse.json({
    month: monthStr,
    year,
    monthNum: month,
    profitShareRate,
    isOutsideContractPeriod,
    revenue,
    cogs: cogsTotal,
    cogsBreakdown,
    grossProfit,
    operatingExpenses: {
      total: totalOperatingExpenses,
      nonRentalTotal: totalNonRentalExpenses,
      byCategory: expenseByCategory,
      lines: expenseLines,
      rental: {
        total: rentalTotal,
        records: rentalLines,
      },
    },
    grossOperatingProfit,
    landlordEntitlement,
    tenantProfit,
    status: landlordEntitlement > 0 ? 'profit_share_payable' : 'no_profit_share_payable',
    hasManualAdjustments,
    manualAdjustments,
  })
}
