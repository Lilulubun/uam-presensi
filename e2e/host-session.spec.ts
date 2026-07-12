import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

test.describe('Host Session Creation', () => {

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
            .update({ is_active: false, date_closed: new Date().toISOString(), close_notes: 'E2E cleanup before host-session test' })
            .eq('id', s.id);
        }
      }
    }
  });

  test('should show out-of-radius status when GPS is outside TPA radius', async ({ browser }) => {
    // Set GPS coordinates far away (e.g., Jakarta center)
    const context = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: -6.2088, longitude: 106.8456 }
    });
    const page = await context.newPage();
    await loginAs(page, '20521001', '23523198uam');
    
    await page.goto('/pengajar/scan');
    
    // Klik tombol izin lokasi untuk memulai scan
    await page.getByRole('button', { name: /Izinkan Akses Lokasi/i }).click();

    // Verify UI shows out-of-radius status in the location status card
    await expect(page.getByText(/Di luar radius TPA terdekat/i)).toBeVisible({ timeout: 10000 });
    await context.close();
  });

  test('should create session successfully when inside TPA radius', async ({ browser }) => {
    // Set GPS coordinates exactly at TPA Al-Fath
    const context = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: -7.686439, longitude: 110.418313 }
    });
    const page = await context.newPage();
    await loginAs(page, '20521001', '23523198uam');

    await page.goto('/pengajar/scan');
    
    // Klik tombol izin lokasi untuk memulai sesi
    await page.getByRole('button', { name: /Izinkan Akses Lokasi/i }).click();

    // Wait until simulate helper is ready
    await page.waitForFunction(() => typeof (window as any).__simulateQRScan === 'function', { timeout: 10000 });

    // Simulate QR code scan for TPA Al-Fath static QR
    await page.evaluate(() => {
      (window as any).__simulateQRScan('TPA-001');
    });

    // Verify redirection to active session screen
    await expect(page).toHaveURL(/.*\/pengajar\/session\/.*/, { timeout: 15000 });
    await context.close();
  });

});
