import { defineConfig } from '@playwright/test';
import path from 'node:path';

/**
 * Security E2E config — isolated from legacy e2e/.
 *
 * - testDir: only e2e/security (never discovers legacy specs)
 * - workers=1, retries=0: deterministic ordering, failures stay visible
 * - env: ONLY E2E_SECURITY_ENV file (never .env / .env.local)
 * - guard runs in globalSetup and ABORTS the suite on any violation
 * - raw trace/video/network capture OFF by default (JWT/QR leakage risk)
 */
const envFile = process.env.E2E_SECURITY_ENV;
if (!envFile) {
  throw new Error('playwright.security.config: E2E_SECURITY_ENV is required (path to dedicated env file)');
}

export default defineConfig({
  testDir: './e2e/security',
  testMatch: /.*\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  fullyParallel: false,

  use: {
    baseURL: process.env.E2E_BASE_URL_OVERRIDE ?? 'http://127.0.0.1:4173',
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    launchOptions: {
      executablePath:
        process.env.E2E_CHROMIUM_PATH ||
        path.join(process.env.HOME ?? '', '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'),
    },
    contextOptions: {
      ignoreHTTPSErrors: false,
    },
  },

  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],

  webServer: process.env.E2E_NO_WEB_SERVER
    ? undefined
    : {
        command: 'npx vite preview --host 127.0.0.1 --port 4173',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: true,
        timeout: 30_000,
        cwd: process.cwd(),
        env: {
          // isolated test env — never inherits .env.local backend
          VITE_SUPABASE_URL: process.env.E2E_VITE_SUPABASE_URL ?? '',
          VITE_SUPABASE_ANON_KEY: process.env.E2E_VITE_SUPABASE_ANON_KEY ?? '',
        },
      },

  globalSetup: './e2e/security/global-setup.ts',

  reporter: [['list'], ['html', { outputFolder: 'playwright-report-security', open: 'never' }], ['json', { outputFile: 'playwright-report-security/report.json' }]],
});
