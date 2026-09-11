import { CalendarClient } from './CalendarClient'

export default function CalendarPage() {
  const nowMYT = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const month = nowMYT.getUTCMonth() + 1
  const year = nowMYT.getUTCFullYear()
  return <CalendarClient initialMonth={month} initialYear={year} />
}
