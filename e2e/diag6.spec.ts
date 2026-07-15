import { test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

test('diag: check TPA coordinates in DB', async () => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: tpas } = await supabase.from('tpas').select('*');
  console.log('TPA data:');
  for (const t of tpas || []) {
    console.log(`  ${t.id}: ${t.name} — lat=${t.location.lat}, lng=${t.location.lng}, radius=${t.location.radius}`);
  }
});
