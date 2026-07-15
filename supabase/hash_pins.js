#!/usr/bin/env node
/**
 * Backfill script: hash all existing plain-text manager PINs with bcrypt.
 *
 * Run once after migration_002_pin_hashing.sql has been applied:
 *   node supabase/hash_pins.js
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Install deps if needed: npm install @supabase/supabase-js bcryptjs
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

  // Fetch all users who have a plain-text PIN but no hash yet
  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, manager_pin')
    .not('manager_pin', 'is', null)
    .is('manager_pin_hash', null)

  if (error) { console.error('Fetch error:', error.message); process.exit(1) }
  if (!users?.length) { console.log('No users need PIN backfill.'); return }

  console.log(`Hashing PINs for ${users.length} users...`)

  for (const user of users) {
    if (!user.manager_pin) continue
    const hash = await bcrypt.hash(user.manager_pin, SALT_ROUNDS)
    const { error: updateErr } = await supabase
      .from('users')
      .update({ manager_pin_hash: hash })
      .eq('id', user.id)

    if (updateErr) {
      console.error(`  FAILED for ${user.full_name} (${user.id}): ${updateErr.message}`)
    } else {
      console.log(`  ✓ Hashed PIN for ${user.full_name}`)
    }
  }

  console.log('Done. Verify PIN login works, then run Part B of migration_002_pin_hashing.sql to drop the plain-text column.')
}

main().catch(err => { console.error(err); process.exit(1) })
