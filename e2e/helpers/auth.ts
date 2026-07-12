import { Page, expect } from '@playwright/test';

export async function loginAs(page: Page, nimOrEmail: string, password: string) {
  await page.goto('/login');
  await expect(page.getByText('Memuat...')).toBeHidden({ timeout: 15000 });
  await page.getByLabel('NIM').fill(nimOrEmail);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Masuk' }).click();
}
