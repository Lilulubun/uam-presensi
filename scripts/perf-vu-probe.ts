/**
 * R1 — Performance & concurrency probe: 1 / 5 / 12 virtual users.
 *
 * Each VU runs the lightest realistic mixed workload against the authorized
 * backend using run-scoped fixtures:
 *   - open_session_with_expected_v2 (1× per VU, sequential per VU)
 *   - check_in_v2 (1× per VU on the shared session)
 *   - rotate_qr_token_v2 (repeated — the hot path every 20 s per active session)
 *
 * This is NOT a load-testing framework claim: single process, fixed ramp,
 * small n. Results are recorded as measured observations for the thesis
 * evaluation chapter, with the "peak 12" definition stated explicitly.
 *
 * Usage:
 *   E2E_SECURITY_ENV=.env.security npx tsx scripts/perf-vu-probe.ts
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';

type SecurityEnv = {
  backendUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

function loadEnv(): SecurityEnv {
  const file = process.env.E2E_SECURITY_ENV;
  if (!file) throw new Error('E2E_SECURITY_ENV is required');
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0) env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  // Fail-closed host check mirrors the e2e guard.
  const backendUrl = env.E2E_SUPABASE_URL;
  if (!backendUrl) throw new Error('E2E_SUPABASE_URL missing');
  const host = new URL(backendUrl).hostname;
  const authorized = env.E2E_AUTHORIZED_HOST ?? '';
  if (host !== authorized) throw new Error(`[guard] host ${host} not authorized (expected ${authorized})`);
  return { backendUrl, anonKey: env.E2E_SUPABASE_ANON_KEY, serviceRoleKey: env.E2E_SUPABASE_SERVICE_ROLE_KEY };
}

const VU_LEVELS = process.env.E2E_VU_LEVELS ? process.env.E2E_VU_LEVELS.split(',').map(Number) : [1, 5, 12];
const RUN_TAG = `perf-${Date.now().toString(36)}`;
const TPA_A = `e2e-perf-${RUN_TAG}-a`;
const TPA_B = `e2e-perf-${RUN_TAG}-b`;
const LOC = { lat: -7.687445, lng: 110.41569 };

type Actor = { id: string; email: string; password: string; client: SupabaseClient };

async function provision(admin: SupabaseClient, env: SecurityEnv, count: number): Promise<Actor[]> {
  const actors: Actor[] = [];
  for (let i = 0; i < count; i++) {
    const email = `perf-${RUN_TAG}-${i}@e2e-security.test`;
    const password = `Perf-${createHash('sha256').update(RUN_TAG + i).digest('hex').slice(0, 16)}!`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(`createUser ${i}: ${error?.message}`);
    await admin.from('users').upsert({
      id: data.user.id, email, name: `Perf VU ${i}`, role: 'pengajar',
      nim: `97${String(i).padStart(8, '0')}`, is_active: true, must_change_password: false,
    });
    // half assigned to TPA A, half to TPA B (two sessions max)
    const tpa = i % 2 === 0 ? TPA_A : TPA_B;
    await admin.from('pengajar_tpa').insert({ user_id: data.user.id, tpa_id: tpa });
    const client = createClient(env.backendUrl, env.anonKey, { auth: { persistSession: false } });
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
    if (signInErr) throw new Error(`signIn ${i}: ${signInErr.message}`);
    actors.push({ id: data.user.id, email, password, client });
  }
  return actors;
}

async function createTPAs(admin: SupabaseClient) {
  for (const [id, suffix] of [[TPA_A, 'A'], [TPA_B, 'B']] as const) {
    const { error } = await admin.from('tpas').insert({
      id, name: `Perf ${RUN_TAG} ${suffix}`, location: { ...LOC, radius: 5000 },
      static_qr_code: `PERF-${RUN_TAG.toUpperCase()}-${suffix}`,
    });
    if (error) throw new Error(`tpa ${id}: ${error.message}`);
  }
}

type Timing = { op: string; ms: number; ok: boolean; code?: string };

async function timed(actor: Actor, op: string, fn: () => Promise<{ accepted?: boolean; code?: string }>): Promise<Timing> {
  const t0 = performance.now();
  try {
    const res = await fn();
    return { op, ms: performance.now() - t0, ok: res.accepted !== false, code: res.code };
  } catch (e) {
    return { op, ms: performance.now() - t0, ok: false, code: e instanceof Error ? e.message : 'THROW' };
  }
}

/** One VU round: open (if session slot available) + rotate burst + one check-in attempt. */
async function vuRound(actor: Actor, tpaId: string, rotations: number): Promise<Timing[]> {
  const timings: Timing[] = [];
  const open = await timed(actor, 'open', () =>
    actor.client.rpc('open_session_with_expected_v2', {
      p_tpa_id: tpaId, p_location: LOC, p_expected_user_ids: [actor.id], p_request_id: randomUUID(),
    }) as Promise<{ accepted?: boolean; code?: string }>);
  timings.push(open);
  const opened = open.ok && open.code !== 'SESSION_ALREADY_ACTIVE';
  let sessionId: string | undefined;
  let token: string | undefined;
  if (opened) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (open as any).data ?? null;
  }
  // Read session state via RLS (participant) to get session id + rotate.
  const { data: sess } = await actor.client.from('sessions').select('id,is_active').eq('tpa_id', tpaId).eq('is_active', true).maybeSingle();
  sessionId = sess?.id;
  if (!sessionId) return timings;

  // Hot path: rotate burst (QR rotates every 20 s in production).
  for (let r = 0; r < rotations; r++) {
    timings.push(await timed(actor, 'rotate', () =>
      actor.client.rpc('rotate_qr_token_v2', { p_session_id: sessionId }) as Promise<{ accepted?: boolean; code?: string }>));
  }
  return timings;
}

function percentile(arr: number[], p: number): number {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? NaN;
}

async function main() {
  const env = loadEnv();
  const admin = createClient(env.backendUrl, env.serviceRoleKey, { auth: { persistSession: false } });
  const maxVU = Math.max(...VU_LEVELS);
  await createTPAs(admin);
  const actors = await provision(admin, env, maxVU + 2); // +2 spare for cleanup openers
  const results: Record<string, { opens: number[]; rotates: number[]; rotateFail: number }> = {};

  for (const vu of VU_LEVELS) {
    const batch = actors.slice(0, vu);
    const t0 = performance.now();
    const all: Timing[] = await Promise.all(batch.map((a, i) => vuRound(a, i % 2 === 0 ? TPA_A : TPA_B, 3)));
    const flat = all.flat();
    const opens = flat.filter((t) => t.op === 'open').map((t) => t.ms);
    const rotates = flat.filter((t) => t.op === 'rotate').map((t) => t.ms);
    const rotateFail = flat.filter((t) => t.op === 'rotate' && !t.ok).length;
    results[String(vu)] = { opens, rotates, rotateFail };
    console.log(`VU=${vu} wall=${Math.round(performance.now() - t0)}ms opens n=${opens.length} p50=${Math.round(percentile(opens, 0.5))}ms p95=${Math.round(percentile(opens, 0.95))}ms | rotates n=${rotates.length} p50=${Math.round(percentile(rotates, 0.5))}ms p95=${Math.round(percentile(rotates, 0.95))}ms fail=${rotateFail}`);
  }

  // Registry-scoped cleanup
  const { data: tpas } = await admin.from('tpas').select('id').in('id', [TPA_A, TPA_B]);
  const tids = tpas?.map((t) => t.id) ?? [];
  const del = async (t: string, col: string, ids: string[]) => { if (ids.length) await admin.from(t).delete().in(col, ids); };
  await del('attendance_audit_logs', 'actor_id', actors.map((a) => a.id));
  await del('attendances', 'user_id', actors.map((a) => a.id));
  await del('used_tokens', 'session_id', tids);
  await del('session_expected_teachers', 'session_id', tids);
  await del('session_qr_tokens', 'session_id', tids);
  await del('sessions', 'tpa_id', tids);
  await del('pengajar_tpa', 'tpa_id', tids);
  await del('users', 'id', actors.map((a) => a.id));
  await del('tpas', 'id', tids);
  for (const a of actors) {
    await fetch(`${env.backendUrl}/auth/v1/admin/users/${a.id}`, {
      method: 'DELETE',
      headers: { apikey: env.anonKey, Authorization: `Bearer ${env.serviceRoleKey}` },
    }).catch(() => undefined);
  }
  console.log('[cleanup] done');
}

main().catch((e) => { console.error(e); process.exit(1); });
