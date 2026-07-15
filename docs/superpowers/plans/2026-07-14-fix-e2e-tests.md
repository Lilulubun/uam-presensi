# Fix & Extend Playwright E2E Tests — Task Brief

## Masalah

**12 E2E test files fail** with same error: `Playwright Test did not expect test.describe() to be called here.`

Error happens because `session-finalize.spec.ts` and probably other test files use `test.describe()` in a way that conflicts with Playwright config — likely caused by:
- Test file imported by config file
- Async `test.describe()` block (only sync supported)
- Two different `@playwright/test` versions in dependencies

## Yang Perlu Dilakukan

### 1. Fix existing Playwright config & failing tests

- Baca `playwright.config.ts` (e2e/playwright.config.ts) — cek file glob, test match pattern
- Baca 12 file e2e: `ls e2e/*.spec.ts`
- Identifikasi root cause: cek apakah ada import sirkuler, async describe, atau duplicate version
- Fix: pastikan semua test file pakai sync `test.describe()`, pastikan config tidak import test files
- Fix `package.json` / `package-lock.json` jika ada duplicate `@playwright/test`

### 2. Add E2E test for Expected Teachers flow

Buat file baru `e2e/expected-teachers.spec.ts` dengan test cases:

**Flow 1: Scan → Select expected teachers → Open session**
1. Login as pengajar1
2. Mock GPS in-radius
3. Scan static QR TPA
4. ExpectedTeacherSelector muncul — verify all teachers listed (default unchecked)
5. Select 2 teachers (including self)
6. Click "Buka Sesi"
7. Verify navigated to session page
8. Verify session is active

**Flow 2: Non-expected teacher checks in later**
1. Login as pengajar2 (not in expected list)
2. Scan dynamic QR
3. Verify check-in success — attendance recorded even though not expected

**Flow 3: Close session — only expected teachers marked absent**
1. Login as first teacher
2. Close session
3. Verify "Tidak Hadir" only shows expected teachers who didn't scan

### 3. Verify all E2E tests pass

```
npx playwright test --config=e2e/playwright.config.ts
```

## Files Relevant
- `e2e/playwright.config.ts` — config
- `e2e/session-finalize.spec.ts` — main offender (describes the session flow)
- `e2e/attendance-checkin.spec.ts` — checkin flow (may need update for expected)
- `e2e/session-qr-scan.spec.ts` — QR scan flow
- `e2e/expected-teachers.spec.ts` — **NEW file to create**
- `package.json` — check @playwright/test version
- `src/pages/pengajar/ScanPage.tsx` — the component with ExpectedTeacherSelector
- `src/pages/pengajar/SessionActivePage.tsx` — absent logic after close