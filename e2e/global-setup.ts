import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function globalSetup() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    // Close all active sessions
    const { data: sessions, error: listErr } = await supabase
      .from('sessions')
      .select('id')
      .eq('is_active', true)
      .limit(50);

    if (!listErr && sessions && sessions.length > 0) {
      console.log(`Cleaning up ${sessions.length} active session(s)...`);
      for (const s of sessions) {
        await supabase.from('sessions')
          .update({ is_active: false, date_closed: new Date().toISOString(), close_notes: 'E2E cleanup' })
          .eq('id', s.id);
      }
      console.log('Active sessions closed');
    }
  }
}

export default globalSetup;
