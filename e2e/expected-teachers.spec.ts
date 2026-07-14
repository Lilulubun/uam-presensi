import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Helper to assign a user to a single TPA (DB constraint: one TPA per user)
async function assignUserToTPA(
  supabase: ReturnType<typeof createClient>,
  nim: string,
  tpaId: string,
) {
  const { data: users } = await supabase.from('users').select('id, nim');
  const user = users?.find(u => u.nim === nim);
  if (user) {
    await supabase.from('pengajar_tpa').delete().eq('user_id', user.id);
    await supabase.from('pengajar_tpa').insert({ user_id: user.id, tpa_id: tpaId });
  }
}

test.describe('Expected Teachers Flow', () => {

  test.beforeEach(async () => {
    // Clean up any active sessions before running this test
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const supabase = createClient(url, key, { auth: { persistSession: false } });
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('is_active', true);

      if (sessions && sessions.length > 0) {
        for (const s of sessions) {
          await supabase.from('sessions')
            .update({ is_active: false, date_closed: new Date().toISOString(), close_notes: 'E2E cleanup before expected-teachers test' })
            .eq('id', s.id);
        }
      }
    }
  });

  test('Flow 1: host selects expected teachers and opens session', async ({ browser }) => {
    // Seed: assign Budi to TPA Al-Fath (tpa-001)
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    await assignUserToTPA(supabase, '20521001', 'tpa-001');
    // Also assign Siti for multi-teacher checkbox test
    await assignUserToTPA(supabase, '20521002', 'tpa-001');

    const hostContext = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: -7.6864394, longitude: 110.4183135 } // TPA Al-Fath (from DB)
    });
    const hostPage = await hostContext.newPage();
    await loginAs(hostPage, '20521001', '23523198uam');

    await hostPage.goto('/pengajar/scan');
    await hostPage.getByRole('button', { name: /Izinkan Akses Lokasi/i }).click();

    await hostPage.waitForFunction(() => typeof (window as any).__simulateQRScan === 'function', { timeout: 10000 });

    await hostPage.evaluate(() => {
      (window as any).__simulateQRScan('TPA-001');
    });

    // ExpectedTeacherSelector visible — all checkboxes default unchecked
    await expect(hostPage.getByText(/Pilih Pengajar yang Wajib Hadir/i)).toBeVisible({ timeout: 10000 });
    await expect.poll(async () => {
      const cbs = hostPage.locator('input[type="checkbox"]');
      return await cbs.count();
    }, { timeout: 15000, message: 'checkboxes should appear' }).toBeGreaterThanOrEqual(1);
    const teacherItems = hostPage.locator('input[type="checkbox"]');
    const initialCount = await teacherItems.count();
    expect(initialCount).toBeGreaterThanOrEqual(1);

    // Counter shows 0 selected initially
    await expect(hostPage.getByText(/0 dipilih/i)).toBeVisible();

    // Select first teacher (self)
    await teacherItems.first().check();

    // Counter updated to 1
    await expect(hostPage.getByText(/1 dipilih/i)).toBeVisible();

    // Click Buka Sesi button
    await hostPage.getByRole('button', { name: /Buka Sesi/i }).click();

    // Verify redirect to session page
    await expect(hostPage).toHaveURL(/.*\/pengajar\/session\/.*/, { timeout: 15000 });

    await hostContext.close();
  });

  test('Flow 2: non-expected teacher can still check in', async ({ browser }) => {
    // Seed: assign Budi (host) and Siti (joiner) to TPA Adz-Dzikro (tpa-002)
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    await assignUserToTPA(supabase, '20521001', 'tpa-002');
    await assignUserToTPA(supabase, '20521002', 'tpa-002');

    // 1. Host opens session with only self as expected
    const hostContext = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: -7.745806514820902, longitude: 110.40908009692278 } // TPA Adz-Dzikro (tpa-002) from DB
    });
    const hostPage = await hostContext.newPage();
    await loginAs(hostPage, '20521001', '23523198uam');

    await hostPage.goto('/pengajar/scan');
    await hostPage.getByRole('button', { name: /Izinkan Akses Lokasi/i }).click();
    await hostPage.waitForFunction(() => typeof (window as any).__simulateQRScan === 'function', { timeout: 10000 });
    await hostPage.evaluate(() => {
      (window as any).__simulateQRScan('TPA-002');
    });

    // Select only first checkbox (self)
    await expect(hostPage.getByText(/Pilih Pengajar yang Wajib Hadir/i)).toBeVisible({ timeout: 10000 });
    await expect.poll(async () => {
      const cbs = hostPage.locator('input[type="checkbox"]');
      return await cbs.count();
    }, { timeout: 15000, message: 'checkboxes should appear' }).toBeGreaterThanOrEqual(1);
    const hostCheckboxes = hostPage.locator('input[type="checkbox"]');
    await hostCheckboxes.first().check();
    await hostPage.getByRole('button', { name: /Buka Sesi/i }).click();

    // Verify host on session page
    await expect(hostPage).toHaveURL(/.*\/pengajar\/session\/.*/, { timeout: 15000 });

    // Extract dynamic QR token
    const qrImage = hostPage.locator('img[data-qr-token]');
    await expect(qrImage).toBeVisible({ timeout: 10000 });
    const qrTokenData = await qrImage.getAttribute('data-qr-token');
    expect(qrTokenData).not.toBeNull();

    // 2. Non-expected teacher (Siti Rahayu — not in expected list) scans and checks in
    const joinerContext = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: -7.74581, longitude: 110.40909 } // ~5m from TPA Adz-Dzikro center (within 150m)
    });
    const joinerPage = await joinerContext.newPage();
    await loginAs(joinerPage, '20521002', '23523198uam');

    await joinerPage.goto('/pengajar/scan');
    await joinerPage.getByRole('button', { name: /Izinkan Akses Lokasi/i }).click();
    await joinerPage.waitForFunction(() => typeof (window as any).__simulateQRScan === 'function', { timeout: 10000 });
    await joinerPage.evaluate((token) => {
      (window as any).__simulateQRScan(token);
    }, qrTokenData!);

    // Verify check-in success — non-expected teacher IS counted as Hadir
    await expect(joinerPage).toHaveURL(/.*\/pengajar\/konfirmasi.*/, { timeout: 15000 });
    await expect(joinerPage.getByText(/Presensi Masuk Berhasil!/i)).toBeVisible({ timeout: 10000 });

    // 3. On host screen, Siti Rahayu appears as attended
    await expect(hostPage.getByText('Siti Rahayu')).toBeVisible({ timeout: 15000 });

    await hostContext.close();
    await joinerContext.close();
  });

  test('Flow 3: close session shows only expected-but-absent teachers', async ({ browser }) => {
    // Seed: assign Budi to TPA Al-Fath (tpa-001)
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    await assignUserToTPA(supabase, '20521001', 'tpa-001');
    // Also assign Siti to test "Tidak Hadir" section
    await assignUserToTPA(supabase, '20521002', 'tpa-001');

    const hostContext = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: -7.6864394, longitude: 110.4183135 } // TPA Al-Fath
    });
    const hostPage = await hostContext.newPage();
    await loginAs(hostPage, '20521001', '23523198uam');

    await hostPage.goto('/pengajar/scan');
    await hostPage.getByRole('button', { name: /Izinkan Akses Lokasi/i }).click();
    await hostPage.waitForFunction(() => typeof (window as any).__simulateQRScan === 'function', { timeout: 10000 });
    await hostPage.evaluate(() => {
      (window as any).__simulateQRScan('TPA-001');
    });

    // Open session with self AND Siti as expected (both checkboxes)
    await expect(hostPage.getByText(/Pilih Pengajar yang Wajib Hadir/i)).toBeVisible({ timeout: 10000 });
    await expect.poll(async () => {
      const cbs = hostPage.locator('input[type="checkbox"]');
      return await cbs.count();
    }, { timeout: 15000, message: 'checkboxes should appear' }).toBeGreaterThanOrEqual(2);
    const checkboxes = hostPage.locator('input[type="checkbox"]');
    // Check both checkboxes (Budi and Siti)
    await checkboxes.first().check();
    await checkboxes.nth(1).check();
    await hostPage.getByRole('button', { name: /Buka Sesi/i }).click();
    await expect(hostPage).toHaveURL(/.*\/pengajar\/session\/.*/, { timeout: 15000 });

    // Close session
    await hostPage.getByRole('button', { name: /Tutup Sesi/i }).click();
    const notesField = hostPage.getByPlaceholder(/Materi yang diberikan hari ini/i);
    await expect(notesField).toBeVisible();
    await notesField.fill('Belajar Mengaji Bersama');
    await hostPage.getByRole('button', { name: /^Tutup Sesi$/ }).click();

    // Verify success toast
    await expect(hostPage.getByText(/Sesi berhasil ditutup/i)).toBeVisible({ timeout: 10000 });

    // "Sesi Selesai" should be visible
    await expect(hostPage.getByText(/Sesi Selesai/i)).toBeVisible({ timeout: 10000 });

    // Verify "Tidak Hadir" section — expected teachers not scanned count
    // Expected = Budi + Siti (2). Budi scanned (host), Siti not scanned => 1 in Tidak Hadir
    await expect(hostPage.getByText(/Tidak Hadir/i)).toBeVisible({ timeout: 10000 });

    await hostContext.close();
  });

});
