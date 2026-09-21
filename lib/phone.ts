/**
 * Normalize a Malaysian phone number to 60XXXXXXXXX format.
 * Strips all non-digit characters, then:
 *   - Starts with '60' → already normalized
 *   - Starts with '0'  → replace leading 0 with 60
 *   - Anything else    → return null (unrecognized / non-Malaysian)
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('60')) return digits
  if (digits.startsWith('0')) return '60' + digits.slice(1)
  return null
}
