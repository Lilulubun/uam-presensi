// Supabase Edge Function — manage-user
// Actions: create, reset-pw
// Requires service_role key — deploy with --no-verify-jwt for admin-only access
// Deploy: supabase functions deploy manage-user --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

async function handleCreate(p: CreatePayload, callerId: string): Promise<Response> {
  const role = p.role || 'pengajar';

  if (role === 'pengurus') {
    return jsonResponse({ error: 'Forbidden: cannot create pengurus' }, 403);
  }
  if (!p.nim) {
    return jsonResponse({ error: 'NIM required' }, 400);
  }

  const initialPassword = `${p.nim}uam`;

  const { data: authUser, error: createErr } = await supabase.auth.admin.createUser({
    email: p.email,
    password: initialPassword,
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
    must_change_password: true,
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

  // Audit log
  await supabase.from('interaction_logs').insert({
    event_type: 'admin_create_user',
    user_id: callerId,
    session_id: null,
    metadata: { target_email: p.email, target_id: userId }
  });

  return jsonResponse({
    success: true,
    userId,
  });
}

async function handleResetPw(p: ResetPwPayload, callerId: string): Promise<Response> {
  const { data: users, error: lookupErr } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('email', p.email)
    .limit(1);

  if (lookupErr || !users || users.length === 0) {
    return jsonResponse({ error: 'Pengguna tidak ditemukan' }, 404);
  }

  const user = users[0];

  if (user.role === 'pengurus') {
    return jsonResponse({ error: 'Forbidden: cannot reset pengurus' }, 403);
  }

  const { data: profiles } = await supabase
    .from('users')
    .select('nim')
    .eq('id', user.id)
    .single();

  const nim = (profiles as { nim?: string } | null)?.nim;
  if (!nim) {
    return jsonResponse({ error: 'User does not have a NIM' }, 400);
  }
  const resetPassword = `${nim}uam`;

  const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
    password: resetPassword,
  });
  if (updateErr) {
    return jsonResponse({ error: updateErr.message }, 500);
  }

  const { error: flagErr } = await supabase
    .from('users')
    .update({ must_change_password: true })
    .eq('id', user.id);

  if (flagErr) {
    return jsonResponse({ error: 'Failed to update password flag' }, 500);
  }

  await supabase.from('interaction_logs').insert({
    event_type: 'admin_reset_password',
    user_id: callerId,
    session_id: null,
    metadata: { target_email: p.email, target_id: user.id }
  });

  return jsonResponse({
    success: true,
    message: 'Password berhasil direset',
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
    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: callerUser }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !callerUser) {
      return jsonResponse({ error: 'Invalid or expired token' }, 401);
    }

    // Verify caller is pengurus
    const { data: callerProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (profileError || callerProfile?.role !== 'pengurus') {
      return jsonResponse({ error: 'Forbidden: only pengurus can manage users' }, 403);
    }

    const payload: Payload = await req.json();

    switch (payload.action) {
      case 'create':
        return await handleCreate(payload, callerUser.id);
      case 'reset-pw':
        return await handleResetPw(payload, callerUser.id);
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
