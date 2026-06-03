import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

function getUrl(): string {
  return import.meta.env.VITE_SUPABASE_URL ?? '';
}

function getKey(): string {
  return import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
}

function ensureClient(): SupabaseClient {
  if (!_supabase) {
    const url = getUrl();
    const key = getKey();
    if (!url || !key) throw new Error('Supabase env not configured');
    _supabase = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return _supabase;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return ensureClient()[prop as keyof SupabaseClient];
  },
});
