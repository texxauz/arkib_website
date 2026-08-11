#!/usr/bin/env node
/**
 * Backfill script: hash all existing plain-text clock PINs with bcrypt.
 *
 * Run once after migration_006_clock_pin_hash.sql has been applied:
 *   node supabase/hash_clock_pins.js
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require('@supabase/supabase-js')
const bcrypt = require('bcryptjs')

const SALT_ROUNDS = 12

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, key)

  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, clock_pin')
    .not('clock_pin', 'is', null)
    .is('clock_pin_hash', null)

  if (error) { console.error('Fetch error:', error.message); process.exit(1) }
  if (!users?.length) { console.log('No users need clock PIN backfill.'); return }

  console.log(`Hashing clock PINs for ${users.length} users...`)

  for (const user of users) {
    if (!user.clock_pin) continue
    const hash = await bcrypt.hash(user.clock_pin, SALT_ROUNDS)
    const { error: updateErr } = await supabase
      .from('users')
      .update({ clock_pin_hash: hash })
      .eq('id', user.id)

    if (updateErr) {
      console.error(`  FAILED for ${user.full_name} (${user.id}): ${updateErr.message}`)
    } else {
      console.log(`  ✓ Hashed clock PIN for ${user.full_name}`)
    }
  }

  console.log('Done. Verify kiosk clock-in/out works, then uncomment Part B of migration_006_clock_pin_hash.sql to drop the plain-text column.')
}

main().catch(err => { console.error(err); process.exit(1) })
