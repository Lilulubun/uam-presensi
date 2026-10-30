/**
 * SEC02–06, 08, 10–12 — negative controls and exploratory probes.
 *
 * Companion RPC tests run as ordinary actor JWTs (never service role).
 * Assertions target structured rejection codes, DB invariants, and
 * unchanged domain state. Exploratory probes record OBSERVED_LIMITATION
 * results without claiming PASS.
 */
import { test, expect } from '@playwright/test';
import { setupFixture, provisionActors, asActor, observer, trackSession, teardownFixture, type Fixture, type Actors, type SupabaseClient } from './helpers/fixtures';

let fixture: Fixture;
let actors: Actors;
let admin: SupabaseClient;

test.beforeAll(async () => {
  fixture = await setupFixture();
  actors = await provisionActors(fixture);
  admin = observer(fixture.env);
});

test.afterAll(async () => {
  const failures = await teardownFixture(fixture);
  if (failures.length) console.error('[cleanup failures]', failures);
});
function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

/** Open a session as actor via RPC; returns {sessionId, token}. */
async function openSession(actorIdx: 'opener' | 'joiner' | 'outsider', tpaId: string = fixture.tpaId): Promise<{ sessionId: string; token: string }> {
  const client = await asActor(fixture.env, actors[actorIdx]);
  const { data, error } = await client.rpc('open_session_with_expected_v2', {
    p_tpa_id: tpaId,
    p_location: { lat: fixture.inside.latitude, lng: fixture.inside.longitude },
    p_expected_user_ids: tpaId === fixture.tpaIdB ? [actors.openerB.id] : [actors.opener.id, actors.joiner.id],
    p_request_id: crypto.randomUUID(),
  });
  expect(error).toBeNull();
  expect(data?.accepted).toBe(true);
  const sessionId = data.data.session.id as string;
  const token = data.data.qr.token as string;
  trackSession(fixture, sessionId);
  return { sessionId, token };
}

async function closeSession(actorIdx: 'opener' | 'joiner' | 'outsider', sessionId: string) {
  const client = await asActor(fixture.env, actors[actorIdx]);
  await client.rpc('close_session_v2', { p_session_id: sessionId, p_location: null, p_notes: 'teardown' });
}

async function countAttendances(sessionId: string, userId?: string): Promise<number> {
  let q = admin.from('attendances').select('id').eq('session_id', sessionId);
  if (userId) q = q.eq('user_id', userId);
  const { data } = await q;
  return data?.length ?? 0;
}

test.describe('SEC02 — QR expired', () => {
  test('expired token rejected, DB unchanged', async () => {
    const { sessionId, token } = await openSession('opener');
    const joiner = await asActor(fixture.env, actors.joiner);

    // Wait past the 20 s TTL, then attempt check-in with the now-expired token.
    await delay(21_000);

    const { data, error } = await joiner.rpc('check_in_v2', {
      p_session_id: sessionId,
      p_token: token,
      p_location: { lat: fixture.inside.latitude, lng: fixture.inside.longitude },
      p_request_id: crypto.randomUUID(),
    });
    expect(error).toBeNull();
    expect(data?.accepted).toBe(false);
    expect(data?.code).toBe('QR_INVALID_OR_EXPIRED');

    // DB: no attendance row for joiner
    expect(await countAttendances(sessionId, actors.joiner.id)).toBe(0);

    // attempt_logs recorded the rejection (observer via service role)
    const { data: logs } = await admin
      .from('attempt_logs')
      .select('outcome,accepted')
      .eq('session_id', sessionId)
      .eq('action', 'check_in')
      .order('recorded_at', { ascending: false })
      .limit(1);
    expect(logs?.[0]?.outcome).toBe('QR_INVALID_OR_EXPIRED');
    expect(logs?.[0]?.accepted).toBe(false);

    await closeSession('opener', sessionId);
  });
});

test.describe('SEC03 — replay with same token, new request id', () => {
  test('same user re-scan with new request id rejected (per-user token uniqueness)', async () => {
    const { sessionId, token } = await openSession('opener');
    const joiner = await asActor(fixture.env, actors.joiner);

    const first = await joiner.rpc('check_in_v2', {
      p_session_id: sessionId,
      p_token: token,
      p_location: { lat: fixture.inside.latitude, lng: fixture.inside.longitude },
      p_request_id: crypto.randomUUID(),
    });
    expect(first.data?.accepted).toBe(true);

    // Replay: SAME user, same token, NEW request id (fresh scan semantics)
    const replay = await joiner.rpc('check_in_v2', {
      p_session_id: sessionId,
      p_token: token,
      p_location: { lat: fixture.inside.latitude, lng: fixture.inside.longitude },
      p_request_id: crypto.randomUUID(),
    });
    expect(replay.data?.accepted).toBe(false);
    expect(['TOKEN_REUSED', 'ALREADY_CHECKED_IN']).toContain(replay.data?.code);
    expect(await countAttendances(sessionId, actors.joiner.id)).toBe(1); // no new row

    await closeSession('opener', sessionId);
  });

  test('different user forwarded token INSIDE radius — recorded as boundary, not asserted', async () => {
    const { sessionId, token } = await openSession('opener');
    const joiner = await asActor(fixture.env, actors.joiner);
    const first = await joiner.rpc('check_in_v2', {
      p_session_id: sessionId,
      p_token: token,
      p_location: { lat: fixture.inside.latitude, lng: fixture.inside.longitude },
      p_request_id: crypto.randomUUID(),
    });
    expect(first.data?.accepted).toBe(true);

    // outsider (eligible, not expected) uses joiner's forwarded token inside radius
    const outsider = await asActor(fixture.env, actors.outsider);
    const fwd = await outsider.rpc('check_in_v2', {
      p_session_id: sessionId,
      p_token: token,
      p_location: { lat: fixture.inside.latitude, lng: fixture.inside.longitude },
      p_request_id: crypto.randomUUID(),
    });
    test.info().annotations.push({
      type: 'OBSERVED_LIMITATION',
      description: `SEC03/SEC10: forwarded token to eligible user inside radius → ${fwd.data?.accepted ? 'ACCEPTED (anti-forwarding equals geofence)' : 'rejected ' + fwd.data?.code}`,
    });

    await closeSession('opener', sessionId);
  });
});

test.describe('SEC04 — wrong/cross-session token', () => {
  test('token from another session rejected', async () => {
    const a = await openSession('opener', fixture.tpaId);
    const b = await openSession('openerB', fixture.tpaIdB); // independent TPA+opener → own session

    const participantBClient = await asActor(fixture.env, actors.participantB);
    const { data, error } = await participantBClient.rpc('check_in_v2', {
      p_session_id: b.sessionId,
      p_token: a.token, // cross-session token
      p_location: { lat: fixture.inside.latitude, lng: fixture.inside.longitude },
      p_request_id: crypto.randomUUID(),
    });
    expect(error).toBeNull();
    expect(data?.accepted).toBe(false);
    expect(data?.code).toBe('QR_INVALID_OR_EXPIRED'); // hash mismatch → invalid
    expect(await countAttendances(b.sessionId, actors.participantB.id)).toBe(0);

    await closeSession('opener', a.sessionId);
    await closeSession('openerB', b.sessionId);
  });
});

test.describe('SEC05 — outside radius', () => {
  test('UI and direct RPC both reject outside-radius check-in', async ({ browser }) => {
    const { sessionId, token } = await openSession('opener');

    // Direct RPC from outside — proves server-side boundary, not client-only.
    const joiner = await asActor(fixture.env, actors.joiner);
    const { data, error } = await joiner.rpc('check_in_v2', {
      p_session_id: sessionId,
      p_token: token,
      p_location: { lat: fixture.outside.latitude, lng: fixture.outside.longitude },
      p_request_id: crypto.randomUUID(),
    });
    expect(error).toBeNull();
    expect(data?.accepted).toBe(false);
    expect(data?.code).toBe('OUTSIDE_RADIUS');
    expect(await countAttendances(sessionId, actors.joiner.id)).toBe(0);

    // UI layer: browser geolocation outside radius → client precheck toast
    const ctx = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: fixture.outside.latitude, longitude: fixture.outside.longitude },
    });
    const page = await ctx.newPage();
    await page.goto('/login');
    await page.getByLabel('NIM').fill(actors.joiner.nim);
    await page.getByLabel('Password').fill(actors.joiner.password);
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL(/dashboard/, { timeout: 20_000 });
    await page.goto('/pengajar/scan');
    await page.getByRole('button', { name: /Izinkan Akses Lokasi/i }).click();
    await page.waitForFunction(() => typeof (window as { __simulateQRScan?: unknown }).__simulateQRScan === 'function', undefined, { timeout: 15_000 });
    await page.evaluate(([t]: [string]) => {
      (window as unknown as { __simulateQRScan?: (s: string) => void }).__simulateQRScan!(t);
    }, [token]);
    // UI must NOT navigate to konfirmasi
    await page.waitForTimeout(3000);
    expect(page.url()).not.toContain('/konfirmasi');
    await ctx.close();

    await closeSession('opener', sessionId);
  });
});

test.describe('SEC06 — spoofed inside coordinates (exploratory)', () => {
  test('records actual acceptance of fabricated inside coords', async () => {
    const { sessionId, token } = await openSession('opener');
    const joiner = await asActor(fixture.env, actors.joiner);

    // Fabricated "inside" location — nothing proves a real device is at the TPA.
    const { data, error } = await joiner.rpc('check_in_v2', {
      p_session_id: sessionId,
      p_token: token,
      p_location: { lat: fixture.inside.latitude, lng: fixture.inside.longitude },
      p_request_id: crypto.randomUUID(),
    });
    expect(error).toBeNull();
    // OBSERVED_LIMITATION: server accepts fabricated coordinates inside radius.
    // This is the anti-spoofing boundary, NOT a security PASS.
    if (data?.accepted === true) {
      expect(data.code).toBe('ACCEPTED');
      expect(await countAttendances(sessionId, actors.joiner.id)).toBe(1);
      test.info().annotations.push({ type: 'OBSERVED_LIMITATION', description: 'SEC06: fabricated inside coordinates accepted — geofence cannot distinguish real presence from spoofed GPS' });
    } else {
      test.info().annotations.push({ type: 'OBSERVED_LIMITATION', description: `SEC06: fabricated inside coordinates rejected with ${data?.code}` });
    }

    await closeSession('opener', sessionId);
  });
});

test.describe('SEC08 — non-opener cannot close', () => {
  test('joiner close rejected, session unchanged', async () => {
    const { sessionId } = await openSession('opener');

    const joiner = await asActor(fixture.env, actors.joiner);
    const { error } = await joiner.rpc('close_session_v2', {
      p_session_id: sessionId,
      p_location: null,
      p_notes: 'unauthorized attempt',
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain('Hanya Pengajar Pertama');

    // DB: session still active
    const { data: sess } = await admin.from('sessions').select('is_active,date_closed').eq('id', sessionId).single();
    expect(sess.is_active).toBe(true);
    expect(sess.date_closed).toBeNull();

    await closeSession('opener', sessionId);
  });
});

test.describe('SEC10 — QR forwarding (exploratory)', () => {
  test('inside forward accepted, outside forward rejected — records boundary', async () => {
    const { sessionId, token } = await openSession('opener');

    // Case A: forwarded token used from OUTSIDE → rejected (geofence holds)
    const outsider = await asActor(fixture.env, actors.outsider);
    const outsideAttempt = await outsider.rpc('check_in_v2', {
      p_session_id: sessionId,
      p_token: token,
      p_location: { lat: fixture.outside.latitude, lng: fixture.outside.longitude },
      p_request_id: crypto.randomUUID(),
    });
    expect(outsideAttempt.data?.accepted).toBe(false);
    expect(outsideAttempt.data?.code).toBe('OUTSIDE_RADIUS');

    // Case B: forwarded token used INSIDE by eligible non-expected teacher →
    // OBSERVED_LIMITATION: accepted; forwarding within radius is undetectable.
    const insideAttempt = await outsider.rpc('check_in_v2', {
      p_session_id: sessionId,
      p_token: token,
      p_location: { lat: fixture.inside.latitude, lng: fixture.inside.longitude },
      p_request_id: crypto.randomUUID(),
    });
    if (insideAttempt.data?.accepted === true) {
      test.info().annotations.push({ type: 'OBSERVED_LIMITATION', description: 'SEC10: forwarded token accepted inside radius — anti-forwarding boundary equals geofence radius' });
    } else {
      test.info().annotations.push({ type: 'OBSERVED_LIMITATION', description: `SEC10: forwarded token inside rejected with ${insideAttempt.data?.code}` });
    }

    await closeSession('opener', sessionId);
  });
});

test.describe('SEC11 — unassigned / inactive participants', () => {
  test('inactive account rejected at check-in', async () => {
    const { sessionId, token } = await openSession('opener');
    const inactive = await asActor(fixture.env, actors.inactive);
    const { data, error } = await inactive.rpc('check_in_v2', {
      p_session_id: sessionId,
      p_token: token,
      p_location: { lat: fixture.inside.latitude, lng: fixture.inside.longitude },
      p_request_id: crypto.randomUUID(),
    });
    expect(error).toBeNull();
    expect(data?.accepted).toBe(false);
    expect(data?.code).toBe('NOT_ELIGIBLE');
    expect(await countAttendances(sessionId, actors.inactive.id)).toBe(0);
    await closeSession('opener', sessionId);
  });

  test('unassigned (no pengajar_tpa) account rejected at open', async () => {
    const client = await asActor(fixture.env, actors.inactive);
    const { data, error } = await client.rpc('open_session_with_expected_v2', {
      p_tpa_id: fixture.tpaId,
      p_location: { lat: fixture.inside.latitude, lng: fixture.inside.longitude },
      p_expected_user_ids: [actors.inactive.id],
      p_request_id: crypto.randomUUID(),
    });
    expect(error).toBeNull();
    expect(data?.accepted).toBe(false);
    expect(data?.code).toBe('NOT_ELIGIBLE');
  });
});

test.describe('SEC12 — closure variants', () => {
  test('close without notes rejected; admin force-close works; NULL location closes', async () => {
    const { sessionId } = await openSession('opener');
    const opener = await asActor(fixture.env, actors.opener);

    // 12a: NULL/blank notes rejected
    const noNotes = await opener.rpc('close_session_v2', { p_session_id: sessionId, p_location: null, p_notes: null });
    expect(noNotes.error).not.toBeNull();
    expect(noNotes.error?.message).toContain('Materi TPA wajib diisi');

    // 12b: NULL location WITH notes closes fine (GPS optional at close)
    const nullLoc = await opener.rpc('close_session_v2', { p_session_id: sessionId, p_location: null, p_notes: 'SEC12 null-location closure' });
    expect(nullLoc.error).toBeNull();
    const { data: closed } = await admin.from('sessions').select('is_active,date_closed,close_notes').eq('id', sessionId).single();
    expect(closed.is_active).toBe(false);
    expect(closed.close_notes).toBe('SEC12 null-location closure');
  });

  test('admin force-close terminates an active session', async () => {
    const { sessionId } = await openSession('opener');
    const pengurus = await asActor(fixture.env, actors.pengurus);
    const { data, error } = await pengurus.rpc('force_close_session_v2', { p_session_id: sessionId });
    expect(error).toBeNull();
    expect(data?.is_active).toBe(false);

    const { data: sess, error: sessErr } = await admin.from('sessions').select('close_notes').eq('id', sessionId).single();
    expect(sessErr).toBeNull();
    expect(sess.close_notes).toBe('[Admin force-close]');

    // derived attendances closed
    const { data: atts } = await admin.from('attendances').select('scan_out_time,checkout_method').eq('session_id', sessionId);
    for (const a of atts ?? []) {
      expect(a.scan_out_time).toBeTruthy();
      expect(a.checkout_method).toBe('admin_force_close');
    }
  });

  test('non-admin cannot force-close', async () => {
    const { sessionId } = await openSession('opener');
    const joiner = await asActor(fixture.env, actors.joiner);
    const { error } = await joiner.rpc('force_close_session_v2', { p_session_id: sessionId });
    expect(error).not.toBeNull();
    expect(error?.message).toContain('Only administrators');
    await closeSession('opener', sessionId);
  });
});

test.describe('Telemetry — idempotency and ledger integrity', () => {
  test('same request_id replay returns REQUEST_ALREADY_PROCESSED, no new log', async () => {
    const { sessionId, token } = await openSession('opener');
    const joiner = await asActor(fixture.env, actors.joiner);
    const requestId = crypto.randomUUID();

    const first = await joiner.rpc('check_in_v2', {
      p_session_id: sessionId,
      p_token: token,
      p_location: { lat: fixture.inside.latitude, lng: fixture.inside.longitude },
      p_request_id: requestId,
    });
    expect(first.data?.accepted).toBe(true);

    const { data: logsBefore } = await admin.from('attempt_logs').select('request_id').eq('session_id', sessionId).eq('action', 'check_in');

    const replay = await joiner.rpc('check_in_v2', {
      p_session_id: sessionId,
      p_token: token,
      p_location: { lat: fixture.inside.latitude, lng: fixture.inside.longitude },
      p_request_id: requestId, // SAME id
    });
    expect(replay.data?.accepted).toBe(false);
    expect(replay.data?.code).toBe('REQUEST_ALREADY_PROCESSED');

    const { data: logsAfter } = await admin.from('attempt_logs').select('request_id').eq('session_id', sessionId).eq('action', 'check_in');
    expect(logsAfter?.length).toBe(logsBefore?.length); // no new log row

    await closeSession('opener', sessionId);
  });

  test('ordinary user cannot read attempt_logs (RLS)', async () => {
    const joiner = await asActor(fixture.env, actors.joiner);
    const { data, error } = await joiner.from('attempt_logs').select('request_id').limit(1);
    expect(error).not.toBeNull(); // RLS blocks
    expect(data).toBeNull();
  });

  test('ordinary user cannot write domain tables directly (RLS)', async () => {
    const joiner = await asActor(fixture.env, actors.joiner);
    const { error: attErr } = await joiner.from('attendances').insert({
      session_id: '00000000-0000-0000-0000-000000000000',
      user_id: actors.joiner.id,
    });
    expect(attErr).not.toBeNull();

    const { error: sessErr } = await joiner.from('sessions').insert({ tpa_id: fixture.tpaId });
    expect(sessErr).not.toBeNull();

    const { error: tokErr } = await joiner.from('used_tokens').insert({
      session_id: '00000000-0000-0000-0000-000000000000',
      user_id: actors.joiner.id,
      token: 'forged',
    });
    expect(tokErr).not.toBeNull();
  });
});
