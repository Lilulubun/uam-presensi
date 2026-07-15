import { test } from '@playwright/test';
import { loginAs } from './helpers/auth';

test('diag: verify TPA-002 GPS', async ({ browser }) => {
  // Use EXACT DB coordinates
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: -7.744803275758542, longitude: 110.41414103514991 }
  });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'log' || msg.type() === 'error') {
      console.log(`[BROWSER ${msg.type()}] ${msg.text().substring(0, 200)}`);
    }
  });

  await loginAs(page, '20521001', '23523198uam');
  await page.goto('/pengajar/scan');

  // Get the geolocation value the browser is actually using
  const gps = await page.evaluate(() => {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => resolve({ error: err.message, code: err.code }),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  });
  console.log('GPS from evaluate:', JSON.stringify(gps));

  // Click permission button
  await page.getByRole('button', { name: /Izinkan Akses Lokasi/i }).click();
  await page.waitForTimeout(2000);

  // Check location status
  const statusText = await page.textContent('body');
  const match = statusText?.match(/TPA [\w-]+ · ([\d.]+[km]{1,2})/);
  console.log('Location status line:', match?.[0] || 'not found');

  await context.close();
});
