import { test, expect } from '@playwright/test';

test.describe('Authentication & Route Guard', () => {

  test.beforeEach(async ({ page }) => {
    // Buka halaman utama
    await page.goto('/');
    
    // Tunggu loading inisialisasi store selesai (layar "Memuat..." menghilang)
    await expect(page.getByText('Memuat...')).toBeHidden({ timeout: 15000 });
  });
  
  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Navigasi ke dashboard pengajar tanpa session
    await page.goto('/pengajar/dashboard');
    
    // Tunggu loading layar selesai
    await expect(page.getByText('Memuat...')).toBeHidden({ timeout: 15000 });
    
    // Harus otomatis dialihkan ke /login
    await expect(page).toHaveURL(/.*\/login/);
    
    // Form login harus terlihat dengan label yang benar
    await expect(page.getByLabel('NIM')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('should show error when login fails', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Memuat...')).toBeHidden({ timeout: 15000 });
    
    // Isi credentials salah (NIM tidak valid)
    await page.getByLabel('NIM').fill('invalid-email');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Masuk' }).click();
    
    // Tunggu toast error muncul
    // Pesan error dari store: "NIM tidak ditemukan" atau dari network
    await expect(page.getByText(/tidak ditemukan|salah|kesalahan/i)).toBeVisible({ timeout: 10000 });
  });

});
