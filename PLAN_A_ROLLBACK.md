# Plan A Rollback & Delivery Summary

## Commit IDs (chronological order)

| Phase | Commit hash | Description |
|-------|------------|-------------|
| A1 (previous) | `bbabf00b` | chore: ignore .temp, .hermes, playwright-report, and temp dirs |
| A2 + Plan A full | `e0a1c76c` | fix: expected-teacher lifecycle, security gates, dependency hardening |

## Rollback procedure

### Option 1: Full rollback to pre-A2 state
```bash
git revert e0a1c76c --no-commit
```
This reverts all 20 modified files, 5 new files, and the 3 migration files.

After revert:
- Remove the 3 new migration .sql files from disk
- Re-deploy Edge Function `manage-user` with the pre-A1 version
- Reset dirty Supabase migrations state

### Option 2: Rollback only A2 (expected-teacher) keeping A1 security
```bash
git revert e0a1c76c --no-edit
```

If migration conflict arises, manually:
- Keep 20260727021100_add_must_change_password.sql
- Keep 20260727023000_change_password_flag.sql
- Drop 2026072703/04/05 migrations from local supabase/migrations dir
```bash
rm supabase/migrations/20260727030000_get_my_expected_sessions.sql
rm supabase/migrations/20260727040000_guard_must_change_password_rpc.sql
rm supabase/migrations/20260727050000_expected_cutover_and_validation.sql
```
Then push:
```bash
npx supabase db push
```

## Staging status
- All 3 A2 migrations pushed, verified with staging integration test (3/3 pass)
- Auth matrix: anonymous 401, invalid JWT 401, pengajar 403, pengurus create/reset OK, reset triggers must_change_password
- Expected lifecycle: denied when flag true, allowed after flag cleared, records correct

## Gate verification (baseline)
| Check | Status |
|-------|--------|
| `npm run typecheck` | exit 0 |
| `npm test -- --run` | 192/192 pass |
| `npm run build` | exit 0 |
| `git diff --check` | clean |
| `npm audit --omit=dev` | No high/critical reachable; xlsx documented as accepted residual |
| `npx playwright test` | BLOCKED — Chromium binary not installed; environment limitation |
| Integration staging lifecycle | 3/3 full pass |

## Accepted risks
1. **CORS \*** in manage-user Edge Function — deferred to Plan C or manual production review
2. **xlsx (<0.20.2)** Prototype Pollution / ReDoS — export-only usage, no user-supplied deserialization, row limit enforced
3. **Playwright E2E** — blocked by missing Chromium binary; API integration and Vitest sufficiency demonstrated
4. **Expected cutover** — pre-cutover sessions show no target metric; only sessions opened after migration have `expected_at_open`
