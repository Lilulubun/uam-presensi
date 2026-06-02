# Session Handoff — PRD Compliance Work (2026-06-02, end of session)

> **Purpose:** Pickup note for the next AI session. Read this first, then `ctx_search` the `prd-compliance-decisions` source for the full plan.

## TL;DR

Mid-way through a 6-phase, ~29-task plan to bring **Sistem Presensi Pengajar (UAM)** to full PRD v1.0 compliance. The migration from localStorage to Supabase (Phase 0–2) is **done and committed**. The first two cleanup tasks of Phase 3 (UX gaps) are next. Codebase is green: **106/106 tests pass, `tsc --noEmit` clean**.

## Project

- **Repo:** `/home/bubunnn/code/Sistem Presensi Pengajar`
- **Stack:** Vite + React 18 + TypeScript + Zustand + Supabase (Auth + Postgres + Realtime) + Vitest
- **PRD:** `src/imports/PRD_UAM_v1.0.docx.md` (v1.0, 1 Juni 2026, Draft)
- **Plan:** `docs/superpowers/plans/2026-06-02-prd-compliance.md` (read this for full task list)
- **Code review:** `REVIEW.md` (42✅ / 7⚠️ / 14❌ across 63 requirements)
- **Worktree:** `.worktrees/prd-compliance` on branch `feat/prd-compliance`
  - All work happens here. Do not touch the main checkout.
- **Session mode:** `implement` (file changes enabled)

## What's done (committed)

### Phase 0 — Env + Supabase client
- `.env.example` updated to use `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` (NOT `ANON_KEY`/`SERVICE_ROLE_KEY`)
- `.env.local` created (gitignored) with real values
- `src/lib/supabase.ts` client factory

### Phase 1 — DB schema, RLS, RPCs, seed
- `supabase/migrations/0001_init.sql` — 6 tables (`users`, `tpas`, `sessions`, `attendances`, `interaction_logs`, plus RLS + 7 RPCs)
- `supabase/migrations/0002_tpas.sql` — 11 TPA seed rows
- `supabase/migrations/0003_interaction_logs.sql`
- `supabase/migrations/0004_fix_rls_and_pgcrypto.sql` — fixes RLS infinite recursion + enables `pgcrypto`
- `supabase/migrations/0005_pgcrypto_search_path.sql` — sets `extensions.gen_random_bytes` + search_path
- `supabase/seed.ts` — env-gated, idempotent seed (4 users, 11 TPAs)
- `supabase/verify.ts` — dev table counts (commit `b98b92f1`)
- `supabase/reconnect-test.ts` — E2E client-perspective test (commit `eee5db3b`)
- User applied all 5 SQL files via SQL editor; **all 6 reconnect tests pass**

### Phase 2 — Client integration
| Task | Commit | Notes |
|------|--------|-------|
| 2.1 authStore | `8a1a9df7` | 5 tests |
| 2.2 sessionStore | `13fa05c1` | 12 tests |
| 2.3 attendanceStore | `231a9478` | 7 tests, first-teacher guard |
| 2.4 tpaStore | `706e5be1` | 5 tests |
| 2.5 useRealtimeSessions + DashboardPengurus wiring | `e9f098a5` | Drops 10s polling, derives teacher rows from attendances |
| 2.6 Cleanup: drop MOCK_TPAS/seed-data/useSeedData | `4ae7f8b5` | 16 files, +90/-264. Adds named exports `getTpaById` / `getTpaByStaticQR` on tpaStore. |

### App wiring
- `src/app/App.tsx` calls `init()` on all 4 stores (auth, tpa, session, attendance)
- `LoginPage` demo creds updated: `budi@uii.ac.id`/`ulilalbab`, `admin@uam.id`/`admindppai`

## Current branch state

```
4ae7f8b5 feat(cleanup): remove MOCK_TPAS / seed-data; routes TPAs through tpaStore
e9f098a5 feat(realtime): useRealtimeSessions hook with cleanup; drop mock tpas from dashboard
706e5be1 feat(tpa): supabase-backed tpa store — fetch all on init (TDD)
231a9478 feat(attendance): rpc-backed store — check_in/out with first-teacher guard (TDD)
b9121298 fix(db): add extensions to rpc search_path for gen_random_bytes
eee5db3b fix(db): enable pgcrypto + fix rls recursion in users/att policies
13fa05c1 feat(session): rpc-backed session store — open/close/refresh, init (TDD)
8a1a9df7 feat(auth): supabase auth — init, login, logout with profile fetch (TDD)
b98b92f1 chore: verify.ts dev script to dump table + auth counts
bd144850 fix(seed): load .env.local explicitly
2583f33c feat(db): supabase schema, rls, 7 rpcs, seed script, tpas, interaction_logs
```

## What's next (Phase 3 — UX gaps)

Read the plan file for the exact specs. Summary:

- **3.1** Riwayat action buttons (small TDD)
- **3.2** Riwayat redirect-after-close
- **3.3** Auto-stop early-exit sessions
- **3.4** First-teacher badge in SessionCard
- **3.5** Detail Pengajar screen (per-teacher detail page; needs `useUsers()` store — `MOCK_USERS` removal TODO is in `src/lib/mock-data.ts`)

After Phase 3:
- **Phase 4** Logic & hygiene (6 tasks; 4.5 split 4.5a migration then 4.5b client)
- **Phase 5** Verification (5 tasks: 5.4 EvaluasiPage marked post-PRD thesis work)

## Hard constraints (don't forget)

1. **TDD for every new feature**: red → green → refactor. Tests in `__tests__` folders next to source.
2. **Early exit excludes first teacher** (PRD §6 formal notation; §5.3 prose is editorial error). Task 4.1 implements.
3. **Konfirmasi Penutupan** = in-place `AlertDialog` on SessionActivePage, NOT a new route.
4. **Server is source of truth** — no localStorage fallback in production paths.
5. **No Supabase CLI** — SQL editor is enough. Migrations in `supabase/migrations/`.
6. **One Phase 2 sub-task per turn with TDD, commit, then check in.**
7. **Cadence from Phase 3 onward**: small TDD, commit, continue. Phase 3 is UI-only, no DB changes.
8. **AGENTS.md rules still apply**: use `context-mode` MCP tools; no curl/wget; no inline HTTP; write artifacts to files; descriptive ctx labels.
9. **Env file convention**: `.env.local` (gitignored) has real values; `.env.example` is committed.
10. **New Supabase key format**: `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` (NOT `ANON_KEY` / `SERVICE_ROLE_KEY`).
11. **Test mocks of `useTPAStore` MUST also export `getTpaById` / `getTpaByStaticQR` as named functions** — see PengaturanPage.test.tsx and TPADetailPage.test.tsx for the pattern. Otherwise components that import those functions directly (not via the hook) get `undefined`.
12. **tpaStore naming**: the hook exposes methods `getTpaById` / `getTpaByStaticQR` (camelCase), AND the file also exports the same names as top-level functions that read `useTPAStore.getState().tpas`. The top-level functions are what non-React code (and many components) import.

## Known gotchas

- **node_modules drift**: this worktree is at `.worktrees/prd-compliance` inside the main checkout. npm has been seen to mutate `node_modules/tsx/` and `node_modules/.package-lock.json` (autoupdate side effect). `git status` after `npm test` will show these as modified — they're noise. **Do not commit node_modules changes.** Use `git add src/` to scope stages, or add a `.gitignore` rule if it becomes a problem.
- **The `useMemo` "null" error** seen during 2.6 was actually `getTpaById is not a function` masked by the `useMemo` line in the stack trace. Cause: `tpaStore.ts` was exporting only the zustand store object (no top-level `getTpaById`), but components imported it as a top-level function. Fixed by adding the top-level exports in commit `4ae7f8b5`. Don't remove them.
- **Phase 1 RLS + pgcrypto was non-obvious** — 2 SQL fix migrations were required (`0004`, `0005`). The current 5-migration set is the working set; do not re-run them on a fresh DB without first applying 0001–0003.

## Verification commands

```bash
# All tests
npm test -- --run

# Typecheck
npx tsc --noEmit

# Reconnect test (against live Supabase)
npx tsx supabase/reconnect-test.ts

# DB state dump
npx tsx supabase/verify.ts
```

## Files to read first when resuming

1. `docs/superpowers/plans/2026-06-02-prd-compliance.md` — the plan
2. `REVIEW.md` — code review with PRD traceability
3. `src/lib/supabase.ts` — Supabase client
4. `src/store/tpaStore.ts` — note the named-function exports pattern
5. `src/app/hooks/useRealtimeSessions.ts` — realtime wiring
6. `supabase/migrations/0001_init.sql` — schema + RPCs (the source of truth for what the stores call)
