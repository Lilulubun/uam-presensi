import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env.local') });

const url = process.env.VITE_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  throw new Error('VITE_SUPABASE_URL and SUPABASE_SECRET_KEY required in env');
}

const supabase = createClient(url, secretKey, { auth: { persistSession: false } });

const DEMO_USERS = [
  { email: 'budi@uii.ac.id',  name: 'Budi Santoso', role: 'pengajar', nim: '20521001', password: process.env.PWD_PENGAJAR },
  { email: 'siti@uii.ac.id',  name: 'Siti Rahayu',  role: 'pengajar', nim: '20521002', password: process.env.PWD_PENGAJAR },
  { email: 'ahmad@uii.ac.id', name: 'Ahmad Fauzi',  role: 'pengajar', nim: '20521003', password: process.env.PWD_PENGAJAR },
  { email: 'admin@uam.id',    name: 'Admin UAM',    role: 'pengurus', nim: null,      password: process.env.PWD_PENGURUS },
] as const;

async function main() {
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw new Error(`listUsers failed: ${listErr.message}`);
  const existingByEmail = new Map((list?.users ?? []).map(u => [u.email ?? '', u]));

  for (const u of DEMO_USERS) {
    if (!u.password) {
      console.error(`skip ${u.email}: password env not set`);
      continue;
    }

    let userId: string;
    const found = existingByEmail.get(u.email);
    if (found) {
      userId = found.id;
      console.log(`exists: ${u.email} (${userId})`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
      });
      if (error || !data.user) {
        console.error(`create ${u.email} failed:`, error?.message ?? 'no user');
        continue;
      }
      userId = data.user.id;
      console.log(`created: ${u.email} (${userId})`);
    }

    const { error: profileErr } = await supabase.from('users').upsert(
      { id: userId, email: u.email, name: u.name, role: u.role, nim: u.nim },
      { onConflict: 'id' },
    );
    if (profileErr) console.error(`profile ${u.email} failed:`, profileErr.message);
    else console.log(`profile upserted: ${u.email}`);
  }
  console.log('seed complete');
}

main().catch(err => { console.error(err); process.exit(1); });
