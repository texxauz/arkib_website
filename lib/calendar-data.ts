// Malaysia + Singapore public holidays and festive seasons
// Islamic dates are approximate (lunar calendar shifts ~11 days/year)

export interface Holiday {
  date: string // YYYY-MM-DD
  name: string
  country: 'MY' | 'SG' | 'BOTH'
  type: 'public_holiday'
}

export interface FestiveSeason {
  name: string
  start: string // YYYY-MM-DD
  end: string
  color: string // tailwind bg class
  textColor: string
}

export const HOLIDAYS: Holiday[] = [
  // ── 2025 ─────────────────────────────────────────────────────────
  { date: '2025-01-01', name: "New Year's Day",         country: 'BOTH', type: 'public_holiday' },
  { date: '2025-01-29', name: 'Chinese New Year',        country: 'BOTH', type: 'public_holiday' },
  { date: '2025-01-30', name: 'Chinese New Year (Day 2)',country: 'BOTH', type: 'public_holiday' },
  { date: '2025-02-01', name: 'Federal Territory Day',   country: 'MY',   type: 'public_holiday' },
  { date: '2025-03-29', name: 'Nuzul Al-Quran',          country: 'MY',   type: 'public_holiday' },
  { date: '2025-03-30', name: 'Hari Raya Aidilfitri',    country: 'BOTH', type: 'public_holiday' },
  { date: '2025-03-31', name: 'Hari Raya (Day 2)',        country: 'BOTH', type: 'public_holiday' },
  { date: '2025-04-18', name: 'Good Friday',             country: 'SG',   type: 'public_holiday' },
  { date: '2025-05-01', name: 'Labour Day',              country: 'BOTH', type: 'public_holiday' },
  { date: '2025-05-12', name: 'Wesak Day',               country: 'BOTH', type: 'public_holiday' },
  { date: '2025-06-02', name: 'Hari Raya Aidiladha',     country: 'BOTH', type: 'public_holiday' },
  { date: '2025-06-07', name: "Agong's Birthday",        country: 'MY',   type: 'public_holiday' },
  { date: '2025-06-27', name: 'Awal Muharram',           country: 'MY',   type: 'public_holiday' },
  { date: '2025-08-09', name: 'Singapore National Day',  country: 'SG',   type: 'public_holiday' },
  { date: '2025-08-31', name: 'National Day',            country: 'MY',   type: 'public_holiday' },
  { date: '2025-09-05', name: "Prophet's Birthday",      country: 'MY',   type: 'public_holiday' },
  { date: '2025-09-16', name: 'Malaysia Day',            country: 'MY',   type: 'public_holiday' },
  { date: '2025-10-20', name: 'Deepavali',               country: 'BOTH', type: 'public_holiday' },
  { date: '2025-12-25', name: 'Christmas Day',           country: 'BOTH', type: 'public_holiday' },

  // ── 2026 ─────────────────────────────────────────────────────────
  { date: '2026-01-01', name: "New Year's Day",         country: 'BOTH', type: 'public_holiday' },
  { date: '2026-01-29', name: 'Chinese New Year',        country: 'BOTH', type: 'public_holiday' },
  { date: '2026-01-30', name: 'Chinese New Year (Day 2)',country: 'BOTH', type: 'public_holiday' },
  { date: '2026-02-02', name: 'Federal Territory Day',   country: 'MY',   type: 'public_holiday' },
  { date: '2026-03-20', name: 'Hari Raya Aidilfitri',    country: 'BOTH', type: 'public_holiday' },
  { date: '2026-03-21', name: 'Hari Raya (Day 2)',        country: 'BOTH', type: 'public_holiday' },
  { date: '2026-03-28', name: 'Good Friday',             country: 'SG',   type: 'public_holiday' },
  { date: '2026-04-01', name: 'Nuzul Al-Quran',          country: 'MY',   type: 'public_holiday' },
  { date: '2026-05-01', name: 'Labour Day',              country: 'BOTH', type: 'public_holiday' },
  { date: '2026-05-31', name: 'Wesak Day',               country: 'BOTH', type: 'public_holiday' },
  { date: '2026-05-27', name: 'Hari Raya Aidiladha',     country: 'BOTH', type: 'public_holiday' },
  { date: '2026-06-06', name: "Agong's Birthday",        country: 'MY',   type: 'public_holiday' },
  { date: '2026-06-17', name: 'Awal Muharram',           country: 'MY',   type: 'public_holiday' },
  { date: '2026-08-09', name: 'Singapore National Day',  country: 'SG',   type: 'public_holiday' },
  { date: '2026-08-31', name: 'National Day',            country: 'MY',   type: 'public_holiday' },
  { date: '2026-08-26', name: "Prophet's Birthday",      country: 'MY',   type: 'public_holiday' },
  { date: '2026-09-16', name: 'Malaysia Day',            country: 'MY',   type: 'public_holiday' },
  { date: '2026-11-08', name: 'Deepavali',               country: 'BOTH', type: 'public_holiday' },
  { date: '2026-12-25', name: 'Christmas Day',           country: 'BOTH', type: 'public_holiday' },
]

export const FESTIVE_SEASONS: FestiveSeason[] = [
  // ── 2025 ─────────────────────────────────────────────────────────
  { name: 'Chinese New Year',  start: '2025-01-24', end: '2025-02-12', color: 'bg-red-500/10',    textColor: 'text-red-400' },
  { name: "Valentine's Day",   start: '2025-02-10', end: '2025-02-14', color: 'bg-pink-500/10',   textColor: 'text-pink-400' },
  { name: 'Ramadan',           start: '2025-03-01', end: '2025-03-29', color: 'bg-emerald-500/10',textColor: 'text-emerald-400' },
  { name: 'Hari Raya Season',  start: '2025-03-30', end: '2025-04-13', color: 'bg-emerald-500/15',textColor: 'text-emerald-400' },
  { name: "St. Patrick's Day", start: '2025-03-17', end: '2025-03-17', color: 'bg-green-500/10',  textColor: 'text-green-400' },
  { name: 'Songkran Season',   start: '2025-04-10', end: '2025-04-17', color: 'bg-sky-500/10',    textColor: 'text-sky-400' },
  { name: 'Oktoberfest',       start: '2025-09-20', end: '2025-10-05', color: 'bg-amber-500/10',  textColor: 'text-amber-400' },
  { name: 'Deepavali Season',  start: '2025-10-15', end: '2025-10-25', color: 'bg-orange-500/10', textColor: 'text-orange-400' },
  { name: 'Halloween',         start: '2025-10-24', end: '2025-10-31', color: 'bg-orange-500/15', textColor: 'text-orange-400' },
  { name: 'Christmas Season',  start: '2025-12-20', end: '2025-12-31', color: 'bg-red-500/10',    textColor: 'text-red-400' },

  // ── 2026 ─────────────────────────────────────────────────────────
  { name: "New Year's",        start: '2026-01-01', end: '2026-01-03', color: 'bg-yellow-500/10', textColor: 'text-yellow-400' },
  { name: 'Chinese New Year',  start: '2026-01-24', end: '2026-02-11', color: 'bg-red-500/10',    textColor: 'text-red-400' },
  { name: "Valentine's Day",   start: '2026-02-10', end: '2026-02-14', color: 'bg-pink-500/10',   textColor: 'text-pink-400' },
  { name: 'Ramadan',           start: '2026-02-18', end: '2026-03-19', color: 'bg-emerald-500/10',textColor: 'text-emerald-400' },
  { name: 'Hari Raya Season',  start: '2026-03-20', end: '2026-04-03', color: 'bg-emerald-500/15',textColor: 'text-emerald-400' },
  { name: "St. Patrick's Day", start: '2026-03-17', end: '2026-03-17', color: 'bg-green-500/10',  textColor: 'text-green-400' },
  { name: 'Songkran Season',   start: '2026-04-10', end: '2026-04-17', color: 'bg-sky-500/10',    textColor: 'text-sky-400' },
  { name: 'Oktoberfest',       start: '2026-09-19', end: '2026-10-04', color: 'bg-amber-500/10',  textColor: 'text-amber-400' },
  { name: 'Deepavali Season',  start: '2026-11-03', end: '2026-11-12', color: 'bg-orange-500/10', textColor: 'text-orange-400' },
  { name: 'Halloween',         start: '2026-10-24', end: '2026-10-31', color: 'bg-orange-500/15', textColor: 'text-orange-400' },
  { name: 'Christmas Season',  start: '2026-12-20', end: '2026-12-31', color: 'bg-red-500/10',    textColor: 'text-red-400' },
]

export function getHolidaysForMonth(year: number, month: number): Holiday[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return HOLIDAYS.filter(h => h.date.startsWith(prefix))
}

export function getFestivesForMonth(year: number, month: number): FestiveSeason[] {
  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate().toString().padStart(2, '0')}`
  return FESTIVE_SEASONS.filter(f => f.start <= lastDay && f.end >= firstDay)
}

export function getFestivesForDate(dateStr: string): FestiveSeason[] {
  return FESTIVE_SEASONS.filter(f => f.start <= dateStr && f.end >= dateStr)
}
