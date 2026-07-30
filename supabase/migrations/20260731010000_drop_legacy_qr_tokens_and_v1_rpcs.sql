-- ============================================================================
-- Release E: Contract cleanup — phase 2
--
-- Drops legacy dynamic QR token columns and v1 RPCs no longer used since
-- the frontend switched to v2 (VITE_FINAL_GATES_RELEASE_C=true in production).
--
-- Phase 1 already dropped `check_out` (20260731000000).
-- ============================================================================

-- 1. Drop v1 RPCs — all callers use *_v2 variants now.
-- ============================================================================

drop function if exists public.check_in(uuid, text, jsonb);
drop function if exists public.close_session(uuid, jsonb, text);
drop function if exists public.open_session(uuid, jsonb);
drop function if exists public.open_session_with_expected(uuid, jsonb, uuid[]);
drop function if exists public.rotate_qr_token(uuid, text);

-- 2. Drop legacy plaintext QR token columns from sessions.
--    No writes to these columns since VITE_FINAL_GATES_RELEASE_C=true.
-- ============================================================================

alter table public.sessions
  drop column if exists qr_dynamic_in_token,
  drop column if exists qr_dynamic_out_token,
  drop column if exists qr_dynamic_in_expiry,
  drop column if exists qr_dynamic_out_expiry;
