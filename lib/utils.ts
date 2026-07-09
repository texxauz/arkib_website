import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'RM'): string {
  return `${currency}${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(date: string | Date): string {
  // Parse date strings as local date to avoid UTC offset shifting the day
  const d = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(date + 'T00:00:00')
    : new Date(date)
  return d.toLocaleDateString('en-MY', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatMonth(month: number, year: number): string {
  return new Date(year, month - 1).toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })
}

export function getCurrentMonth(): number {
  return new Date().getMonth() + 1
}

export function getCurrentYear(): number {
  return new Date().getFullYear()
}

export function getMonthName(month: number): string {
  return new Date(2000, month - 1).toLocaleDateString('en-MY', { month: 'long' })
}

export function calculateHours(clockIn: string, clockOut: string): number {
  const start = new Date(clockIn)
  const end = new Date(clockOut)
  return Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 100) / 100
}

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  alcohol: 'Alcohol',
  fresh_ingredients: 'Fresh Ingredients',
  garnish: 'Garnish',
  food: 'Food',
  equipment: 'Equipment',
  repair: 'Repair',
  cleaning: 'Cleaning',
  marketing: 'Marketing',
  salary: 'Salary',
  claims: 'Claims',
  rental: 'Rental',
  utilities: 'Utilities',
  others: 'Others',
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  credit_card: 'Credit Card',
  qr_payment: 'QR Payment',
  online: 'Online Transfer',
  bank_transfer: 'Bank Transfer',
  other: 'Other',
}
