// Run with: npx tsx __tests__/phone.test.ts
import { normalizePhone } from '../lib/phone'

const cases: [string, string | null][] = [
  ['0123456789',       '60123456789'],   // 1. local format, leading 0
  ['012-345 6789',     '60123456789'],   // 2. dashes and spaces
  ['+60123456789',     '60123456789'],   // 3. E.164 with +
  ['+60 12 345 6789',  '60123456789'],   // 4. E.164 with spaces
  ['60123456789',      '60123456789'],   // 5. already normalized
  ['+1-800-555-0100',  null],            // 6. non-Malaysian
  ['',                 null],            // 7. empty string
  ['abc',              null],            // 8. no digits
  ['  +60 12-345 6789  ', '60123456789'], // 9. leading/trailing whitespace
  ['011-1234 5678',    '601112345678'],  // 10. 011 prefix (4G)
]

let passed = 0
let failed = 0

for (const [input, expected] of cases) {
  const result = normalizePhone(input)
  if (result === expected) {
    console.log(`  ✓ normalizePhone(${JSON.stringify(input)}) = ${JSON.stringify(result)}`)
    passed++
  } else {
    console.error(`  ✗ normalizePhone(${JSON.stringify(input)}) = ${JSON.stringify(result)}, expected ${JSON.stringify(expected)}`)
    failed++
  }
}

console.log(`\n${passed}/${passed + failed} passed`)
if (failed > 0) process.exit(1)
