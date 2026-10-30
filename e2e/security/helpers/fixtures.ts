/**
 * Security E2E fixtures — synthetic accounts, registry-scoped provisioning and
 * cleanup against the authorized target (validated by the environment guard).
 *
 * Admin (service-role) is used ONLY for provisioning / observer reads /
 * registry cleanup. Actor RPC calls always use the actor's own anon+password
 * JWT — never the service key.
 *
 * Cleanup removes ONLY rows recorded in the run registry. No global deletes,
 * no closing sessions we did not create.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import { loadSecurityEnv, type SecurityEnv } from './environment';

export type Actor = {
  id: string;
  email: string;
  nim: string;
  password: string;
};

export type Registry = {
  runId: string;
  userIds: string[];
  sessionIds: string[];
  assignmentIds: { user_id: string; tpa_id: string }[];
  tpaIds: string[];
};

export type Fixture = {
  env: SecurityEnv;
  runId: string;
  registry: Registry;
  /** service-role client: provisioning + observer only */
  admin: SupabaseClient;
  /** TPA created for (or reused by) this run */
  tpaId: string;
  /** second TPA for cross-session tests */
  tpaIdB: string;
  tpaLocation: { lat: number; lng: number; radius: number };
  inside: { latitude: number; longitude: number; accuracy: number };
  /** point > radius away from TPA center */
  outside: { latitude: number; longitude: number; accuracy: number };
};

const RUN_PREFIX = 'e2e-sec-';

function nimFor(runId: string, suffix: string): string {
  // NIM must be numeric-ish and unique per run; derive from runId hash.
  const h = createHash('sha256').update(runId + suffix).digest('hex');
  const n = parseInt(h.slice(0, 8), 16) % 1_000_000_00;
  return `99${String(n).padStart(8, '0')}`;
}

/** Create an actor account via admin API and record it in the registry. */
async function provisionActor(
  admin: SupabaseClient,
  registry: Registry,
  runId: string,
  suffix: string,
  opts: { active: boolean; mustChangePassword: boolean; role: 'pengajar' | 'pengurus' },
): Promise<Actor> {
  const nim = nimFor(runId, suffix);
  const email = `${RUN_PREFIX}${runId.slice(0, 8)}-${suffix}@e2e-security.test`;
  const password = `E2e-${createHash('sha256').update(runId + suffix + 'pw').digest('hex').slice(0, 16)}!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`provision ${suffix}: ${error?.message}`);

  const { error: profErr } = await admin.from('users').upsert({
    id: data.user.id,
    email,
    name: `E2E Sec ${suffix}`,
    role: opts.role,
    nim,
    is_active: opts.active,
    must_change_password: opts.mustChangePassword,
  });
  if (profErr) throw new Error(`profile ${suffix}: ${profErr.message}`);
  registry.userIds.push(data.user.id);
  return { id: data.user.id, email, nim, password };
}

/** Sign in as an actor with its OWN credentials (anon key, no service role). */
export async function asActor(env: SecurityEnv, actor: Actor): Promise<SupabaseClient> {
  const client = createClient(env.backendUrl, env.anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: actor.email, password: actor.password });
  if (error) throw new Error(`actor login ${actor.nim}: ${error.message}`);
  return client;
}

/** Observer read via service role (attempt_logs is unreadable by clients). */
export function observer(env: SecurityEnv): SupabaseClient {
  return createClient(env.backendUrl, env.serviceRoleKey, { auth: { persistSession: false } });
}

export async function setupFixture(): Promise<Fixture> {
  const env = loadSecurityEnv();
  const runId = randomUUID();
  const admin = observer(env);

  const registry: Registry = {
    runId,
    userIds: [],
    sessionIds: [],
    assignmentIds: [],
    tpaIds: [],
  };

  // Dedicated TPAs for this run → zero interference with real locations.
  // Two TPAs: cross-session token tests need independent sessions.
  const tpaId = `${RUN_PREFIX}${runId.slice(0, 8)}`;
  const tpaIdB = `${RUN_PREFIX}${runId.slice(0, 8)}-b`;
  const tpaLocation = { lat: -7.687445, lng: 110.41569, radius: 100 };
  const inside = { latitude: tpaLocation.lat, longitude: tpaLocation.lng, accuracy: 5 };
  const outside = { latitude: tpaLocation.lat + 0.01, longitude: tpaLocation.lng, accuracy: 5 };

  for (const [tid, suffix] of [[tpaId, ''], [tpaIdB, '-B']] as const) {
    const { error: tpaErr } = await admin.from('tpas').insert({
      id: tid,
      name: `E2E Security ${runId.slice(0, 8)}${suffix}`,
      location: tpaLocation,
      static_qr_code: `E2ESEC-${runId.slice(0, 8).toUpperCase()}${suffix}`,
    });
    if (tpaErr) throw new Error(`tpa create ${tid}: ${tpaErr.message}`);
    registry.tpaIds.push(tid);
  }

  // Verify read-back (plan: check every seed result).
  const { data: rb, error: rbErr } = await admin.from('tpas').select('id,location').eq('id', tpaId).single();
  if (rbErr || !rb) throw new Error(`tpa read-back failed: ${rbErr?.message}`);

  const fixture: Fixture = {
    env,
    runId,
    registry,
    admin,
    tpaId,
    tpaIdB,
    tpaLocation,
    inside,
    outside,
  };
  return fixture;
}

export type Actors = {
  opener: Actor;
  joiner: Actor;
  outsider: Actor;
  inactive: Actor;
  pengurus: Actor;
  /** assigned to tpaIdB only — enables a second independent session */
  openerB: Actor;
  /** eligible check-in participant on tpaIdB */
  participantB: Actor;
};

export async function provisionActors(fixture: Fixture): Promise<Actors> {
  const { admin, registry, runId, tpaId } = fixture;
  const opener = await provisionActor(admin, registry, runId, 'opener', { active: true, mustChangePassword: false, role: 'pengajar' });
  const joiner = await provisionActor(admin, registry, runId, 'joiner', { active: true, mustChangePassword: false, role: 'pengajar' });
  const outsider = await provisionActor(admin, registry, runId, 'outsider', { active: true, mustChangePassword: false, role: 'pengajar' });
  const inactive = await provisionActor(admin, registry, runId, 'inactive', { active: false, mustChangePassword: false, role: 'pengajar' });
  const pengurus = await provisionActor(admin, registry, runId, 'pengurus', { active: true, mustChangePassword: false, role: 'pengurus' });

  // Domain constraint: one TPA per teacher (idx_pengajar_tpa_one_per_user).
  for (const a of [opener, joiner, outsider]) {
    const { error } = await admin.from('pengajar_tpa').insert({ user_id: a.id, tpa_id: tpaId });
    if (error) throw new Error(`assign ${a.nim}: ${error.message}`);
    registry.assignmentIds.push({ user_id: a.id, tpa_id: tpaId });
  }
  // inactive + pengurus intentionally NOT assigned.

  // Second opener on tpaIdB for cross-session tests (one TPA per teacher).
  const openerB = await provisionActor(admin, registry, runId, 'openerb', { active: true, mustChangePassword: false, role: 'pengajar' });
  const participantB = await provisionActor(admin, registry, runId, 'participantb', { active: true, mustChangePassword: false, role: 'pengajar' });
  for (const a of [openerB, participantB]) {
    const { error: errB } = await admin.from('pengajar_tpa').insert({ user_id: a.id, tpa_id: fixture.tpaIdB });
    if (errB) throw new Error(`assign ${a.nim}: ${errB.message}`);
    registry.assignmentIds.push({ user_id: a.id, tpa_id: fixture.tpaIdB });
  }

  return { opener, joiner, outsider, inactive, pengurus, openerB, participantB };
}

/** Registry-scoped cleanup: only rows this run created. */
export async function teardownFixture(fixture: Fixture): Promise<string[]> {
  const { admin, registry } = fixture;
  const failures: string[] = [];

  // Child-first ordering by FK dependency. .in() with array values.
  const steps: [string, 'session_id' | 'id' | 'tpa_id' | 'actor_id', string[]][] = [
    ['attendance_audit_logs', 'actor_id', registry.userIds],
    ['attendances', 'session_id', registry.sessionIds],
    ['session_qr_tokens', 'session_id', registry.sessionIds],
    ['session_expected_teachers', 'session_id', registry.sessionIds],
    ['used_tokens', 'session_id', registry.sessionIds],
    ['sessions', 'id', registry.sessionIds],
    ['pengajar_tpa', 'tpa_id', registry.tpaIds],
    ['users', 'id', registry.userIds],
    ['tpas', 'id', registry.tpaIds],
  ];
  for (const [table, col, ids] of steps) {
    if (ids.length === 0) continue;
    const { error } = await admin.from(table).delete().in(col, ids);
    if (error) failures.push(`${table}: ${error.message}`);
  }
  return failures;
}

export function trackSession(fixture: Fixture, sessionId: string): void {
  if (!fixture.registry.sessionIds.includes(sessionId)) {
    fixture.registry.sessionIds.push(sessionId);
  }
}
