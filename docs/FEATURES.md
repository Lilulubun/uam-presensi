# Features — Sistem Presensi Pengajar

> **Sistem Presensi Pengajar (Teacher Attendance System)** for **UII Ayo Mengajar** — a university community program where students teach at TPA (Taman Pendidikan Al-Quran) locations. GPS-verified QR-code-based check-in/out with full attendance management, leave requests, and administrative oversight.

---

## 1. Overview

| Attribute | Detail |
|-----------|--------|
| **Frontend** | React 18 + TypeScript 6 + Vite 6 |
| **Styling** | Tailwind CSS 4 + Radix UI + Lucide icons |
| **State** | Zustand 5 |
| **Charts** | Recharts 2 (bar charts) |
| **Backend** | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) |
| **Auth** | Supabase Auth (email/password) |
| **QR** | html5-qrcode (scan), qrcode (generate) |
| **Export** | xlsx (Excel), native CSV/JSON |
| **Tests** | Vitest + Testing Library |
| **Deploy** | Vercel (SPA with rewrites) |
| **Language** | Indonesian (full UI) |

---

## 2. Roles & Authorization

### Roles

| Role | Description |
|------|-------------|
| **Pengajar** | Teacher — attends sessions, scans QR, submits leave requests |
| **Pengurus** | Administrator — monitors attendance, manages teachers, approves leave |

### Authorization Layers

| Layer | Mechanism |
|-------|-----------|
| **Frontend routing** | `ProtectedRoute` component — requires auth + matching role |
| **DB Row-Level Security** | 5 tables with RLS policies; all mutations go through `SECURITY DEFINER` RPCs |
| **RPC guards** | Every RPC checks `auth.uid()`. Admin-only RPCs verify `is_pengurus()`. Session ownership checked via `first_teacher_id` |
| **Inactive user block** | `is_active = false` triggers sign-out with "Akun Anda telah dinonaktifkan" |

---

## 3. Route Map

| Path | Page | Role | Description |
|------|------|------|-------------|
| `/login` | `LoginPage` | public | Email/password login, role-based redirect |
| `/` | — | all | Redirects to dashboard or login |
| `/pengajar/dashboard` | `DashboardPengajar` | pengajar | Today's status, streak flame, monthly summary, GPS status, scan/izin buttons, recent history |
| `/pengajar/scan` | `ScanPage` | pengajar | QR scanner with GPS permission gate |
| `/pengajar/session/:sessionId` | `SessionActivePage` | pengajar | Dynamic rotating QR display, attendee list, close session |
| `/pengajar/konfirmasi` | `KonfirmasiPresensi` | pengajar | Scan result feedback (success/failure, late status) |
| `/pengajar/riwayat` | `RiwayatPage` | pengajar | Full attendance history with stats and filters |
| `/pengajar/izin` | `IzinPage` | pengajar | Submit leave request + submission history |
| `/pengurus/dashboard` | `DashboardPengurus` | pengurus | Realtime stats, 7-day chart, TPA status grid, pending izin, teacher recap |
| `/pengurus/tpa/:tpaId` | `TPADetailPage` | pengurus | TPA session history, attendee lists, force-close |
| `/pengurus/pengajar/:userId` | `DetailPengajar` | pengurus | Teacher stats, monthly report, full attendance list |
| `/pengurus/laporan` | `LaporanPage` | pengurus | Filterable report table with CSV/Excel/JSON export |
| `/pengurus/pengaturan` | `PengaturanPage` | pengurus | Static QR code setup per TPA with print support |
| `/pengurus/kelola-pengajar` | `KelolaPengajar` | pengurus | Teacher management (add, bulk CSV, assign TPA, toggle active, delete) |
| `/profile` | `Profile` | all | Profile display + change password |

---

## 4. Database Schema

### `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | FK to `auth.users` |
| `email` | text UNIQUE | |
| `name` | text | |
| `role` | `user_role` enum | `pengajar` / `pengurus` |
| `nim` | text nullable | Student ID |
| `is_active` | bool default true | Blocks login when false |

### `tpas`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | Short code (e.g. `TPA-001`) |
| `name` | text | Full name |
| `location` | jsonb | `{lat, lng, radius}` in meters |
| `static_qr_code` | text UNIQUE | Static QR content for session opening |

### `sessions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tpa_id` | text FK → `tpas` | |
| `first_teacher_id` | uuid FK → `users` | Teacher who opened the session |
| `date_opened` | timestamptz | |
| `date_closed` | timestamptz nullable | |
| `is_active` | bool | |
| `qr_dynamic_in_token` | text | Rotating QR for check-in |
| `qr_dynamic_in_expiry` | timestamptz | |
| `qr_dynamic_out_token` | text | QR for check-out (post-close) |
| `qr_dynamic_out_expiry` | timestamptz | |
| `close_notes` | text nullable | Notes entered on close |

### `attendances`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `session_id` | uuid FK → `sessions` | |
| `user_id` | uuid FK → `users` | |
| `scan_in_time` | timestamptz | |
| `scan_out_time` | timestamptz nullable | |
| `is_late` | bool | >15 min after session open |
| `late_minutes` | int | |
| `scan_in_location` | jsonb nullable | GPS coords at scan-in |
| `scan_out_location` | jsonb nullable | GPS coords at scan-out |
| UNIQUE | `(session_id, user_id)` | One attendance per teacher per session |

### `used_tokens`

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid FK → `users` | |
| `session_id` | uuid FK → `sessions` | |
| `token` | text | |
| `used_at` | timestamptz | |
| PK | `(user_id, session_id, token)` | |

### `interaction_logs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → `users` nullable | |
| `event_type` | text | e.g. `session_opened`, `scan_in_success` |
| `session_id` | uuid FK → `sessions` nullable | |
| `metadata` | jsonb nullable | |
| `created_at` | timestamptz | |

### `pengajar_tpa`

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid FK → `users` PK | |
| `tpa_id` | text FK → `tpas` PK | |
| UNIQUE | `(user_id)` | One TPA per teacher |

### `izin_requests`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → `users` | |
| `start_date` | date | |
| `end_date` | date | `CHECK (end_date >= start_date)` |
| `alasan` | text | Reason |
| `status` | `izin_status` enum | `pending` / `approved` / `rejected` |
| `reviewed_by` | uuid FK → `users` nullable | Admin who reviewed |
| `created_at` | timestamptz | |
| `reviewed_at` | timestamptz nullable | |

---

## 5. RPC Functions

All are `SECURITY DEFINER` PostgreSQL functions:

### Utility

| Function | Signature | Returns | Purpose |
|----------|-----------|---------|---------|
| `is_pengurus()` | — | boolean | Current user is admin |
| `is_pengajar()` | — | boolean | Current user is teacher |
| `haversine_m(a jsonb, b jsonb)` | `{lat,lng}` × 2 | float | GPS distance in meters |

### Session Lifecycle

| Function | Parameters | Returns | Purpose |
|----------|-----------|---------|---------|
| `open_session(tpa_id, location)` | text, jsonb | `sessions` | GPS-validated session open, auto-record first-teacher attendance, generate in-token |
| `close_session(session_id, location?, notes?)` | uuid, jsonb?, text? | `sessions` | Close session (first-teacher only), auto-checkout, generate out-token |
| `admin_force_close(session_id)` | uuid | `sessions` | Force-close any session (pengurus only) |

### Attendance

| Function | Parameters | Returns | Purpose |
|----------|-----------|---------|---------|
| `check_in(session_id, token, location)` | uuid, text, jsonb | `check_in_result` | Validate QR token (single-use + expiry), GPS radius, late detection |
| `check_out(session_id, token, location)` | uuid, text, jsonb | `attendances` | Validate out-token, GPS, must have checked in |
| `rotate_qr_token(session_id, direction)` | uuid, `qr_direction` | jsonb | Rotate dynamic QR (first-teacher for `in`, first-teacher/admin for `out`) |
| `get_session_report(session_id)` | uuid | table | Per-session attendance with user details |

### User Data

| Function | Parameters | Returns | Purpose |
|----------|-----------|---------|---------|
| `list_my_attendances()` | — | table | Current user's attendance history |
| `get_all_users()` | — | table | All users (pengurus sees all, pengajar sees active only) |
| `get_profile()` | — | table | Own profile |
| `assign_pengajar_to_tpa(user_id, tpa_id)` | uuid, text | void | Assign TPA (pengurus only) |
| `unassign_pengajar_from_tpa(user_id, tpa_id)` | uuid, text | void | Unassign TPA (pengurus only) |
| `get_pengajar_tpas(user_id)` | uuid | table | Teacher's TPA assignments |
| `toggle_user_active(user_id)` | uuid | boolean | Toggle active status (pengurus only) |
| `delete_pengajar(user_id)` | uuid | void | Cascade-delete teacher (pengurus only) |

### Izin (Leave)

| Function | Parameters | Returns | Purpose |
|----------|-----------|---------|---------|
| `submit_izin(start_date, end_date, alasan)` | date, date, text | `izin_requests` | Submit leave with overlap check |
| `approve_izin(id)` | uuid | `izin_requests` | Approve pending izin (pengurus only) |
| `reject_izin(id)` | uuid | `izin_requests` | Reject pending izin (pengurus only) |
| `get_pending_izins()` | — | table | All pending izins with user names (pengurus only) |
| `get_my_izins()` | — | table | Own izin history with reviewer names |

### Reports

| Function | Parameters | Returns | Purpose |
|----------|-----------|---------|---------|
| `get_teacher_monthly_report(user_id, year, month)` | uuid, int, int | table | Per-day status (`hadir`/`izin`/`tidak_masuk`) from session attendance + approved izin |

### Edge Function

| Endpoint | Actions | Purpose |
|----------|---------|---------|
| `/functions/v1/manage-user` | `create`, `reset-pw` | Service-role: create auth user + profile + TPA assignment in one transaction; generate temp passwords |

---

## 6. Core Attendance & Izin Flow

### Open Session
1. Teacher scans **static QR** at TPA location
2. GPS validates proximity (<100m radius via haversine)
3. `open_session()` creates session, generates dynamic QR check-in token (20s expiry), auto-records first-teacher attendance
4. First teacher navigates to session active page to display the rotating QR

### Check In
1. Other teachers scan the dynamic QR displayed by the first teacher
2. `check_in()` validates: token not expired, token not used before, GPS within radius
3. **Late detection**: scan-in >15 min after `date_opened` → `is_late = true`
4. Attendance recorded with GPS coordinates

### Dynamic QR Rotation
- Check-in token auto-refreshes every 20s (countdown progress bar UI)
- Single-use: each token consumed immediately after scan
- Rotated via `rotate_qr_token()` by first teacher

### Check Out
1. First teacher closes session with optional GPS and close notes
2. `close_session()` generates dynamic out-token, auto-checkouts the first teacher
3. Other teachers scan the out-token to record `scan_out_time` and location
4. `check_out()` validates: must have checked in, token valid, GPS within radius

### Early Exit Detection
- Teachers who checked in but the session closed without their check-out (and are not first teacher) → flagged as early exit

### Leave Requests (Izin)
1. Teacher submits leave via `IzinPage` with date range + reason
2. `submit_izin()` checks for overlapping pending requests
3. Admin reviews from Dashboard Pending Izin section → `approve_izin()` / `reject_izin()`
4. Monthly report (`get_teacher_monthly_report`) combines session attendance + approved izin:

| Status | Meaning |
|--------|---------|
| `hadir` | Attended session on that date |
| `izin` | Approved leave covering that date |
| `tidak_masuk` | No attendance and no approved izin |

### Attendance Streak
- `computeStreak()` counts consecutive teaching days from attendance history
- Displayed as a flame icon on teacher dashboard

### Monthly Summary
- Per-month stats: total sessions, on-time count, late count, on-time percentage
- Computed via `computeMonthlySummary()`

### Inactive Alert
- Admin dashboard highlights teachers with no attendance in >14 days
- Computed via `computeInactiveAlert()`

---

## 7. Teacher Management

| Feature | Description |
|---------|-------------|
| **Add Teacher** | Modal form (name, email, NIM, TPA). Calls `manage-user` edge function → creates Supabase Auth user + profile in one transaction. Password = `{NIM}uam` |
| **Bulk Import CSV** | Upload CSV (`nama,email,nim,tpa_id`). Batch-parallel edge function calls with per-email success/failure reporting |
| **TPA Assignment** | Modal with checkboxes. One TPA per teacher enforced by DB constraint |
| **Toggle Active** | Lock/unlock teacher account. Inactive users are signed out on next attempt |
| **Delete Teacher** | Cascade via `delete_pengajar()` RPC: removes interaction_logs → sessions → attendances → used_tokens → auth user |

### Password Management

| Feature | Description |
|---------|-------------|
| **Change Password** | Profile page: re-authenticate with current password, enter new + confirm |
| **Reset Password** | Admin generates temp password via edge function (`UAM-{nim}-{random4digits}`), copies to clipboard |

---

## 8. Admin Dashboard

| Section | Description |
|---------|-------------|
| **Realtime Stats** | Active sessions, present today, late count, monthly total — updated via Supabase Realtime |
| **7-Day Bar Chart** | Stacked bar (on-time vs late) using Recharts |
| **TPA Status Grid** | Cards per TPA: active/idle status, present count, time since open — clickable to TPA detail |
| **Teacher Recap Table** | Sorted by total attendance. Name, NIM, totals, inactive alert, compliance bar |
| **Pending Izin** | Cards with approve/reject buttons. Empty state always shown |
| **Force-close Session** | From TPA detail page, admin can force-close any active session |

---

## 9. Reports & Export

| Feature | Description |
|---------|-------------|
| **Laporan Page** | Filter by date range, TPA, teacher. Sortable columns |
| **Export CSV** | Native CSV download |
| **Export Excel** | `.xlsx` via `xlsx` library |
| **Export JSON** | Raw JSON download |
| **Teacher Detail** | Per-teacher stats, monthly status breakdown (hadir/izin/tidak_masuk), full attendance list |

---

## 10. Key Components

| Component | File | Function |
|-----------|------|----------|
| `ProtectedRoute` | `app/components/ProtectedRoute.tsx` | Role-based route guard |
| `ErrorBoundary` | `app/components/ErrorBoundary.tsx` | React error boundary with fallback |
| `QRDisplay` | `app/components/qr/QRDisplay.tsx` | Dynamic rotating QR with expiry countdown |
| `QRScanner` | `app/components/qr/QRScanner.tsx` | Camera QR scanner via html5-qrcode |
| `LocationStatus` | `app/components/gps/LocationStatus.tsx` | GPS accuracy indicator |
| `PermissionPrompt` | `app/components/gps/PermissionPrompt.tsx` | Geolocation permission gate |

### Custom Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useDynamicQR` | `app/hooks/useDynamicQR.ts` | Polls/rotates QR token with countdown |
| `useQRScanner` | `app/hooks/useQRScanner.ts` | Camera scanner lifecycle |
| `useRealtimeSessions` | `app/hooks/useRealtimeSessions.ts` | Supabase Realtime subscription for admin dashboard |
| `useWatchLocation` | `app/hooks/useWatchLocation.ts` | Continuous GPS position tracking |

### Stores (Zustand)

| Store | Purpose |
|-------|---------|
| `authStore` | Auth session, profile, role, login/logout |
| `attendanceStore` | Attendance records, check-in/out state |
| `izinStore` | Izin requests, submission, approval state |
| `sessionStore` | Active session data, attendee list |
| `tpaStore` | TPA list and details |
| `userStore` | User profiles cache for name resolution |

---

## 11. Audit Logging

Events recorded via `interaction_logs`:

| Event Type | Trigger |
|------------|---------|
| `session_opened` | Teacher opens session |
| `session_closed` | First teacher closes session |
| `admin_force_close` | Admin force-closes session |
| `scan_in_success` | Successful check-in |
| `scan_in_gps_denied` | GPS check failed at check-in |
| `qr_expired` | Attempted use of expired QR token |
| *(and others)* | |
