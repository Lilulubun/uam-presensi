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

interface CreatePayload {
  action: 'create';
  email: string;
  name: string;
  nim: string;
  tpaIds: string[];
}

interface ResetPwPayload {
  action: 'reset-pw';
  email: string;
  mode: 'magiclink' | 'temporary';
}

type Payload = CreatePayload | ResetPwPayload;

async function handleCreate(p: CreatePayload): Promise<Response> {
  // 1. Create auth user (auto-confirm email)
  const { data: authUser, error: createErr } = await supabase.auth.admin.createUser({
    email: p.email,
    password: crypto.randomUUID().slice(0, 12),
    email_confirm: true,
  });
  if (createErr) {
      if (createErr.message.includes('already been registered') || createErr.message.includes('already registered')) {
      return new Response(JSON.stringify({ error: 'Email sudah terdaftar' }), { status: 409 });
    }
    return new Response(JSON.stringify({ error: createErr.message }), { status: 500 });
  }
  const userId = authUser.user!.id;

  // 2. Insert profile
  const { error: profileErr } = await supabase.from('users').insert({
    id: userId,
    email: p.email,
    name: p.name,
    role: 'pengajar',
    nim: p.nim,
  });
  if (profileErr) {
    // Rollback auth user
    await supabase.auth.admin.deleteUser(userId);
    return new Response(JSON.stringify({ error: profileErr.message }), { status: 500 });
  }

  // 3. Assign TPAs
  if (p.tpaIds.length > 0) {
    const rows = p.tpaIds.map((tpaId) => ({ user_id: userId, tpa_id: tpaId }));
    const { error: tpaErr } = await supabase.from('pengajar_tpa').insert(rows);
    if (tpaErr) {
      // Non-critical — don't rollback
      console.error('TPA assignment failed:', tpaErr.message);
    }
  }

  // 4. Generate magic link
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: p.email,
  });

  return new Response(
    JSON.stringify({
      success: true,
      userId,
      emailSent: !linkErr,
      magicLink: linkData?.properties?.hashed_token ?? null,
    }),
    { status: 200 },
  );
}

async function handleResetPw(p: ResetPwPayload): Promise<Response> {
  // Find user by email
  const { data: users, error: lookupErr } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', p.email)
    .limit(1);

  if (lookupErr || !users || users.length === 0) {
    return new Response(JSON.stringify({ error: 'Pengguna tidak ditemukan' }), { status: 404 });
  }

  const user = users[0];

  if (p.mode === 'magiclink') {
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: p.email,
    });
    if (linkErr) {
      return new Response(JSON.stringify({ error: linkErr.message }), { status: 500 });
    }
    return new Response(
      JSON.stringify({ success: true, method: 'magiclink', emailSent: true }),
      { status: 200 },
    );
  }

  // Temporary password: UAM-{nim}-{random 4 digits}
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
    return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 });
  }

  return new Response(
    JSON.stringify({
      success: true,
      method: 'temporary',
      temporaryPassword: tempPassword,
      userId: user.id,
    }),
    { status: 200 },
  );
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const payload: Payload = await req.json();

    switch (payload.action) {
      case 'create':
        return await handleCreate(payload);
      case 'reset-pw':
        return await handleResetPw(payload);
      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 });
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500 },
    );
  }
});
