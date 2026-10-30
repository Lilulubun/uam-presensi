/**
 * SEC07 — two concurrent openers race for the same TPA.
 *
 * Two actor clients dispatch open_session_with_expected_v2 with released
 * barrier. Server overlap is unverified from the client (no server-side
 * timing observability) — labeled 'concurrent client dispatch; server
 * overlap unverified'. Invariants asserted: exactly one active session,
 * no partial writes, loser response matches contract.
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

test('SEC07 — concurrent openers: exactly one session wins', async () => {
  const a = await asActor(fixture.env, actors.opener);
  const b = await asActor(fixture.env, actors.joiner);

  const reqA = crypto.randomUUID();
  const reqB = crypto.randomUUID();
  const loc = { lat: fixture.inside.latitude, lng: fixture.inside.longitude };
  const expected = [actors.opener.id, actors.joiner.id];

  // Barrier: dispatch both as simultaneously as the client allows.
  const sendTimes: Record<string, number> = {};
  const recvTimes: Record<string, number> = {};
  const pA = a.rpc('open_session_with_expected_v2', { p_tpa_id: fixture.tpaId, p_location: loc, p_expected_user_ids: expected, p_request_id: reqA })
    .then((r) => { recvTimes.A = Date.now(); return r; });
  const pB = b.rpc('open_session_with_expected_v2', { p_tpa_id: fixture.tpaId, p_location: loc, p_expected_user_ids: expected, p_request_id: reqB })
    .then((r) => { recvTimes.B = Date.now(); return r; });
  sendTimes.A = sendTimes.B = Date.now();

  const [resA, resB] = await Promise.all([pA, pB]);

  // Contract: no transport errors, structured responses only.
  expect(resA.error).toBeNull();
  expect(resB.error).toBeNull();

  const accepted = [resA.data, resB.data].filter((d) => d?.accepted === true);
  const rejected = [resA.data, resB.data].filter((d) => d?.accepted === false);

  // Invariant 1: exactly one winner.
  expect(accepted).toHaveLength(1);

  // Invariant 2: loser gets SESSION_ALREADY_ACTIVE.
  expect(rejected).toHaveLength(1);
  expect(rejected[0]?.code).toBe('SESSION_ALREADY_ACTIVE');

  // Invariant 3: winner's session is the only active one for this TPA.
  const winnerSessionId = accepted[0]?.data?.session?.id as string;
  trackSession(fixture, winnerSessionId);
  const { data: active } = await admin
    .from('sessions')
    .select('id')
    .eq('tpa_id', fixture.tpaId)
    .eq('is_active', true);
  expect(active).toHaveLength(1);
  expect(active![0].id).toBe(winnerSessionId);

  // Invariant 4: no partial writes — exactly one QR token row, one auto-attendance.
  const { data: tokens } = await admin.from('session_qr_tokens').select('session_id').eq('session_id', winnerSessionId);
  expect(tokens).toHaveLength(1);
  const { data: atts } = await admin.from('attendances').select('id').eq('session_id', winnerSessionId);
  expect(atts).toHaveLength(1); // only winner's auto-attendance

  // Invariant 5: loser's request_id appears in attempt_logs as rejected.
  const loserReq = rejected[0] === resB.data ? reqB : reqA;
  const { data: loserLog } = await admin
    .from('attempt_logs')
    .select('outcome,accepted')
    .eq('request_id', loserReq)
    .single();
  expect(loserLog?.accepted).toBe(false);
  expect(loserLog?.outcome).toBe('SESSION_ALREADY_ACTIVE');

  test.info().annotations.push({
    type: 'CONCURRENCY_LABEL',
    description: `concurrent client dispatch; server overlap unverified (send Δ=${Math.abs(sendTimes.A - sendTimes.B)}ms, recv Δ=${Math.abs(recvTimes.A - recvTimes.B)}ms)`,
  });

  // Teardown: close winner session via its first teacher.
  const winnerIdx = accepted[0] === resA.data ? 'opener' : 'joiner';
  const winnerClient = await asActor(fixture.env, actors[winnerIdx]);
  await winnerClient.rpc('close_session_v2', { p_session_id: winnerSessionId, p_location: null, p_notes: 'SEC07 teardown' });
});

test.describe('Idempotent retry with same request id', () => {
  test('transport-retry reuse returns REQUEST_ALREADY_PROCESSED without new attendance', async () => {
    const a = await asActor(fixture.env, actors.opener);
    const reqId = crypto.randomUUID();
    const loc = { lat: fixture.inside.latitude, lng: fixture.inside.longitude };

    const first = await a.rpc('open_session_with_expected_v2', {
      p_tpa_id: fixture.tpaId, p_location: loc, p_expected_user_ids: [actors.opener.id], p_request_id: reqId,
    });
    expect(first.data?.accepted).toBe(true);
    const sessionId = first.data.data.session.id as string;
    trackSession(fixture, sessionId);

    const retry = await a.rpc('open_session_with_expected_v2', {
      p_tpa_id: fixture.tpaId, p_location: loc, p_expected_user_ids: [actors.opener.id], p_request_id: reqId,
    });
    expect(retry.data?.accepted).toBe(false);
    expect(retry.data?.code).toBe('REQUEST_ALREADY_PROCESSED');

    // Exactly one session, one auto-attendance, one log row for this request.
    const { data: active } = await admin.from('sessions').select('id').eq('tpa_id', fixture.tpaId).eq('is_active', true);
    expect(active).toHaveLength(1);
    const { data: logs } = await admin.from('attempt_logs').select('request_id').eq('request_id', reqId);
    expect(logs).toHaveLength(1);

    await a.rpc('close_session_v2', { p_session_id: sessionId, p_location: null, p_notes: 'retry teardown' });
  });
});
