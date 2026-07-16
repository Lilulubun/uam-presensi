import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

test.describe('Session Finalization', () => {

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
            .update({ is_active: false, date_closed: new Date().toISOString(), close_notes: 'E2E cleanup before finalize test' })
            .eq('id', s.id);
        }
      }
    }
  });

  test('should require notes and successfully close the session', async ({ browser }) => {
    // Seed: assign Budi (host) to TPA-001 so the ExpectedTeacherSelector renders.
    {
      const url = process.env.SUPABASE_URL!;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const supabase = createClient(url, key, { auth: { persistSession: false } });
      const { data: users } = await supabase.from('users').select('id, nim');
      const u = users?.find((x: any) => x.nim === '20521001');
      if (u) {
        await supabase.from('pengajar_tpa').delete().eq('user_id', u.id);
        await supabase.from('pengajar_tpa').insert({ user_id: u.id, tpa_id: 'tpa-001' });
      }
    }

    const hostContext = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: -7.686439, longitude: 110.418313 } // TPA Al-Fath
    });
    const hostPage = await hostContext.newPage();
    await loginAs(hostPage, '20521001', '23523198uam');

    await hostPage.goto('/pengajar/scan');
    await hostPage.getByRole('button', { name: /Izinkan Akses Lokasi/i }).click();

    // Wait until simulate helper is ready
    await hostPage.waitForFunction(() => typeof (window as any).__simulateQRScan === 'function', { timeout: 10000 });

    // Scan static QR TPA-001 to open session
    await hostPage.evaluate(() => {
      (window as any).__simulateQRScan('TPA-001');
    });

    // New flow: select expected teachers then click "Buka Sesi"
    await expect(hostPage.getByText(/Pilih Pengajar yang Wajib Hadir/i)).toBeVisible({ timeout: 10000 });
    await expect.poll(async () => {
      return await hostPage.locator('input[type="checkbox"]').count();
    }, { timeout: 15000, message: 'checkboxes should appear' }).toBeGreaterThanOrEqual(1);
    await hostPage.locator('input[type="checkbox"]').first().check();
    await hostPage.getByRole('button', { name: /Buka Sesi/i }).click();

    // Verify redirect to session page
    await expect(hostPage).toHaveURL(/.*\/pengajar\/session\/.*/, { timeout: 15000 });

    // Click close session button
    await hostPage.getByRole('button', { name: /Tutup Sesi/i }).click();

    // Dialog opens. Fill the notes input.
    const notesField = hostPage.getByPlaceholder(/Materi yang diberikan hari ini/i);
    await expect(notesField).toBeVisible();
    await notesField.fill('Belajar Ilmu Tajwid Keras');

    // Submit dialog (the AlertDialogAction button with text "Tutup Sesi")
    await hostPage.getByRole('button', { name: /^Tutup Sesi$/ }).click();

    // Verify success toast/alert
    await expect(hostPage.getByText(/Sesi berhasil ditutup/i)).toBeVisible({ timeout: 10000 });

    // Verify UI changes to "Sesi Selesai" and shows the material notes
    await expect(hostPage.getByText(/Sesi Selesai/i)).toBeVisible({ timeout: 10000 });
    await expect(hostPage.getByText(/Belajar Ilmu Tajwid Keras/i)).toBeVisible({ timeout: 10000 });

    // Click Kembali ke Dashboard button
    await hostPage.getByRole('button', { name: /Kembali ke Dashboard/i }).click();

    // Verify redirection back to dashboard
    await expect(hostPage).toHaveURL(/.*\/pengajar\/dashboard/i, { timeout: 10000 });

    await hostContext.close();
  });

});
