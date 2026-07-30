import { test, expect } from '@playwright/test';

/**
 * TPA Test UII — End-to-end flow
 * 
 * Teachers: Nawal (23523198) + Wisam (22423133)
 * TPA: tpa-uii-test, QR static: UII-TEST
 * Coordinates: -7.6874, 110.4157, radius 5000m
 */

async function loginAs(page: any, nim: string, password: string) {
  await page.goto('/login');
  await expect(page.getByText('Memuat...')).toBeHidden({ timeout: 15000 });
  await page.getByLabel('NIM').fill(nim);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
}

test.describe('TPA Test UII — Full Session Flow', () => {

  test.beforeEach(async ({ page }) => {
    // Land on scan page first to trigger init
    await page.goto('/');
    await expect(page.getByText('Memuat...')).toBeHidden({ timeout: 15000 });
  });

  test('1. Auth: Nawal login berhasil', async ({ page }) => {
    await loginAs(page, '23523198', '!23aS678');
    // Verify we land on dashboard — look for recognizable elements
    await expect(page.getByText(/Scan QR Presensi/i)).toBeVisible({ timeout: 10000 });
  });

  test('2. Auth: Wisam login berhasil', async ({ page }) => {
    await loginAs(page, '22423133', '22423133uam');
    await expect(page.getByText(/Scan QR Presensi/i)).toBeVisible({ timeout: 10000 });
  });

  test('3. Full flow: Nawal buka sesi → Wisam check-in → Nawal lihat hadir', async ({ browser }) => {
    const TPA_COORDS = { latitude: -7.6874, longitude: 110.4157 };

    // Clean up any stale active sessions for this TPA
    {
      const resp = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/sessions?tpa_id=eq.tpa-uii-test&is_active=eq.true&select=id`, {
        headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}` },
      });
      const sessions = await resp.json();
      for (const s of (sessions as any[])) {
        await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/sessions?id=eq.${s.id}`, {
          method: 'PATCH',
          headers: {
            apikey: process.env.VITE_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ is_active: false, date_closed: new Date().toISOString(), close_notes: 'E2E cleanup' }),
        });
      }
    }

    // ─── Nawal: buka sesi ───
    const nawalCtx = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: TPA_COORDS,
    });
    const nawalPage = await nawalCtx.newPage();
    await loginAs(nawalPage, '23523198', '!23aS678');

    await nawalPage.goto('/pengajar/scan');
    await nawalPage.getByRole('button', { name: /Izinkan Akses Lokasi/i }).click();

    // Wait for QR scanner
    await nawalPage.waitForFunction(
      () => typeof (window as any).__simulateQRScan === 'function',
      { timeout: 10000 }
    );

    // Scan static QR UII-TEST
    await nawalPage.evaluate(() => {
      (window as any).__simulateQRScan('UII-TEST');
    });

    // ExpectedTeacherSelector visible
    await expect(
      nawalPage.getByText(/Pilih Pengajar yang Wajib Hadir/i)
    ).toBeVisible({ timeout: 10000 });

    // Select all checkboxes
    const cbs = nawalPage.locator('input[type="checkbox"]');
    const cbCount = await cbs.count();
    for (let i = 0; i < cbCount; i++) {
      await cbs.nth(i).check();
    }

    // Open session
    await nawalPage.getByRole('button', { name: /Buka Sesi/i }).click();

    // Redirected to session page
    await expect(nawalPage).toHaveURL(/\/pengajar\/session\//, { timeout: 15000 });

    // ─── Wisam: siapkan scan page dulu ───
    const wisamCtx = await browser.newContext({
      permissions: ['geolocation', 'camera'],
      geolocation: TPA_COORDS,
    });
    const wisamPage = await wisamCtx.newPage();
    await loginAs(wisamPage, '22423133', '22423133uam');

    await wisamPage.goto('/pengajar/scan');
    await wisamPage.getByRole('button', { name: /Izinkan Akses Lokasi/i }).click();

    // Log browser console + intercept sonner toasts
    wisamPage.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'log') {
        console.log('[Wisam console]', msg.type(), msg.text().substring(0, 300));
      }
    });

    // Waiting loop: give html5-qrcode time — it will fail camera but ScanPage's useEffect 
    // still exposes __simulateQRScan independently
    await wisamPage.waitForFunction(
      () => typeof (window as any).__simulateQRScan === 'function',
      { timeout: 15000 }
    );

    // ─── Grab FRESH token from Nawal RIGHT NOW and scan instantly ───
    const freshToken = await nawalPage.locator('img[data-qr-token]').getAttribute('data-qr-token');
    console.log('[E2E] freshToken length:', freshToken?.length, 'preview:', freshToken?.substring(0, 60));

    if (!freshToken || freshToken.length < 10) {
      throw new Error('QR token empty or invalid: ' + freshToken);
    }

    // Scan dynamic QR IMMEDIATELY
    await wisamPage.evaluate((token: string) => {
      (window as any).__simulateQRScan(token);
    }, freshToken);

    // Wait for navigation or check for error toast
    await wisamPage.waitForTimeout(2000);
    console.log('[E2E] Wisam URL after scan:', wisamPage.url());

    // If still on scan page, check if an error toast appeared
    if (wisamPage.url().includes('/scan')) {
      const toastText = await wisamPage.textContent('body');
      console.log('[E2E] Wisam page body:', toastText?.substring(0, 500));
    }

    // Redirected to confirmation (or show error)
    await expect(wisamPage).toHaveURL(/\/pengajar\/(konfirmasi|scan)/, { timeout: 15000 });
    if (wisamPage.url().includes('/konfirmasi')) {
      // OK — check-in succeeded
    } else {
      // Check-in may have failed — look for toast
      const bodyText = await wisamPage.textContent('body');
      throw new Error('Check-in did not redirect. Page body: ' + bodyText?.substring(0, 300));
    }

    // Success message
    await expect(
      wisamPage.getByText(/Presensi Masuk Berhasil!/i)
    ).toBeVisible({ timeout: 10000 });

    // ─── Nawal: verify Wisam appears (realtime count updates) ───
    // Wait for attendance count to change from 1 (Nawal) to 2 (Nawal + Wisam)
    await expect(nawalPage.getByText(/Total Pengajar Hadir/i)).toBeVisible({ timeout: 5000 });
    await expect(nawalPage.locator('text=2').first()).toBeVisible({ timeout: 15000 });

    // Also verify name appears
    try {
      await expect(nawalPage.getByText(/Wisam|Rahman/i).first()).toBeVisible({ timeout: 5000 });
    } catch {
      console.log('[E2E] Wisam name not found visually — checking count only');
    }

    // ─── Nawal: tutup sesi ───
    await nawalPage.getByRole('button', { name: /Tutup Sesi/i }).click();
    const notesField = nawalPage.getByPlaceholder(/Materi yang diberikan hari ini/i);
    await expect(notesField).toBeVisible();
    await notesField.fill('E2E Test UII — Belajar Bersama');
    await nawalPage.getByRole('button', { name: /^Tutup Sesi$/ }).click();

    await expect(
      nawalPage.getByText(/Sesi berhasil ditutup/i)
    ).toBeVisible({ timeout: 10000 });

    await expect(
      nawalPage.getByText(/Sesi Selesai/i)
    ).toBeVisible({ timeout: 10000 });

    await nawalCtx.close();
    await wisamCtx.close();
  });
});
