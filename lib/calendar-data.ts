// Malaysia + Singapore public holidays and notable festive dates
// Islamic dates are approximate (lunar calendar shifts ~11 days/year)

export type Country = 'MY' | 'SG' | 'BOTH'
export type DayType = 'public_holiday' | 'festive'

export interface MarkedDay {
  date: string       // YYYY-MM-DD
  name: string
  country: Country   // public_holiday: which country it applies to; festive: 'BOTH'
  type: DayType
  color: string      // tailwind text color class
}

export const MARKED_DAYS: MarkedDay[] = [
  // ─── 2025 Public Holidays ────────────────────────────────────────
  { date: '2025-01-01', name: "New Year's Day",          country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2025-01-29', name: 'Chinese New Year',         country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2025-01-30', name: 'Chinese New Year Day 2',   country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2025-02-01', name: 'Federal Territory Day',    country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2025-03-29', name: 'Nuzul Al-Quran',           country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2025-03-30', name: 'Hari Raya Aidilfitri',     country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2025-03-31', name: 'Hari Raya Aidilfitri Day 2',country:'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2025-04-18', name: 'Good Friday',              country: 'SG',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2025-05-01', name: 'Labour Day',               country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2025-05-12', name: 'Wesak Day',                country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2025-06-02', name: 'Hari Raya Aidiladha',      country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2025-06-07', name: "Agong's Birthday",         country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2025-06-27', name: 'Awal Muharram',            country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2025-08-09', name: 'National Day',             country: 'SG',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2025-08-31', name: 'National Day',             country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2025-09-05', name: "Prophet's Birthday",       country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2025-09-16', name: 'Malaysia Day',             country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2025-10-20', name: 'Deepavali',                country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2025-12-25', name: 'Christmas Day',            country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },

  // ─── 2025 Festive / Commercial Days ─────────────────────────────
  { date: '2025-02-14', name: "Valentine's Day",          country: 'BOTH', type: 'festive', color: 'text-pink-400' },
  { date: '2025-03-17', name: "St. Patrick's Day",        country: 'BOTH', type: 'festive', color: 'text-emerald-400' },
  { date: '2025-10-31', name: 'Halloween',                country: 'BOTH', type: 'festive', color: 'text-orange-400' },
  { date: '2025-12-24', name: 'Christmas Eve',            country: 'BOTH', type: 'festive', color: 'text-red-400' },
  { date: '2025-12-31', name: "New Year's Eve",           country: 'BOTH', type: 'festive', color: 'text-yellow-400' },

  // ─── 2026 Public Holidays ────────────────────────────────────────
  { date: '2026-01-01', name: "New Year's Day",           country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2026-01-29', name: 'Chinese New Year',          country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2026-01-30', name: 'Chinese New Year Day 2',    country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2026-02-02', name: 'Federal Territory Day',     country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2026-03-20', name: 'Hari Raya Aidilfitri',      country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2026-03-21', name: 'Hari Raya Aidilfitri Day 2',country:'BOTH',  type: 'public_holiday', color: 'text-rose-400' },
  { date: '2026-03-28', name: 'Good Friday',               country: 'SG',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2026-04-01', name: 'Nuzul Al-Quran',            country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2026-05-01', name: 'Labour Day',                country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2026-05-27', name: 'Hari Raya Aidiladha',       country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2026-05-31', name: 'Wesak Day',                 country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2026-06-06', name: "Agong's Birthday",          country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2026-06-17', name: 'Awal Muharram',             country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2026-08-09', name: 'National Day',              country: 'SG',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2026-08-26', name: "Prophet's Birthday",        country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2026-08-31', name: 'National Day',              country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2026-09-16', name: 'Malaysia Day',              country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2026-11-08', name: 'Deepavali',                 country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2026-12-25', name: 'Christmas Day',             country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },

  // ─── 2026 Festive / Commercial Days ─────────────────────────────
  { date: '2026-02-14', name: "Valentine's Day",           country: 'BOTH', type: 'festive', color: 'text-pink-400' },
  { date: '2026-03-17', name: "St. Patrick's Day",         country: 'BOTH', type: 'festive', color: 'text-emerald-400' },
  { date: '2026-10-31', name: 'Halloween',                 country: 'BOTH', type: 'festive', color: 'text-orange-400' },
  { date: '2026-12-24', name: 'Christmas Eve',             country: 'BOTH', type: 'festive', color: 'text-red-400' },
  { date: '2026-12-31', name: "New Year's Eve",            country: 'BOTH', type: 'festive', color: 'text-yellow-400' },

  // ─── 2027 Public Holidays ────────────────────────────────────────
  { date: '2027-01-01', name: "New Year's Day",            country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2027-01-17', name: 'Chinese New Year',           country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2027-01-18', name: 'Chinese New Year Day 2',     country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2027-02-01', name: 'Federal Territory Day',      country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2027-03-09', name: 'Hari Raya Aidilfitri',       country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2027-03-10', name: 'Hari Raya Aidilfitri Day 2', country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2027-03-21', name: 'Nuzul Al-Quran',             country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2027-04-02', name: 'Good Friday',                country: 'SG',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2027-05-01', name: 'Labour Day',                 country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2027-05-16', name: 'Hari Raya Aidiladha',        country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2027-05-21', name: 'Wesak Day',                  country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2027-06-05', name: "Agong's Birthday",           country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2027-06-07', name: 'Awal Muharram',              country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2027-08-09', name: 'National Day',               country: 'SG',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2027-08-15', name: "Prophet's Birthday",         country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2027-08-31', name: 'National Day',               country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2027-09-16', name: 'Malaysia Day',               country: 'MY',   type: 'public_holiday', color: 'text-rose-400' },
  { date: '2027-10-29', name: 'Deepavali',                  country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },
  { date: '2027-12-25', name: 'Christmas Day',              country: 'BOTH', type: 'public_holiday', color: 'text-rose-400' },

  // ─── 2027 Festive / Commercial Days ─────────────────────────────
  { date: '2027-02-14', name: "Valentine's Day",            country: 'BOTH', type: 'festive', color: 'text-pink-400' },
  { date: '2027-03-17', name: "St. Patrick's Day",          country: 'BOTH', type: 'festive', color: 'text-emerald-400' },
  { date: '2027-10-31', name: 'Halloween',                  country: 'BOTH', type: 'festive', color: 'text-orange-400' },
  { date: '2027-12-24', name: 'Christmas Eve',              country: 'BOTH', type: 'festive', color: 'text-red-400' },
  { date: '2027-12-31', name: "New Year's Eve",             country: 'BOTH', type: 'festive', color: 'text-yellow-400' },
]

export function getMarkedDaysForMonth(year: number, month: number): MarkedDay[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return MARKED_DAYS.filter(d => d.date.startsWith(prefix))
}

export function getMarkedDaysForDate(dateStr: string): MarkedDay[] {
  return MARKED_DAYS.filter(d => d.date === dateStr)
}

export const COUNTRY_LABEL: Record<string, string> = {
  MY: '🇲🇾 Malaysia',
  SG: '🇸🇬 Singapore',
  BOTH: '🇲🇾🇸🇬 MY & SG',
}

export const COUNTRY_BADGE: Record<string, string> = {
  MY: '🇲🇾 MY',
  SG: '🇸🇬 SG',
  BOTH: '🇲🇾🇸🇬',
}
