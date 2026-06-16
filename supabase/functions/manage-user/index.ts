// Supabase Edge Function — manage-user
// Actions: create, reset-pw
// Requires service_role key — deploy with --no-verify-jwt for admin-only access
// Deploy: supabase functions deploy manage-user --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('PROJECT_URL')!;
const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

interface CreatePayload {
  action: 'create';
  email: string;
  name: string;
  nim?: string;
  role?: 'pengajar' | 'pengurus';
  password?: string;
  tpaIds?: string[];
}

interface ResetPwPayload {
  action: 'reset-pw';
  email: string;
  mode: 'temporary';
}

type Payload = CreatePayload | ResetPwPayload;

async function handleCreate(p: CreatePayload): Promise<Response> {
  const role = p.role || 'pengajar';
  const password = p.password || `${p.nim || '1234'}uam`;

  const { data: authUser, error: createErr } = await supabase.auth.admin.createUser({
    email: p.email,
    password,
    email_confirm: true,
  });
  if (createErr) {
    if (createErr.message.includes('already been registered') || createErr.message.includes('already registered')) {
      return jsonResponse({ error: 'Email sudah terdaftar' }, 409);
    }
    return jsonResponse({ error: createErr.message }, 500);
  }
  const userId = authUser.user!.id;

  const { error: profileErr } = await supabase.from('users').insert({
    id: userId,
    email: p.email,
    name: p.name,
    role,
    nim: p.nim || null,
  });
  if (profileErr) {
    await supabase.auth.admin.deleteUser(userId);
    return jsonResponse({ error: profileErr.message }, 500);
  }

  if (role === 'pengajar' && p.tpaIds && p.tpaIds.length > 0) {
    const rows = p.tpaIds.map((tpaId) => ({ user_id: userId, tpa_id: tpaId }));
    const { error: tpaErr } = await supabase.from('pengajar_tpa').insert(rows);
    if (tpaErr) {
      console.error('TPA assignment failed:', tpaErr.message);
    }
  }

  return jsonResponse({
    success: true,
    userId,
  });
}

async function handleResetPw(p: ResetPwPayload): Promise<Response> {
  const { data: users, error: lookupErr } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', p.email)
    .limit(1);

  if (lookupErr || !users || users.length === 0) {
    return jsonResponse({ error: 'Pengguna tidak ditemukan' }, 404);
  }

  const user = users[0];

  const { data: profiles } = await supabase
    .from('users')
    .select('nim')
    .eq('id', user.id)
    .single();

  const nim = (profiles as { nim?: string } | null)?.nim ?? 'XXXX';
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  const tempPassword = `UAM-${nim}-${randomDigits}`;

  const { error: updateErr } = await supabase.auth.admin.updateUser(user.id, {
    password: tempPassword,
  });
  if (updateErr) {
    return jsonResponse({ error: updateErr.message }, 500);
  }

  return jsonResponse({
    success: true,
    method: 'temporary',
    temporaryPassword: tempPassword,
    userId: user.id,
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const payload: Payload = await req.json();

    switch (payload.action) {
      case 'create':
        return await handleCreate(payload);
      case 'reset-pw':
        return await handleResetPw(payload);
      default:
        return jsonResponse({ error: 'Unknown action' }, 400);
    }
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
    );
  }
});
