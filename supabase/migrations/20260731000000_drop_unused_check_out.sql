-- ============================================================================
-- Release E: Contract cleanup — phase 1 (safe drops only)
--
-- Drops RPCs and code paths confirmed unused by the current frontend.
-- Column drops (qr_dynamic_*) deferred until v2 deployed to production
-- and VITE_FINAL_GATES_RELEASE_C=true confirmed stable.
-- ============================================================================

-- 1. check_out RPC — not called by any frontend path.
--    ScanPage only handles 'in' tokens; no scan-out flow exists.
--    used_tokens table stays (check_in v1/v2 still inserts into it).
-- ============================================================================

drop function if exists check_out(uuid, text, jsonb);

-- 2. rotate_qr_token (v1) — still called by sessionStore.refreshQRToken()
--    when feature flag is off. Deferred until v2 deployed to production.
--
-- 3. close_session (v1) — still called by SessionActivePage when flag is off.
--    Deferred until v2 deployed to production.
--
-- 4. open_session_with_expected (v1) — still called by ScanPage when flag off.
--    Deferred until v2 deployed to production.
--
-- 5. qr_dynamic_in_token, qr_dynamic_out_token,
--    qr_dynamic_in_expiry, qr_dynamic_out_expiry columns —
--    still written by v1 RPCs. Deferred until v2 deployed to production.
-- ============================================================================
