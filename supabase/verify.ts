import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env.local') });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('env missing');

const supabase = createClient(url, key, { auth: { persistSession: false } });

const tables = ['users', 'tpas', 'sessions', 'attendances', 'used_tokens', 'interaction_logs'];
for (const t of tables) {
  const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
  console.log(`${t.padEnd(20)} ${error ? `ERR: ${error.message}` : `count=${count}`}`);
}

const { data: users } = await supabase.auth.admin.listUsers({ perPage: 200 });
console.log(`\nauth.users: ${users?.users.length ?? 0} rows`);
for (const u of users?.users ?? []) {
  console.log(`  - ${u.email} (created ${u.created_at})`);
}

const { data: tpas, error: tpaErr } = await supabase.from('tpas').select('id, name, static_qr_code');
console.log(`\npublic.tpas: ${tpas?.length ?? 0} rows`);
if (!tpaErr) for (const t of tpas ?? []) console.log(`  - ${t.id}  ${t.name.padEnd(35)} ${t.static_qr_code}`);

const { data: profs } = await supabase.from('users').select('id, email, name, role, nim');
console.log(`\npublic.users: ${profs?.length ?? 0} rows`);
for (const p of profs ?? []) console.log(`  - ${p.email.padEnd(22)} ${p.name.padEnd(18)} role=${p.role} nim=${p.nim ?? '-'}`);
