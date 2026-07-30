# A2 — Staging-Production Schema Parity Report
# 2026-07-30

## Migration Parity
| Environment | Project Ref | Migrations | Status |
|-------------|-------------|------------|--------|
| Production | aagmvgljdcrjtvhokhgm | 31/31 aligned | ✅ |
| Staging | cyxfbpwqmyijohcgbymp | 31/31 aligned | ✅ |

## Tables
- users (id, email, name, role, nim)
- tpas (id, name, location {lat,lng,radius}, static_qr_code) — 11 TPA, radius 100m
- sessions (id, tpa_id, first_teacher_id, date_opened, date_closed, is_active, qr_dynamic_in_token, qr_dynamic_in_expiry, close_notes, expected_at_open)
- attendances (id, session_id, user_id, scan_in_time, scan_out_time, is_late, late_minutes, scan_in_location, scan_out_location) — UNIQUE(session_id, user_id)
- used_tokens (user_id, session_id, token, used_at) — PK(user_id, session_id, token)
- pengajar_tpa (migration 0022)
- session_expected_teachers (migration 20260727050000)
- interaction_logs (migration 0003)

## RPCs
- open_session (legacy)
- open_session_with_expected (current + assert_password_changed + TPA validation)
- close_session (notes mandatory + auto-checkout)
- admin_force_close (pengurus only)
- check_in (QR expiry + GPS + used_tokens + first-teacher guard)
- check_out (deprecated flow)
- rotate_qr_token (first-teacher only, 'out' deprecated)
- get_session_report, list_my_attendances, get_my_expected_sessions
- Various: get_all_users_rpc, get_pengajar_by_tpa, get_laporan_presensi, izin RPCs

## Extensions & Realtime
- pgcrypto: ✅ enabled
- supabase_realtime: sessions + attendances

## RLS
- tpa read: all authenticated
- session read: all authenticated
- users self-read: self OR is_pengurus()
- att read: self OR is_pengurus()
- Fixed recursion in 0004; pengurus access in 0023-0026

## Verdict
Staging and Production schemas are identical.
Staging is a valid rehearsal environment.
Production remains read-only.
