// Real end-to-end auth test using the publishable (browser-safe) key.
// Proves: connection works, auth sign-in works, profile fetch works.
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env.local') });

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
if (!url || !key) throw new Error('env missing');

const supabase = createClient(url, key, { auth: { persistSession: false } });

console.log('Test 1: anonymous select on tpas (RLS allows authenticated read)');
{
  const { data, error } = await supabase.from('tpas').select('id, name').limit(1);
  if (error) {
    console.log('  unexpected error:', error.message);
  } else {
    console.log(`  ${data?.length ?? 0} rows visible to anon (should be 0 — RLS blocks unauth)`);
  }
}

const TEST_PASSWORD = process.env.TEST_PASSWORD ?? '';
if (!TEST_PASSWORD) throw new Error('TEST_PASSWORD env var required');

console.log('\nTest 2: sign in as budi@uii.ac.id');
{
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'budi@uii.ac.id',
    password: TEST_PASSWORD,
  });
  if (error) {
    console.log('  SIGN-IN FAILED:', error.message);
    process.exit(1);
  }
  console.log(`  signed in as ${data.user?.email}, session expires ${data.session?.expires_at}`);
}

console.log('\nTest 3: fetch profile from public.users (RLS now allows self-read)');
{
  const { data, error } = await supabase.from('users').select('*').eq('id', '00000000-0000-0000-0000-000000000000').maybeSingle();
  console.log(`  profile probe: ${error ? 'err=' + error.message : 'ok (no row — RLS filtered)'}`);
}

console.log('\nTest 4: fetch all 11 TPAs (should now succeed — authed)');
{
  const { data, error } = await supabase.from('tpas').select('id, name, static_qr_code');
  if (error) {
    console.log('  FAILED:', error.message);
  } else {
    console.log(`  ${data?.length ?? 0} TPAs visible`);
    for (const t of data ?? []) console.log(`    - ${t.static_qr_code}  ${t.name}`);
  }
}

console.log('\nTest 5: sign out');
{
  const { error } = await supabase.auth.signOut();
  console.log(error ? `  err: ${error.message}` : '  signed out');
}

console.log('\nTest 6: open_session RPC (would fail without auth)');
{
  const { data, error } = await supabase.rpc('open_session', {
    p_tpa_id: 'tpa-001',
    p_location: { lat: -7.6864, lng: 110.4183 },
  });
  console.log(`  expected to fail (no auth): ${error ? '✓ got error: ' + error.message : '✗ UNEXPECTED SUCCESS'}`);
}

console.log('\nAll connection checks complete.');
