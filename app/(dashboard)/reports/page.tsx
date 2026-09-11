import { createClient } from '@/lib/supabase/server'
import { ReportsClient } from './ReportsClient'

export default async function ReportsPage() {
  const supabase = await createClient()
  const nowMYT = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const month = nowMYT.getUTCMonth() + 1
  const year = nowMYT.getUTCFullYear()
  const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)

  const [{ data: sales }, { data: expenses }, { data: cocktails }, { data: rawCocktailSales }, { data: rawOrders }] = await Promise.all([
    supabase.from('daily_sales').select('*').gte('date', firstOfMonth).lte('date', lastDay).is('deleted_at', null).order('date'),
    supabase.from('expenses').select('*').gte('date', firstOfMonth).lte('date', lastDay).is('deleted_at', null),
    supabase.from('cocktails').select('*').eq('is_active', true).order('profit_margin', { ascending: false }),
    supabase.from('cocktail_sales')
      .select('cocktail_name, quantity, unit_price, unit_cost')
      .gte('sold_at', firstOfMonth + 'T00:00:00Z')
      .lte('sold_at', new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) + 'T23:59:59Z'),
    supabase.from('pos_orders')
      .select('section, opened_at, closed_at')
      .eq('status', 'closed')
      .not('section', 'is', null)
      .not('closed_at', 'is', null)
      .gte('opened_at', firstOfMonth + 'T00:00:00Z')
      .lte('opened_at', lastDay + 'T23:59:59Z'),
  ])

  const cocktailVolumeMap: Record<string, { units: number; revenue: number; cogs: number }> = {}
  for (const cs of rawCocktailSales ?? []) {
    if (!cs.cocktail_name) continue
    if (!cocktailVolumeMap[cs.cocktail_name]) cocktailVolumeMap[cs.cocktail_name] = { units: 0, revenue: 0, cogs: 0 }
    cocktailVolumeMap[cs.cocktail_name].units += cs.quantity ?? 1
    cocktailVolumeMap[cs.cocktail_name].revenue += (cs.quantity ?? 1) * (cs.unit_price ?? 0)
    cocktailVolumeMap[cs.cocktail_name].cogs += (cs.quantity ?? 1) * (cs.unit_cost ?? 0)
  }

  const roomMap: Record<string, { totalMinutes: number; sessions: number; minMinutes: number; maxMinutes: number }> = {}
  for (const o of rawOrders ?? []) {
    if (!o.section || !o.opened_at || !o.closed_at) continue
    const mins = (new Date(o.closed_at).getTime() - new Date(o.opened_at).getTime()) / 60000
    if (mins <= 0 || mins > 720) continue
    if (!roomMap[o.section]) roomMap[o.section] = { totalMinutes: 0, sessions: 0, minMinutes: mins, maxMinutes: mins }
    roomMap[o.section].totalMinutes += mins
    roomMap[o.section].sessions++
    if (mins < roomMap[o.section].minMinutes) roomMap[o.section].minMinutes = mins
    if (mins > roomMap[o.section].maxMinutes) roomMap[o.section].maxMinutes = mins
  }
  const roomDwell = Object.entries(roomMap).map(([section, { totalMinutes, sessions, minMinutes, maxMinutes }]) => ({
    section,
    avgMinutes: Math.round(totalMinutes / sessions),
    minMinutes: Math.round(minMinutes),
    maxMinutes: Math.round(maxMinutes),
    sessions,
  })).sort((a, b) => b.sessions - a.sessions)

  return (
    <ReportsClient
      initialSales={sales ?? []}
      initialExpenses={expenses ?? []}
      initialCocktails={cocktails ?? []}
      initialCocktailVolume={cocktailVolumeMap}
      initialRoomDwell={roomDwell}
      initialMonth={month}
      initialYear={year}
    />
  )
}
