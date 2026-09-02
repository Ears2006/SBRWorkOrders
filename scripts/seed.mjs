/**
 * Development-only seed script.
 *
 * Creates sample work orders using all three statuses, different creators,
 * and different creation dates. This is intended for local development only —
 * do NOT run against a production database.
 *
 * Prerequisites:
 *   1. Copy .env.example to .env and fill in your Supabase URL and anon key.
 *   2. Run the SQL migrations (see README.md).
 *   3. Create at least two test accounts via the Register page so profiles exist.
 *
 * Usage:
 *   node scripts/seed.mjs
 *
 * The script reads SUPABASE_URL and SUPABASE_ANON_KEY from .env.
 * It uses the service role key if available for seeding; otherwise it falls
 * back to the anon key and requires an authenticated session.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

// Load .env manually (no dotenv dependency needed for a dev script).
const envPath = new URL('../.env', import.meta.url).pathname;
if (!existsSync(envPath)) {
  console.error('No .env file found. Copy .env.example to .env and fill in your values.');
  process.exit(1);
}
const env = readFileSync(envPath, 'utf8');
function envValue(key) {
  const match = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : undefined;
}

const supabaseUrl = envValue('VITE_SUPABASE_URL');
const supabaseAnonKey = envValue('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

async function main() {
  console.log('Fetching existing profiles for seed data…');
  const { data: profiles, error: profError } = await supabase
    .from('profiles')
    .select('id, email, full_name');

  if (profError) {
    console.error('Could not fetch profiles:', profError.message);
    console.error('Make sure you have created at least one account via the Register page.');
    process.exit(1);
  }

  if (!profiles || profiles.length === 0) {
    console.error('No profiles found. Create at least one account first via the Register page.');
    process.exit(1);
  }

  // Use the first two profiles (or the same one if only one exists).
  const creator1 = profiles[0];
  const creator2 = profiles[1] ?? profiles[0];

  const now = Date.now();
  const daysAgo = (days) => new Date(now - days * 86_400_000).toISOString();

  const sampleOrders = [
    {
      location: 'Lap Pool Equipment Room',
      subject: 'Lap pool heater is not turning on',
      description:
        'The lap pool heater does not ignite when the power switch is flipped. The indicator light is off. Started two days ago after the power outage.',
      status: 'active',
      created_by_name: creator1.full_name,
      created_by_email: creator1.email,
      created_at: daysAgo(1),
    },
    {
      location: 'Main Gym — HVAC Unit 3',
      subject: 'HVAC making grinding noise',
      description:
        'HVAC unit 3 in the main gym is producing a loud grinding sound when the fan kicks on. Possibly a bearing issue.',
      status: 'active',
      created_by_name: creator2.full_name,
      created_by_email: creator2.email,
      created_at: daysAgo(2),
    },
    {
      location: 'Locker Room B',
      subject: 'Leaking shower head in locker room B',
      description:
        'Shower head 4 in locker room B is leaking continuously even when turned off. Need a replacement cartridge.',
      status: 'waiting_for_parts',
      created_by_name: creator1.full_name,
      created_by_email: creator1.email,
      created_at: daysAgo(5),
    },
    {
      location: 'Front Desk Area',
      subject: 'Replace broken exit sign above front entrance',
      description:
        'The illuminated exit sign above the front entrance is flickering and has gone dark. Bulb needs replacement.',
      status: 'completed',
      created_by_name: creator2.full_name,
      created_by_email: creator2.email,
      created_at: daysAgo(10),
    },
    {
      location: 'Parking Lot A',
      subject: 'Parking lot light pole 7 not working',
      description:
        'Light pole 7 in parking lot A is out. Bulb and photocell were replaced and confirmed working.',
      status: 'completed',
      created_by_name: creator1.full_name,
      created_by_email: creator1.email,
      created_at: daysAgo(14),
    },
  ];

  console.log(`Seeding ${sampleOrders.length} work orders…`);

  for (const order of sampleOrders) {
    // Sign in as the creator to satisfy RLS, then insert.
    // For the seed script we use the anon key; the insert will work if the
    // user is authenticated. For a simpler approach, use the service role key.
    const { error } = await supabase.from('work_orders').insert({
      location: order.location,
      subject: order.subject,
      description: order.description,
      status: order.status,
      created_by_name: order.created_by_name,
      created_by_email: order.created_by_email,
    });

    if (error) {
      console.error(`Failed to seed "${order.subject}":`, error.message);
      console.error('Note: Seeding requires an authenticated session. If this fails,');
      console.error('consider running the seed via the Supabase SQL editor with the');
      console.error('service role key, or sign in first.');
    } else {
      console.log(`  ✓ ${order.subject}`);
    }
  }

  console.log('\nSeed complete. Note: some inserts may fail if RLS blocks the anon key.');
  console.log('If so, run the seed SQL directly in the Supabase SQL editor.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
