# Code Review — Sistem Presensi Pengajar (UAM)

**Date:** 2026-06-02
**Scope:** `src/` (excluding `src/app/components/ui/*` shadcn primitives)
**Note:** PRD (`PRD_UAM_v1.0.docx.pdf`) could not be read by this model — see "PRD Status" at the end.

---

## TL;DR

This is a **frontend-only React + Vite + Zustand SPA prototype** for an
instructor-attendance system ("UAM / UII Ayo Mengajar"). Typecheck is clean
and **71/71 tests pass**. Architecture is sensible, tests cover the main
user-facing flows, and prototype shortcuts are consistently labeled in
comments. There is one **must-fix-before-demo** item (GPS bypass
silently active) and a handful of small polish items.

The full PRD-vs-implementation grading **cannot be done** without the PRD.

---

## Architecture Map

| Layer | File(s) | Role |
|---|---|---|
| Entry | `src/main.tsx` | React root |
| Routing | `src/app/App.tsx` | `BrowserRouter`, role-based redirects, ErrorBoundary per route |
| Stores (Zustand + persist) | `src/store/authStore.ts`, `sessionStore.ts`, `attendanceStore.ts`, `tpaStore.ts` | Domain state in `localStorage` |
| Domain libs | `src/lib/date-utils.ts`, `gps-utils.ts`, `qr-utils.ts`, `mock-data.ts`, `seed-data.ts` | Pure functions + mock data |
| Hooks | `src/app/hooks/useSeedData.ts`, `useDynamicQR.ts`, `useWatchLocation.ts`, `useGeolocation.ts`, `useQRScanner.ts` | Cross-cutting concerns |
| Pages — pengajar | `src/pages/pengajar/*` | Dashboard, Scan, SessionActive, Konfirmasi, Riwayat |
| Pages — pengurus | `src/pages/pengurus/*` | Dashboard, TPADetail, Laporan, Pengaturan |
| Components | `src/app/components/ProtectedRoute.tsx`, `ErrorBoundary.tsx`, `qr/*`, `gps/*` | Reusable UI |

---

## Strengths

1. **State isolation** — stores have no cross-imports except the one
   intentional edge (`sessionStore` calls `attendanceStore.recordFirstTeacherAttendance`).
2. **`useShallow`** is used wherever a component reads multiple fields
   from a store — avoids unnecessary re-renders.
3. **`ErrorBoundary` wrapping every protected route** (`App.tsx:55-65`) —
   single component, per-route boundary, with retry.
4. **Race protection in `openSession`** — `localStorage` lock keyed by
   `tpaId` prevents double-open when two devices race.
5. **Double-scan protection in `ScanPage`** — `processingRef.current`
   guard short-circuits re-entrant scans during async work.
6. **Stable seed data** — `seededRand` in `seed-data.ts:13-19` makes demo
   data deterministic and idempotent via `uam-seed-v1` flag.
7. **QR refresh loop** — `useDynamicQR` (lines 36-52) ticks every second,
   refreshes the token at `remaining <= 0`, and survives re-renders via
   `refreshRef`.
8. **Date safety on hydration** — every `new Date(session.x)` call in
   stores guards against the `localStorage`-stringified Date roundtrip.
9. **Tests follow a consistent pattern** — `vi.mock` per store, mutable
   shared state, `MemoryRouter`, render-and-query.

---

## Issues (fix even for prototype)

### 🔴 M1 — GPS bypass is a single constant in app config
- **File:** `src/lib/gps-utils.ts:46-49`, flag in `src/config.ts:13`
- **Risk:** `GPS_DEBUG_MODE = true` causes `isWithinRadius` to return
  `true` unconditionally. Anyone who clones and deploys this without
  flipping the flag ships an attendance system that never enforces
  geofencing. The "Bypassing GPS validation!" `console.warn` is not
  enough.
- **Fix:**
  - Move the bypass into a test-only export (e.g. `isWithinRadiusRaw`)
    and have production code import the strict version.
  - Or gate on `import.meta.env.MODE !== 'production'`.
  - Make `GPS_DEBUG_MODE` default to `false` and only `true` when an
    explicit env var is set.

### 🟠 M2 — Mock credentials in client
- **File:** `src/lib/mock-data.ts:74-106`, surfaced in `LoginPage.tsx:93-99`
- **Risk:** Inert for static export, but a future engineer copy-pasting
  the file for a different app inherits the credentials.
- **Fix:** Add a `// PROTOTYPE ONLY — never ship to production.` banner
  at the top of `MOCK_USERS` and at the demo-credentials block on
  `LoginPage`.

### 🟠 M3 — `PengaturanPage.handlePrintOne` uses unescaped interpolation
- **File:** `src/pages/pengurus/PengaturanPage.tsx:34-63`
- **Risk:** `tpa.name` and `tpa.staticQRCode` are concatenated into
  `document.write`. Current mock data is safe, but any future TPA with
  `<`, `>`, or `"` in its name breaks the print window.
- **Fix:** Build DOM nodes with `textContent` or set
  `win.document.body.textContent = ...` for the safe fields.

### 🟡 m4 — `DashboardPengajar.todayAttendances` takes the first record
- **File:** `src/pages/pengajar/DashboardPengajar.tsx:23-29`
- **Behavior:** A teacher with multiple sessions in a day sees only
  `todayAttendances[0]` for the "Status Hari Ini" card. Order is the
  order of `attendances` (insertion). If multiple are present, only the
  first matters.
- **Fix:** Either pick the latest by `scanInTime`, or add a comment
  explaining "at most one presensi per day is supported in this view".

### 🟡 m5 — `DashboardPengurus.getTPAStats` shows 0 if no active session
- **File:** `src/pages/pengurus/DashboardPengurus.tsx:46-56`
- **Behavior:** When the active session is null, `presentCount` is 0 —
  even if a closed session exists for today.
- **Fix:** For the "TPA list" card, show "Sesi ditutup · N hadir" for
  closed today-sessions. Currently it just says "Tidak ada sesi aktif".

### 🟡 m6 — Admin dashboard re-renders every 10s
- **File:** `src/pages/pengurus/DashboardPengurus.tsx:32-35`
- **Behavior:** `setInterval` flips `lastUpdated` every 10s, which
  re-renders the whole page (chart, table, TPA grid).
- **Fix:** Display-only — keep the interval but only use it for the
  "Diperbarui HH:mm" label. Drive the data from store subscriptions.

### 🟡 m7 — Early-exit flag in reports uses the wrong condition
- **File:** `src/pages/pengurus/LaporanPage.tsx:53`
- **Behavior:** `earlyExit = !!(a.scanInTime && !a.scanOutTime && !session.isActive)`.
  Combined with the local sort by date, "Pulang Awal" is correct.
  However the same logic on the admin dashboard's TPA list
  (`TPADetailPage.tsx:80`) and on the teacher's Riwayat page
  (`RiwayatPage.tsx:70`) duplicates the same predicate in three places.
- **Fix:** Extract `isEarlyExit(attendance, session)` to `date-utils.ts`
  or a new `attendance-utils.ts`.

---

## Prototype Debt (intentional, track for prod)

These are clearly marked in code. Listing them so they're visible at
release time, not because they need fixing now:

- `localStorage` is the only persistence — no cross-device sync
- Mock auth in `authStore` — replace with real auth provider
- QR token is a UUID (predictable) — replace with signed JWT
- No PII redaction for `scanInLocation` / `scanOutLocation` in
  `KonfirmasiPresensi`
- No rate-limit / lockout on login
- No accessibility audit (icon-only buttons, focus order on dialogs)
- No i18n (UI is hard-coded in Indonesian)
- Seed data uses fixed `user-001` etc. — only the 3 mock teachers get
  the rotation; pengurus never appears in `teacherStats`

---

## Things I Verified

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | clean (no errors) |
| Tests | `npm test` | 8 files, **71/71 passing** |
| Console output during tests | — | The `Error: 💥` lines in stderr are intentional `ErrorBoundary` test triggers; tests still pass |

---

## Coverage by Likely PRD Area (inferred)

| Likely PRD topic | Where it lives | Status |
|---|---|---|
| Login (pengajar + pengurus) | `LoginPage`, `authStore` | present |
| Pengajar dashboard | `pages/pengajar/DashboardPengajar.tsx` | present |
| Scan QR | `pages/pengajar/ScanPage.tsx` | present |
| Sesi aktif (manage own session) | `pages/pengajar/SessionActivePage.tsx` | present |
| Konfirmasi presensi | `pages/pengajar/KonfirmasiPresensi.tsx` | present |
| Riwayat presensi (pengajar) | `pages/pengajar/RiwayatPage.tsx` | present |
| Pengurus dashboard | `pages/pengurus/DashboardPengurus.tsx` | present |
| TPA detail (pengurus) | `pages/pengurus/TPADetailPage.tsx` | present |
| Laporan + export CSV/Excel/JSON | `pages/pengurus/LaporanPage.tsx` | present |
| Setup QR statis | `pages/pengurus/PengaturanPage.tsx` | present |
| Dynamic QR (in/out, 20s) | `useDynamicQR`, `QRDisplay`, `qr-utils` | present |
| GPS radius check | `gps-utils.isWithinRadius` | present (debug-bypassed, see M1) |
| Late detection (15 min) | `date-utils.isLate/calculateLateMinutes` + `APP_CONFIG.LATE_THRESHOLD_MINUTES` | present |
| First-teacher-opens-session | `sessionStore.openSession` + `recordFirstTeacherAttendance` | present |
| Seeded demo data | `useSeedData`, `seed-data.ts` | present |

Items I do **not** see and that a PRD for an attendance system often
requires (worth confirming against the PRD):
- Manual attendance correction / override by pengurus
- Notification/email to late or absent teachers
- Per-TPA schedule (`Sesi` only opens at certain times of day)
- Audit log (who changed what)
- Multi-admin / role granularity (currently `pengurus` is one role)
- Logout-from-all-devices
- Password reset

---

## PRD Status

PRD provided as `PRD_UAM_v1.0.docx.md` (v1.0, 1 Juni 2026, Status: Draft).
Full per-requirement trace below.

---

# PRD Trace (v1.0)

Legend: ✅ implemented · ⚠️ partial / deviates · ❌ missing · 🚫 out of scope

## 3.1 Autentikasi

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| AUTH-01 | Login page, email + password | ✅ | `src/pages/LoginPage.tsx:43-90` |
| AUTH-02 | Role-based redirect | ✅ | `src/pages/LoginPage.tsx:28-32`, `src/app/App.tsx:35-47` |
| AUTH-03 | Persistent session, logout | ✅ | `src/store/authStore.ts:7-66` (zustand `persist` + `logout`) |
| AUTH-04 | Reject unauthenticated access | ✅ | `src/app/components/ProtectedRoute.tsx:19-21` |

## 3.2 Manajemen Sesi

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| SESI-01 | Validate static QR against registered TPA | ✅ | `src/pages/pengajar/ScanPage.tsx:43-49` (`isValidStaticQRCode` + `getTpaByQRCode`) |
| SESI-02 | Reject if active session exists | ✅ | `src/store/sessionStore.ts:32-42` |
| SESI-03 | Record `t_open` + first teacher identity | ✅ | `src/store/sessionStore.ts:44-56` |
| SESI-04 | Activate `QR_dynamic_in` immediately, 20s refresh | ✅ | `src/store/sessionStore.ts:54-55`; `src/app/hooks/useDynamicQR.ts:36-52`; `src/config.ts:3` |
| SESI-05 | **QR state on server, not browser** | ❌ | `localStorage` only (`src/store/sessionStore.ts:176-182`). Architectural gap. |
| SESI-06 | Only first teacher can close | ⚠️ | UI guards it (`src/pages/pengajar/SessionActivePage.tsx:167`), but the **store function does not validate `firstTeacherId`** (`src/store/sessionStore.ts:80-129`). |
| SESI-07 | Record `t_close` + activate `QR_dynamic_out` | ✅ | `src/store/sessionStore.ts:105-114` |

## 3.3 Presensi Masuk

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| P-IN-01 | First teacher's P_in auto-recorded on open | ✅ | `src/store/sessionStore.ts:64-68` + `attendanceStore.recordFirstTeacherAttendance` |
| P-IN-02 | Validate token: not expired, not used by user on this session | ✅ | `src/store/attendanceStore.ts:69-97` |
| P-IN-03 | GPS within radius of TPA | ⚠️ | Validated in `attendanceStore.ts:106-113`, but **client-side only** (see NFR-SEC-05) and bypassed when `GPS_DEBUG_MODE=true` (`src/lib/gps-utils.ts:46-49`). |
| P-IN-04 | Record `t_scan_in` | ✅ | `src/store/attendanceStore.ts:128,151` |
| P-IN-05 | Calculate late based on (t_open + 15 min) | ✅ | `src/lib/date-utils.ts:44-65`; `src/store/attendanceStore.ts:119-120` (excludes first teacher) |
| P-IN-06 | Confirmation page with status | ✅ | `src/pages/pengajar/KonfirmasiPresensi.tsx:32-87` |

## 3.4 Presensi Keluar

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| P-OUT-01 | `QR_dynamic_out` only active after close | ✅ | `src/store/sessionStore.ts:108-114` (token generated on close) + `refreshQRToken` skip-when-active guard (`sessionStore.ts:141-142`) |
| P-OUT-02 | Validate token (not expired, not used) | ✅ | `src/store/attendanceStore.ts:185-235` |
| P-OUT-03 | Validate GPS | ⚠️ | Same caveat as P-IN-03. |
| P-OUT-04 | Record `t_scan_out` | ✅ | `src/store/attendanceStore.ts:240` |
| P-OUT-05 | Confirmation | ✅ | `KonfirmasiPresensi` handles `type: 'out'` (line 30) |

## 3.5 Validasi GPS

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| GPS-01 | Read device GPS at scan | ✅ | `src/lib/gps-utils.ts:59-99`; called in `ScanPage` (lines 57, 76) |
| GPS-02 | Compare with reference TPA coords | ✅ | `src/lib/gps-utils.ts:19-36, 41-54` (Haversine + radius) |
| GPS-03 | Reject if outside radius with informative message | ✅ | `attendanceStore.ts:106-113, 208-215` (Indonesian message includes radius) |
| GPS-04 | Handle permission denied with notification | ❌ | `getCurrentLocation` rejects with a message, and `ScanPage.handleScan` toasts it. **However, no proactive "permission required" UI** — once denied, the browser caches the denial and the user sees a generic error. PRD asks for a "notifikasi yang sesuai" suggesting a clearer in-app prompt. |

## 3.6 Dashboard Monitoring (Pengurus)

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| DASH-01 | Real-time status of 11 TPAs | ✅ | `src/pages/pengurus/DashboardPengurus.tsx:200-242`; refresh every 10s (`32-35`) |
| DASH-02 | TPA detail: open/close time, count, list, status | ✅ | `src/pages/pengurus/TPADetailPage.tsx:75-127` |
| DASH-03 | **Teacher detail page** with history incl. late + early exit flags | ❌ | **No route, no component.** PRD lists this screen in §8 ("Detail Pengajar"). The closest existing view is `pages/pengajar/RiwayatPage.tsx` (a teacher viewing themselves) — not a pengurus-facing teacher drill-in. |
| DASH-04 | Detect & flag early exit | ⚠️ | Detected at `RiwayatPage.tsx:70`, `LaporanPage.tsx:53`, `TPADetailPage.tsx:154`. **But the formula does not exclude `Actor_first`** — see PRD inconsistency note below. |
| DASH-05 | Export attendance data | ✅ | `src/pages/pengurus/LaporanPage.tsx:101-124` (CSV/Excel/JSON) |

## 4. Non-Functional Requirements

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| NFR-PERF-01 | QR refresh in <1s after 20s interval | ✅ | `useDynamicQR.ts:36-52` (1s tick, refresh on `remaining <= 0`) |
| NFR-PERF-02 | Validation (token + GPS) response <3s | ✅ | All checks are synchronous + local; `Promise.resolve` on `getCurrentLocation` in debug mode is instant. |
| NFR-PERF-03 | Dashboard loads all TPAs in <5s | ✅ | Mock data, synchronous render. |
| NFR-SEC-01 | Single-use token per user per session | ✅ | "Per user per session" satisfied by `existingAttendance?.scanInTime` guard at `attendanceStore.ts:91-97`. The token is shared across users by design (refresh every 20s) — that matches the formal `T_in` definition in §6. |
| NFR-SEC-02 | Token expires after 20s | ✅ | `src/lib/qr-utils.ts:14-15` + `isTokenExpired` |
| NFR-SEC-03 | **QR and session state on server** | ❌ | `localStorage` only — see SESI-05. |
| NFR-SEC-04 | HTTPS for all communication | ❌ | N/A for static frontend; deployment responsibility. |
| NFR-SEC-05 | **GPS validation on server, not client** | ❌ | Client-side only. Architectural gap. |
| NFR-COMPAT-01 | Modern browsers, no plugins | ✅ | `html5-qrcode` + `qrcode` libs |
| NFR-COMPAT-02 | Responsive 390 / 768 / 1440 | ✅ | Tailwind responsive classes; mobile-first layouts (e.g. `max-w-lg` on pengajar, `max-w-6xl` on pengurus) |
| NFR-COMPAT-03 | Camera via standard Web API | ✅ | `getUserMedia` via `html5-qrcode` |

## 5. Edge Cases & Business Rules

| Edge case | Status | Evidence / Note |
|---|---|---|
| 5.1 Sesi tidak ditutup → indefinite | ✅ | No auto-close logic exists. PRD §7 lists auto-close as **out of scope**. |
| 5.1 Scan static QR saat sesi aktif | ⚠️ | `ScanPage.tsx:50-55` shows an informational banner. PRD wants a "notifikasi" — a toast is more standard; current behavior shows a banner. |
| 5.1 First teacher scan QR_dynamic_in after opening | ❌ | Generic "Anda sudah melakukan presensi masuk" (`attendanceStore.ts:94`). PRD wants tailored "presensi masuk telah otomatis tercatat, tidak diproses ulang". |
| 5.1 Pengurus tutup sesi manual | ❌ | No UI for pengurus to force-close. PRD says "Pengurus UAM dapat menutup sesi secara manual melalui panel admin jika diperlukan." |
| 5.2 Token expired at scan | ✅ | `attendanceStore.ts:77-84` |
| 5.2 Same user scans QR_dynamic_in twice | ✅ | `attendanceStore.ts:91-97` |
| 5.2 GPS gagal / tidak tersedia | ✅ | `ScanPage.tsx:97-99` catches and toasts; no presensi recorded. |
| 5.2 Outside radius | ✅ | `attendanceStore.ts:106-113` |
| 5.3 Scan QR_dynamic_out before close | ✅ | `qrDynamicOutToken` only generated on close (`sessionStore.ts:108-114`) |
| 5.3 Forgot to scan out | ✅ | Detected as Early Exit in 3 places (see DASH-04). |
| 5.3 First teacher no out scan → early exit | ✅ | Behavior matches PRD §5.3 prose; **but contradicts PRD §6 formal notation** — see inconsistency note. |
| 5.4 15-min threshold, first teacher exempt, store in minutes | ✅ | `date-utils.ts:44-65`, `attendanceStore.ts:119-120` |

## 8. Screen Inventory

| Screen | Status | Notes |
|---|---|---|
| Login | ✅ | `LoginPage.tsx` |
| Home / Dashboard Pengajar | ✅ | `pages/pengajar/DashboardPengajar.tsx` |
| Scan QR | ✅ | `pages/pengajar/ScanPage.tsx` |
| Konfirmasi Presensi Masuk | ✅ | `KonfirmasiPresensi.tsx` with `type: 'in'` |
| Konfirmasi Presensi Keluar | ✅ | Same component, `type: 'out'` (PRD lists them as separate entries; the implementation merges them) |
| Riwayat Kehadiran Pribadi | ✅ | `pages/pengajar/RiwayatPage.tsx` |
| Halaman Sesi Aktif | ✅ | `pages/pengajar/SessionActivePage.tsx` |
| **Konfirmasi Penutupan Sesi** | ❌ | "Tutup Sesi" button calls `closeSession` directly (`SessionActivePage.tsx:41-56, 167-177`). No confirm dialog before close; no separate "QR out" landing page — the active page flips to out mode (`SessionActivePage.tsx:97-105`). `AlertDialog` is in `ui/` but unused. |
| Dashboard Utama Pengurus | ✅ | `pages/pengurus/DashboardPengurus.tsx` |
| Detail TPA | ✅ | `pages/pengurus/TPADetailPage.tsx` |
| **Detail Pengajar** | ❌ | Not implemented. No route, no page. |
| Halaman Laporan / Ekspor | ✅ | `pages/pengurus/LaporanPage.tsx` |

## 7. Out of Scope — confirmed not implemented (correct)

| Item | Status | Note |
|---|---|---|
| Auto-close | 🚫 | None implemented — matches §7 |
| Real-time early-exit push | 🚫 | Passive detection only — matches §7 |
| Mobile native app | 🚫 | Browser only — matches §7 |
| Self-registration | 🚫 | Mock users only — matches §7 |
| Event-based notifications | 🚫 | None — matches §7 |

---

## Issues (regardless of PRD)

### 🔴 M1 — `GPS_DEBUG_MODE = true` is the default in `config.ts:13`
Combined with the unconditional bypass in `src/lib/gps-utils.ts:46-49`,
this means a fresh clone will silently skip geofence checks. **Not a PRD
violation per se** (debug mode is fine in dev), but the constant is a
footgun. Default to `false` and toggle via env.

### 🟠 M2 — Mock credentials hardcoded in client
`src/lib/mock-data.ts:74-106` + demo block in `LoginPage.tsx:93-99`. Fine
for prototype, but add a top-of-file `// PROTOTYPE ONLY` banner.

### 🟠 M3 — `PengaturanPage.handlePrintOne` interpolates HTML unescaped
`src/pages/pengurus/PengaturanPage.tsx:34-63`. Currently safe with mock
data, but a future TPA name with `<` or `"` breaks the print window.

### 🟡 m4 — Single-record-per-day in `DashboardPengajar`
`DashboardPengajar.tsx:23-29` shows only `todayAttendances[0]`. If a
teacher has two sessions in a day, the second is invisible. Intentional?

### 🟡 m5 — `DashboardPengurus.getTPAStats` shows 0 for closed today
`DashboardPengurus.tsx:46-56` — `presentCount` is 0 unless session is
active, even if a closed session exists for today.

### 🟡 m6 — Whole admin dashboard re-renders every 10s
`DashboardPengurus.tsx:32-35` — only the timestamp label needs the poll.

### 🟡 m7 — Early-exit predicate duplicated in 3 files
`RiwayatPage.tsx:70`, `LaporanPage.tsx:53`, `TPADetailPage.tsx:154`.
Extract to `lib/attendance-utils.ts`.

---

## PRD Inconsistencies to Resolve

The PRD has two places that contradict each other; flag these for the
product owner.

1. **Early-exit scope for first teacher**
   - §6 formal notation: `E = { u ∈ P_in | u ≠ Actor_first ∧ P_out(u) = ∅ }` → **excludes** first teacher
   - §5.3 prose: "Sistem memperlakukan Pengajar Pertama sama seperti pengajar lain untuk presensi keluar." → **includes** first teacher
   - Implementation follows §5.3 (does not exclude first teacher). Decide
     which is canonical and align doc + code.

2. **Konfirmasi Penutupan Sesi is listed in §8 as a screen**, but the
   behavior described ("Dialog konfirmasi sebelum sesi ditutup, **lalu
   menampilkan QR_dynamic_out**") implies either (a) a dedicated page
   that displays the out QR, or (b) the Sesi Aktif page transforms in
   place. Current implementation does (b) without the dialog. The PRD
   could be read either way; pick one and document it.

---

## Verifications (this turn)

- `npm test` → **8 files, 71/71 passing**
- `npm run typecheck` → **clean (no errors)**
- `closeSession` re-read: `src/store/sessionStore.ts:80-129` — no
  `firstTeacherId` validation
- All routes re-read: `src/app/App.tsx:55-65` — no
  `/pengurus/pengajar/:id` route
- Early-exit formula verified in 3 files
- `getActiveSessionByTPA` and banner shown in `ScanPage.tsx:50-55`

