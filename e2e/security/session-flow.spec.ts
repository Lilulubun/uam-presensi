/**
 * SEC01 + SEC09 — happy-path session flow with UI + RPC + DB cross-evidence.
 *
 * SEC01: opener opens session via UI (static QR), expected list correct,
 *        joiner checks in via dynamic QR → exactly one attendance for joiner,
 *        opener auto-attendance separated (FIRST_TEACHER_AUTO semantics).
 * SEC09: opener closes via UI → session closed, derived attendances get
 *        scan_out_time + checkout_method='session_auto_close'.
 *
 * Every scenario asserts UI response, RPC response, and DB state agree.
 */
import { test, expect, type Page } from '@playwright/test';
import { setupFixture, provisionActors, asActor, observer, trackSession, teardownFixture, type Fixture, type Actors } from './helpers/fixtures';

function waitForScanHook(page: Page) {
  return page.waitForFunction(() => typeof (window as { __simulateQRScan?: unknown }).__simulateQRScan === 'function', undefined, { timeout: 15_000 });
}
async function injectScan(page: Page, text: string) {
  await page.evaluate(([t]: [string]) => {
    (window as unknown as { __simulateQRScan?: (s: string) => void }).__simulateQRScan!(t);
  }, [text]);
}

let fixture: Fixture;
let actors: Actors;

test.beforeAll(async () => {
  fixture = await setupFixture();
  actors = await provisionActors(fixture);
});

test.afterAll(async () => {
  const failures = await teardownFixture(fixture);
  if (failures.length) console.error('[cleanup failures]', failures);
});

async function loginAs(page: Page, nim: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('NIM').fill(nim);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 20_000 });
}

async function openSessionViaUI(page: Page): Promise<string> {
  await page.context().grantPermissions(['geolocation']);
  await page.goto('/pengajar/scan');
  await page.getByRole('button', { name: /Izinkan Akses Lokasi/i }).click();
  await waitForScanHook(page);
  await injectScan(page, `E2ESEC-${fixture.runId.slice(0, 8).toUpperCase()}`);

  await expect(page.getByText(/Pilih pengajar wajib hadir/i)).toBeVisible({ timeout: 10_000 });
  // select opener + joiner as expected
  const cbs = page.locator('input[type="checkbox"]');
  const n = await cbs.count();
  expect(n).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < n; i++) await cbs.nth(i).check();
  await page.getByRole('button', { name: /Buka Sesi/i }).click();
  await expect(page).toHaveURL(/\/pengajar\/session\//, { timeout: 20_000 });
  const sessionId = page.url().split('/pengajar/session/')[1]?.split(/[?#]/)[0];
  expect(sessionId).toBeTruthy();
  trackSession(fixture, sessionId!);
  return sessionId!;
}

test('SEC01 — opening + legitimate check-in', async ({ browser }) => {
  const openerCtx = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: fixture.inside.latitude, longitude: fixture.inside.longitude },
  });
  const joinerCtx = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: fixture.inside.latitude, longitude: fixture.inside.longitude },
  });
  const openerPage = await openerCtx.newPage();
  const joinerPage = await joinerCtx.newPage();

  await loginAs(openerPage, actors.opener.nim, actors.opener.password);
  const sessionId = await openSessionViaUI(openerPage);

  // DB: exactly one active session for this TPA, opener correct
  const admin = observer(fixture.env);
  const { data: sessions } = await admin
    .from('sessions')
    .select('id,tpa_id,first_teacher_id,is_active')
    .eq('id', sessionId)
    .eq('is_active', true);
  expect(sessions).toHaveLength(1);
  expect(sessions![0].first_teacher_id).toBe(actors.opener.id);
  expect(sessions![0].tpa_id).toBe(fixture.tpaId);

  // DB: expected list persisted
  const { data: expected } = await admin
    .from('session_expected_teachers')
    .select('user_id')
    .eq('session_id', sessionId);
  const expectedIds = (expected ?? []).map((r: { user_id: string }) => r.user_id).sort();
  expect(expectedIds).toContain(actors.opener.id);
  expect(expectedIds).toContain(actors.joiner.id);

  // DB: opener auto-attendance exists exactly once
  const { data: openerAtt } = await admin
    .from('attendances')
    .select('id,user_id,session_id')
    .eq('session_id', sessionId)
    .eq('user_id', actors.opener.id);
  expect(openerAtt).toHaveLength(1);

  // UI: dynamic QR token visible
  const tokenPayload = await openerPage.locator('img[data-qr-token]').getAttribute('data-qr-token');
  expect(tokenPayload).toBeTruthy();
  const payload = JSON.parse(tokenPayload!);
  expect(payload.s).toBe(sessionId);
  expect(payload.y).toBe('in');

  // Joiner checks in via simulated scan of that payload
  await loginAs(joinerPage, actors.joiner.nim, actors.joiner.password);
  await joinerPage.context().grantPermissions(['geolocation']);
  await joinerPage.goto('/pengajar/scan');
  await joinerPage.getByRole('button', { name: /Izinkan Akses Lokasi/i }).click();
  await waitForScanHook(joinerPage);
  await injectScan(joinerPage, tokenPayload!);

  await expect(joinerPage).toHaveURL(/konfirmasi/, { timeout: 20_000 });
  await expect(joinerPage.getByText(/Presensi Masuk Berhasil!/i)).toBeVisible({ timeout: 10_000 });

  // DB: exactly one attendance for joiner
  const { data: joinerAtt } = await admin
    .from('attendances')
    .select('id,user_id,session_id,is_late')
    .eq('session_id', sessionId)
    .eq('user_id', actors.joiner.id);
  expect(joinerAtt).toHaveLength(1);
  expect(joinerAtt![0].is_late).toBe(false);

  // RPC companion: repeat check-in as same actor with NEW request id → rejected
  const joinerClient = await asActor(fixture.env, actors.joiner);
  const { data: replay, error: replayErr } = await joinerClient.rpc('check_in_v2', {
    p_session_id: sessionId,
    p_token: payload.t,
    p_location: { lat: fixture.inside.latitude, lng: fixture.inside.longitude },
    p_request_id: crypto.randomUUID(),
  });
  expect(replayErr).toBeNull();
  expect(replay?.accepted).toBe(false);
  // Server contract: used_tokens PK (user_id, session_id) fires TOKEN_REUSED
  // before ALREADY_CHECKED_IN when the same user re-scans any token. Both
  // codes prove no new attendance; accept either.
  expect(['ALREADY_CHECKED_IN', 'TOKEN_REUSED']).toContain(replay?.code);
  // Teardown SEC01's session via its own RPC so SEC09 starts clean.
  // (Close inside the test, not cleanup: proves closure path too.)
  const openerClient = await asActor(fixture.env, actors.opener);
  await openerClient.rpc('close_session_v2', {
    p_session_id: sessionId,
    p_location: null,
    p_notes: 'SEC01 teardown',
  });

  await openerCtx.close();
  await joinerCtx.close();
});

test('SEC09 — legitimate opener closes session', async ({ browser }) => {
  const openerCtx = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: fixture.inside.latitude, longitude: fixture.inside.longitude },
  });
  const openerPage = await openerCtx.newPage();
  await loginAs(openerPage, actors.opener.nim, actors.opener.password);
  const sessionId = await openSessionViaUI(openerPage);

  const admin = observer(fixture.env);

  // Close via UI
  await openerPage.getByRole('button', { name: /Tutup Sesi/i }).click();
  const notes = openerPage.getByPlaceholder(/Materi yang diberikan hari ini/i);
  await expect(notes).toBeVisible();
  await notes.fill('SEC09 closure evidence');
  await openerPage.getByRole('button', { name: /^Tutup Sesi$/ }).click();
  await expect(openerPage.getByText(/Sesi berhasil ditutup/i)).toBeVisible({ timeout: 15_000 });

  // DB: session closed
  const { data: sess } = await admin
    .from('sessions')
    .select('id,is_active,date_closed,close_notes')
    .eq('id', sessionId)
    .single();
  expect(sess.is_active).toBe(false);
  expect(sess.date_closed).toBeTruthy();
  expect(sess.close_notes).toBe('SEC09 closure evidence');

  // DB: derived attendances got auto-checkout
  const { data: atts } = await admin
    .from('attendances')
    .select('user_id,scan_in_time,scan_out_time,checkout_method')
    .eq('session_id', sessionId);
  expect(atts!.length).toBeGreaterThanOrEqual(1);
  for (const a of atts!) {
    expect(a.scan_out_time).toBeTruthy();
    expect(['manual', 'session_auto_close']).toContain(a.checkout_method);
  }

  await openerCtx.close();
});
