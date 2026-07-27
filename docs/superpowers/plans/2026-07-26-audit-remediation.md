# Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close critical access-control flaw, restore green quality gates, and resolve unaccepted high-severity production dependency risk without changing attendance behavior.

**Architecture:** Fix risk in descending order and stop after production-safe verification. Security fix stays inside existing Supabase Edge Function; no new service or dependency. Correctness fixes preserve current domain model: izin remains separate from `Attendance`. Performance, cleanup, chart refactor, and telemetry move to separate follow-up plans after this baseline is green.

**Tech Stack:** React 18, TypeScript, Vite 6, Zustand, Supabase, Vitest, Playwright.

## Global Constraints

- Izin is not attendance and must not be added to `Attendance` merely to silence TypeScript.
- Required attendance is `Math.ceil(adjustedExpectedSessionCount * 0.75)`.
- `expectedSessionCount` counts only actual opened sessions where the teacher was selected in `session_expected_teachers`.
- `excusedExpectedSessionCount` counts expected sessions whose Jakarta calendar date overlaps an approved izin interval for that teacher.
- `adjustedExpectedSessionCount = expectedSessionCount - excusedExpectedSessionCount`; approved izin cancels that expected obligation but never counts as physical attendance.
- Static TPA schedules are contextual only. A scheduled day with no opened session contributes zero. Opened sessions where the teacher was not expected do not increase that teacher's obligation.
- First teacher/host is not automatically expected. Hosting, attendance, and expected assignment are independent facts.
- Any valid physical attendance, including attendance on a non-expected session, contributes toward the teacher's 75% target without increasing `expectedSessionCount`.
- Every opened session must have at least one expected teacher. The host may be excluded, but an empty expected list is invalid.
- Expected-based targets apply only from a DB-owned cutover timestamp set when expected-at-open ships. Pre-cutover attendance/izin remains visible but has no expected-target status and is never backfilled from static schedules or close-time assignments.
- Initial and admin-reset password is deterministically `${NIM}uam`. This accepted trade-off requires immediate forced password change before any normal app route is accessible.
- `manage-user` may create/reset only `pengajar` accounts. It must reject `pengurus` targets and requested roles; pengurus credentials are self-managed or handled outside this endpoint.
- Supabase authorization must be enforced server-side; client route guards are not security boundaries.
- No new dependency unless existing/native option cannot solve the problem.
- Existing dirty working-tree files must not be overwritten or committed accidentally.
- One focused commit per task.
- Final gate: `npm run typecheck`, `npm test -- --run`, `npx playwright test`, `npm run build`.
- Never run mutating E2E tests against production. Use isolated staging/test Supabase only.
- Preserve existing API/RPC contracts unless a task explicitly tests and migrates every caller.
- Every behavior-changing task requires before-state evidence, focused regression tests, rollback instructions, and a checkpoint before the next task.
- Do not combine security, dependency, performance, or cleanup changes in one commit.
- If any focused or full verification fails, stop at that task, diagnose root cause, and do not continue with later phases.
- “No regression” means all flow checks in the matrix below pass; build success alone is insufficient.

## Required Inputs Before Execution

- Production frontend origin and staging frontend origin for CORS.
- Supabase staging project linked in CLI; no production service-role secret shared in chat or committed.
- Staging-only credentials for one `pengurus` and one `pengajar`, stored in a gitignored test env file.
- Confirmation that E2E may mutate staging data.
- Canonical dashboard izin source. Monthly obligation denominator is finalized: actual opened expected sessions for that teacher.
- Confirmation whether XLSX is export-only or accepts user-uploaded files.
- XLSX usage is confirmed export-only; no user-supplied workbook is parsed.
- Baseline PDF/XLSX samples if exact export parity matters.
- Confirmation before deleting anything under `src/imports/` or removing local `vercel` CLI.

Execution cannot pass the affected-flow checkpoint until these inputs exist. Safe code-only tasks may be prepared, but deployment and mutating E2E remain blocked.

## Regression Flow Matrix

| Flow | Required actor/data | Verification | Must remain true |
|---|---|---|---|
| Login by email | pengurus + pengajar | Vitest + Playwright | Correct dashboard redirect; invalid credentials reveal no sensitive detail |
| Login by NIM | pengajar | Playwright | Existing NIM flow still authenticates and loads assigned TPA |
| Session restoration | both roles | Playwright reload/direct URL | Session survives reload; protected route does not flash wrong role page |
| Protected routes | anonymous, pengajar, pengurus | Playwright role matrix | Anonymous redirects to login; role boundaries hold |
| Create pengajar | pengurus staging account | Edge integration/E2E | Succeeds once; profile and single TPA assignment created |
| Create/reset forbidden | anonymous + pengajar | Edge integration | `401`/`403`; no user or password mutation |
| Reset password | pengurus + dummy target | Edge integration/E2E | Temporary credential works once per expected policy; no internal errors leaked |
| Open session | assigned pengajar in radius | Existing E2E | Host selects expected teachers before dynamic QR activation; session and host attendance created once; host is not forced into expected list |
| Concurrent open | two assigned pengajar | RPC integration + E2E | Exactly one session opens; second caller receives structured active-session result and no attendance |
| Join/check-in | expected pengajar | Existing E2E | QR/GPS/RLS checks hold; no duplicate attendance |
| Check-out/close | valid session | Existing E2E | Attendance/session final state remains consistent |
| Dashboard pengajar | opened sessions + expected-teacher rows + attendance + approved izin | Vitest + browser | Required count is `ceil((expected − excused expected) × 75%)`; all valid attendance may satisfy target; izin is not physical attendance |
| Historical/cutover month | pre- and post-cutover sessions | RPC/unit/browser | Pre-cutover rows remain visible; target uses post-cutover sessions only and displays “Dihitung sejak …” |
| Dashboard pengurus | multi-TPA data | Vitest + browser | Totals/chart/navigation unchanged |
| Laporan | duplicate rows + izin + empty month | Vitest | Deduplication and tally-aligned formula unchanged |
| PDF/XLSX export | baseline report | Focused test + manual comparison | Filename, columns, order, dates, values, plain PDF layout preserved |
| Direct nested route | detail/laporan routes | Playwright | Lazy loading and Vercel rewrite work after refresh |
| Telemetry failure | forced insert failure | Vitest | User operation succeeds; no secret/PII logged |

## Change Safety Protocol

For every task:

1. Record clean baseline for the focused tests and relevant flow.
2. Write or repair regression test before production code.
3. Make smallest root-cause change.
4. Run focused test, then typecheck, then full unit suite.
5. For browser/data flows, run only matching staging E2E.
6. Inspect diff for unrelated changes and secret exposure.
7. Commit one concern with rollback command: `git revert <task-commit>`.
8. Continue only when checkpoint is green.

For database/Edge deployment:

1. Deploy to staging first.
2. Run authorization matrix and admin happy path.
3. Record deployed function version/commit.
4. Production deploy only after staging evidence is green.
5. Keep prior function bundle/version available for immediate rollback.

---

## Phase 1 — Critical security

### Task 1: Lock down `manage-user` Edge Function

**Files:**
- Modify: `supabase/functions/manage-user/index.ts`
- Test: create `supabase/functions/manage-user/auth.test.ts` only if Deno tests are runnable; otherwise add a minimal executable authorization helper test beside function.

**Interfaces:**
- Consume incoming `Authorization: Bearer <access-token>`.
- Produce authenticated caller or `401`; non-pengurus caller gets `403`.

- [ ] Extract pure `authorizePengurus(req)` helper using existing Supabase client pattern: require Bearer token, call `supabase.auth.getUser(token)`, then query `public.users` for matching `id` and `role = 'pengurus'`.
- [ ] Run focused test proving missing token returns `401`, invalid token returns `401`, pengajar returns `403`, pengurus proceeds.
- [ ] Call guard before parsing/dispatching any admin action.
- [ ] Replace wildcard CORS with configured production origin plus local-development allowlist; reject unknown origins.
- [ ] Update `src/lib/manage-user.ts` to obtain current Supabase session and send `session.access_token`; never use anon key as caller identity.
- [ ] Add frontend test for missing/expired session: admin action stops with Indonesian re-login message and sends no request.
- [ ] Validate payload minimally: action enum, normalized email, non-empty name, mandatory unique NIM, bounded `tpaIds`; reject any create/reset request targeting or requesting role `pengurus`.
- [ ] Replace raw Supabase/internal error responses with generic messages; keep safe structured server logs.
- [ ] For create/reset, derive the temporary password server-side as `${nim}uam`; reject targets without a unique NIM. Do not accept arbitrary password input and do not return the derived password in the API response.
- [ ] Add `must_change_password boolean NOT NULL DEFAULT false` to `public.users`, then migration-update all existing `pengajar` rows to `true`; leave existing `pengurus` rows `false`.
- [ ] After `supabase.auth.admin.updateUser()` succeeds, set `must_change_password = true` in the same admin operation flow; report partial failure and restore/redo safely rather than claiming success.
- [ ] Add a forced-change route using `supabase.auth.updateUser({ password })`. Block every normal protected route while the authenticated profile has `must_change_password = true`.
- [ ] Require new password to differ from `${NIM}uam`; clear `must_change_password` only after Auth password update succeeds.
- [ ] After successful change, refresh profile/session state before routing to dashboard. Failure leaves the flag true and user on the change-password page.
- [ ] Audit create/reset/change events with actor and target IDs only; never log plaintext passwords.
- [ ] Keep service-role key server-only; confirm no `SERVICE_ROLE_KEY` appears in frontend files or `VITE_*` variables.
- [ ] Verify function locally or with test helper; document deploy command without `--no-verify-jwt` when gateway verification works. If retaining `--no-verify-jwt`, function guard remains mandatory.
- [ ] Deploy to staging and execute complete create/reset authorization matrix before production.
- [ ] Commit only function/test changes: `fix: require pengurus authorization for user management`.

**Acceptance criteria:**
- Anonymous, malformed-token, and pengajar calls cannot create/reset users.
- Pengurus calls retain create/reset behavior.
- Public responses expose no provider/internal error strings.
- Existing pengurus create/reset UI works using real caller access token.
- Existing pengurus may create/reset pengajar only; attempts to create/reset pengurus return `403` with zero mutation.
- Failed authorization produces zero mutation in `auth.users`, `public.users`, and `pengajar_tpa`.
- A user with `must_change_password = true` cannot reach dashboard, scan, report, profile, or other normal routes.
- `${NIM}uam` stops working immediately after successful forced change.
- The known account-takeover window before first login is explicitly accepted and documented in `SECURITY.md`.

### Checkpoint 1

- [ ] Review Task 1 as security-critical diff.
- [ ] `npm run typecheck` may still show known pre-existing errors, but no new errors.
- [ ] Do not deploy until authorization tests pass.

---

## Phase 2 — Restore correctness gates

### Task 1B: Classify the existing failing-test baseline

**Files:**
- Create: `docs/superpowers/handoff/audit-remediation-test-failures.md`
- Modify production or test files only in later root-cause tasks

- [ ] Run the full unit suite once and record every failing file/test without dumping full DOM output into the report.
- [ ] Re-run each failing file separately and classify each failure as: `production regression`, `stale assertion/mock`, or `environment/setup`.
- [ ] For every stale test, state the current canonical behavior that replaces its old assumption.
- [ ] Do not modify production code merely to satisfy a stale mock or ambiguous selector.
- [ ] Tests may be updated or removed only when they no longer protect accepted behavior; preserve or add a replacement regression assertion for the canonical behavior.
- [ ] Commit the inventory separately or keep it as handoff documentation; no behavior change in this task.

**Acceptance criteria:**
- Every baseline failure has a named root-cause class.
- Later production edits trace to a `production regression`, not test-chasing.
- Deleted/rewritten tests retain coverage of the accepted user-visible rule.

### Task 2: Fix dashboard attendance/izin model mismatch

**Files:**
- Modify: `src/pages/pengajar/DashboardPengajar.tsx:75-94`
- Modify only if needed: `src/store/izinStore.ts`
- Test: `src/pages/pengajar/__tests__/DashboardPengajar.test.tsx`

- [ ] Add failing tests for: 12 expected opened sessions → required 9; 20 expected opened sessions → required 15; expected 8 with approved izin overlapping 2 expected-session dates → adjusted 6 and required 5; izin on non-expected date → no denominator change; pending/rejected izin → no denominator change; multi-day izin removes only overlapping expected sessions; scheduled-but-not-opened day → no count; opened-but-not-expected session → no obligation; non-expected valid attendance still contributes toward target; first teacher not selected as expected remains non-expected; duplicate expected row/session → counted once; zero adjusted expected sessions → `Belum Ada Sesi`.
- [ ] Confirm test fails because dashboard reads nonexistent `Attendance.isIzin`.
- [ ] Use `session_expected_teachers` joined/scoped to actual opened sessions as obligation source. Deduplicate by session ID and filter by teacher plus selected month in Asia/Jakarta.
- [ ] Add one DB-owned `expected_at_open_cutover` timestamp (migration/RPC constant or settings row; no frontend-only source). Filter target calculations to sessions opened at/after it.
- [ ] Read approved izin from the canonical izin source; match by teacher and inclusive Jakarta calendar-date overlap against each expected session. Do not add `isIzin` to `Attendance`.
- [ ] Compute `adjustedExpectedSessionCount = expectedSessionCount - excusedExpectedSessionCount`, then `wajibHadir = Math.ceil(adjustedExpectedSessionCount * 0.75)`. Do not use static schedule, all TPA sessions, monthly izin count, or attendance row count as denominator.
- [ ] Count all valid physical attendance in the selected month toward target, whether expected or not. Deduplicate by session ID. Keep approved izin separate; do not add it to physical attendance.
- [ ] Run focused dashboard tests.
- [ ] Commit: `fix: derive dashboard izin from izin records`.

**Acceptance criteria:**
- `Attendance` remains physical-presence data.
- Dashboard izin count comes from izin records.
- Target uses only actual opened expected sessions, subtracts approved izin overlapping those expected sessions, then applies 75% obligation.
- No opened session means no obligation even when static schedule says teaching day.
- Host/first teacher is expected only when explicitly selected.
- Non-expected physical attendance can satisfy an existing expected-session obligation but never creates new obligation.
- Approved izin cancels only overlapping expected-session obligations and never adds physical attendance.
- Zero adjusted expected sessions returns `Belum Ada Sesi`.
- For periods before cutover, show attendance/izin history but “Target expected belum tersedia untuk periode ini”. For a month crossing cutover, calculate only post-cutover sessions and label “Dihitung sejak [tanggal]”.
- Never backfill old expected obligations from static schedules or close-time expected rows.

### Task 2A: Enforce expected selection before dynamic QR activation

**Files:**
- Modify: `src/pages/pengajar/ScanPage.tsx` or current static-QR/open-session owner
- Modify: `src/store/sessionStore.ts`
- Modify: existing `ExpectedTeacherSelector` owner/component only as needed
- Modify: Supabase `open_session_with_expected` migration/function definition
- Test: existing selector, session store, host-session, and expected-teachers tests

- [ ] Render expected-teacher selection after static QR and GPS validation, before calling the open-session RPC or showing dynamic QR.
- [ ] Default all options unchecked. Disable “Buka sesi” while zero teachers are selected or request is processing.
- [ ] Show final confirmation with host name, selected expected names, and explicit note when host is not selected.
- [ ] Reject an empty `p_expected_user_ids` array inside the RPC, not only in UI.
- [ ] Validate every selected user is active and assigned to the same TPA as the new session.
- [ ] Insert session, host attendance, and expected rows atomically in one RPC transaction. Any failure rolls back all three.
- [ ] Prevent expected rows from being changed by normal pengajar after session creation.
- [ ] Make concurrent opening deterministic with a DB constraint/transaction. Return structured `SESSION_ALREADY_ACTIVE` containing safe session context instead of relying on parsed error text.
- [ ] On `SESSION_ALREADY_ACTIVE`, show who opened the session and when, then offer “Scan QR dinamis” and “Kembali”. Do not automatically create attendance for the second opener.
- [ ] Add tests: zero selection blocked client-side; empty array rejected server-side; host excluded succeeds when another teacher is selected; host-only expected succeeds; cross-TPA/inactive ID rejected; duplicate IDs deduplicated or rejected consistently; double-submit creates one session.
- [ ] Add concurrent test: two open requests produce exactly one active session; loser receives `SESSION_ALREADY_ACTIVE`; loser has no attendance until scanning a valid dynamic QR.
- [ ] Run focused unit/E2E tests, then full Plan A gates.
- [ ] Commit separately: `fix: require expected teachers when opening sessions`.

**Acceptance criteria:**
- Dynamic QR never activates before at least one valid expected teacher is persisted.
- Host is not implicitly added to expected list.
- No partial session exists when expected-row insertion fails.
- Expected assignment reflects the decision at opening time, before attendance outcome is known.
- A concurrent second opener reaches a clear dynamic-QR check-in path without bypassing dynamic QR security.

### Task 3: Repair DashboardPengurus test mocks and TypeScript errors

**Files:**
- Modify: `src/pages/pengurus/__tests__/DashboardPengurus.test.tsx`
- Modify: `src/pages/pengurus/DashboardPengurus.tsx`
- Modify: `src/pages/pengurus/DetailPengajar.tsx`

- [ ] Add `getState` to mocked Zustand hooks, matching production API used by component.
- [ ] Replace test-only `any` where a short existing `User`, `AuthState`, or selector type works.
- [ ] Remove unused `Home`, `idx`, and `formatDateIdShort`; do not refactor unrelated code.
- [ ] Run `npm run typecheck`; expected: zero errors.
- [ ] Run `npm test -- --run src/pages/pengurus/__tests__/DashboardPengurus.test.tsx`; expected: pass.
- [ ] Commit: `test: align dashboard mocks with zustand store`.

### Task 4: Make LaporanPage assertions target semantic regions

**Files:**
- Modify: `src/pages/pengurus/__tests__/LaporanPage.test.tsx`
- Modify production page only if accessible labels/roles are missing: `src/pages/pengurus/LaporanPage.tsx`

- [ ] Replace ambiguous global `getByText('100%')`, `getByText('3')`, and `getByText('0%')` with assertions scoped by table row, teacher name, metric label, or `within()`.
- [ ] Do not weaken tests to `getAllByText(...).length > 0` unless each duplicate is intentionally equivalent.
- [ ] Run focused LaporanPage suite.
- [ ] Run full unit suite; expected: 187/187 or updated total, zero failures.
- [ ] Commit: `test: scope laporan percentage assertions`.

### Checkpoint 2

- [ ] `npm run typecheck` exits 0.
- [ ] `npm test -- --run` exits 0.
- [ ] `npm run build` exits 0.

---

## Phase 3 — Dependency risk

### Task 5: Resolve reachable production dependency advisories

**Files:**
- Modify: `package.json`
- Modify generated: `package-lock.json`
- Test affected flows: routing and XLSX export tests/E2E.

- [ ] Run fresh `npm audit --omit=dev --json` and save concise before-state in commit notes.
- [ ] Search source/config/tests for direct imports from `react-router`. If none exist, remove direct `react-router` dependency and regenerate lockfile; `react-router-dom` remains the app-owned dependency.
- [ ] Re-run audit after dependency removal. Upgrade `react-router-dom` only if its resolved transitive `react-router` remains vulnerable/reachable or a compatible patched release is available.
- [ ] Before any Router upgrade, classify advisory reachability: this app is Vite SPA/`BrowserRouter` without SSR, RSC, framework actions, prerender, or `__manifest`; separately inspect user-controlled destinations in `navigate()` and `<Link to>`.
- [ ] If upgrade remains necessary, read migration/changelog and keep Router change isolated in its own commit.
- [ ] Before upgrade, run and save route matrix baseline: login redirects, protected roles, nested-route refresh, back navigation, wildcard fallback.
- [ ] Run typecheck, unit tests, build, and route-focused Playwright tests.
- [ ] Treat current `xlsx` advisories through reachability analysis first: usage is export-only (`json_to_sheet`/workbook write), with no `XLSX.read` or user-supplied workbook parsing. Search and prove no import/parser path exists.
- [ ] Keep `xlsx` if parser vulnerabilities are unreachable and export output remains bounded/trusted; document accepted residual advisory in `SECURITY.md`. Replace only if a maintained compatible package provides equal export behavior with justified migration cost.
- [ ] Add a bounded export-row limit or explicit confirmation for unusually large reports so trusted data cannot freeze the browser accidentally.
- [ ] Do not replace `xlsx` in the same commit as Router upgrade.
- [ ] Test exports with representative report data, long names, empty report, and large-but-bounded dataset.
- [ ] Re-run `npm audit --omit=dev --json`; document any accepted residual advisory and why code path is unreachable.
- [ ] Commit router and XLSX decisions separately when both require lockfile changes.

**Acceptance criteria:**
- No unreviewed high-severity production advisory.
- Routing and exports still work.
- Lockfile generated by npm, never hand-edited.
- Unreachable Router advisories are documented by unused feature surface and static/internal navigation evidence, not severity dismissal alone.

---

## Deferred Follow-up Plan B — Export bundle performance

**Not part of this implementation. Start only after Plan A is deployed and stable.**

### Cut from current scope: route-level code splitting

Do not lazy-load all routes without representative runtime evidence (Lighthouse/target-device load). Reconsider only if export-library splitting leaves measured initial-load problems.

### Task 6: Lazy-load export libraries only

**Files:**
- Modify: `src/app/App.tsx`
- Test: existing route/component tests; Playwright auth/navigation specs.

- [ ] Record baseline build: main chunk `2,155.07 kB`, gzip `644.37 kB`.
- [ ] Keep routes unchanged.
- [ ] Move `xlsx`, `jspdf`, and `jspdf-autotable` imports into export handlers with native `import()`.
- [ ] Preserve button loading/disabled state and existing PDF/XLSX output.
- [ ] Run focused export tests and production build.
- [ ] Record after build sizes; exporter code must leave initial chunk.
- [ ] Commit: `perf: load report exporters on demand`.

### Task 7: Removed as duplicate

**Files:**
- Modify: `src/pages/pengurus/LaporanPage.tsx`
- Test: `src/pages/pengurus/__tests__/LaporanPage.test.tsx`

- [ ] Move `xlsx`, `jspdf`, and `jspdf-autotable` imports into their export handlers with `await import()`.
- [ ] Preserve loading/disabled button state during import and file generation.
- [ ] Add test proving export handler handles dynamic-import/generation failure without duplicate execution.
- [ ] Build and compare chunk output; export libraries must not remain in initial app chunk.
- [ ] Commit: `perf: load report exporters on demand`.

### Checkpoint 3

- [ ] `npm run build` exits 0.
- [ ] Initial main gzip is below previous `644.37 kB`; target below 300 kB, not a hard blocker if evidence shows heavy route chunks moved out.
- [ ] Login and dashboard route load verified.
- [ ] PDF and XLSX exports verified manually or through focused automated checks.

---

## Deferred Follow-up Plan C — Safe deletion only

**Optional. Not a completion requirement for Plan A.**

### Task 8: Remove proven dead files and config

**Files:**
- Delete if still unreferenced: `src/app/components/ui/demo.tsx`
- Modify: `src/styles/index.css`
- Modify: `src/styles/theme.css`
- Modify: `src/lib/gps-utils.ts`
- Modify: `src/config.ts`
- Modify tests whose sole purpose was deleted dead config.
- Delete untracked/imported assets only after confirming they are not thesis source evidence required outside app runtime.

- [ ] Search references before each deletion.
- [ ] Run baseline full gates before cleanup so cleanup regressions are attributable.
- [ ] Delete dead demo, unused `card-stagger`, duplicate `.page-enter`, unused `isWithinRadius`, and unused production config.
- [ ] Do not delete `src/imports/lat_dan_lng_maps_tpa.pdf` without explicit confirmation; it may be thesis/source evidence despite no runtime import.
- [ ] Remove `dotenv` only after checking scripts (`supabase/seed.ts`, upload/reconnect tools) do not import it.
- [ ] Remove `vercel` only if deployment workflow does not invoke local `vercel` CLI.
- [ ] Run full gates after deletion.
- [ ] Commit: `refactor: remove verified dead code`.

### Task 9: Cut risky cleanup

**Files:**
- Modify: `src/pages/pengurus/DashboardPengurus.tsx`
- Delete or shrink: `src/app/components/ui/line-chart.tsx`
- Test: `src/pages/pengurus/__tests__/DashboardPengurus.test.tsx`

Do not simplify `line-chart.tsx`, `alert-dialog.tsx`, `date-utils.ts`, or QR payload compatibility in this remediation. Reconsider only with a specific defect or measured maintenance cost.

**Acceptance criteria:**
- Cleanup produces no behavior/UI regression.
- Deletion count is measured from git diff, not estimated.
- No speculative shared abstractions are added.

---

## Plan A security requirement — Admin audit only

### Task 10: Audit user-management security events

**Files:**
- Modify: `src/lib/log-event.ts`
- Modify: call sites only where needed for stable outcome/error codes.
- Test: `src/lib/__tests__/log-event.test.ts`

- [ ] Record create/reset/password-change events with actor ID, target ID, outcome, and timestamp.
- [ ] Exclude password, token, email, NIM, GPS, and raw provider error text.
- [ ] Do not add latency metrics, correlation infrastructure, retries, Sentry, or OpenTelemetry.
- [ ] Run focused and full tests.
- [ ] Commit with Task 1 when inseparable, otherwise: `security: audit user management events`.

## Phase 4 — Final verification and delivery

### Task 11: Final quality and security gate

- [ ] Run `npm run typecheck`; expected exit 0.
- [ ] Run `npm test -- --run`; expected zero failures.
- [ ] Run `npx playwright test`; expected zero failures or document environment-only blockers with exact failing specs.
- [ ] Run `npm run build`; expected exit 0 and capture chunk sizes.
- [ ] Run `npm audit --omit=dev`; expected no unexplained high/critical production vulnerability.
- [ ] Review `git diff --check` and `git status --short`; ensure pre-existing unrelated files remain untouched.
- [ ] Run final `code-review-and-quality` and `ponytail-review` on remediation diff.
- [ ] Execute every row in Regression Flow Matrix that has available staging data; attach pass/fail evidence.
- [ ] Verify production deployment smoke flows without destructive actions: login, role redirect, nested-route refresh, dashboard load, report load.
- [ ] Prepare per-phase rollback list with exact commit IDs and Edge Function rollback version before production release.
- [ ] Update `SECURITY.md` with Edge Function authorization model and deployment requirement.
- [ ] Produce final report: finding → fix → test evidence → remaining accepted risk.

## Explicitly deferred

- Browser `dogfood` full-site audit: needs deployed/local URL plus test accounts for both roles.
- Core Web Vitals/RUM: needs representative production traffic.
- Full observability stack: not justified for current thesis app scale.
- Broad `any` cleanup in tests: only replace types touched by this remediation; separate task if still valuable.
- `alert-dialog.tsx` and `date-utils.ts` mass shrink: defer unless usage analysis proves safe; lower leverage than security/tests/bundle.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---:|---|
| Locking Edge Function breaks admin UI | High | Test pengurus create/reset path before deployment; staged deploy |
| Dirty working tree mixes unrelated changes | High | Path-scoped commits; inspect `git diff --cached` every commit |
| Router upgrade changes behavior | Medium | Upgrade pair together; route unit/E2E checks |
| XLSX advisory lacks patched npm release | High | Remove untrusted import path, bound data, document accepted export-only risk or replace library |
| Lazy routes expose loading/race bugs | Medium | Preserve sequential auth init; navigation E2E |
| Cleanup removes thesis evidence | Medium | Never delete non-runtime PDF/source assets without explicit confirmation |

## Execution order

Plan A: `1 security → 2–4 green gates → 5 dependencies → 11 final gate`

Follow-up B: `6–7 bundle`, only after Plan A stabilizes.

Follow-up C: `8–10 cleanup/telemetry`, optional and never blocks Plan A completion.

Do not start cleanup while critical security or baseline tests remain broken.

## Release Strategy

Use separate releases, not one large deployment:

1. **Plan A Release 1 — Security:** Task 1 only. Staging authorization matrix, then production deploy and admin smoke test.
2. **Plan A Release 2 — Correctness:** Tasks 2–4. Requires green typecheck/unit/E2E affected flows.
3. **Plan A Release 3 — Dependencies:** Task 5, with Router and XLSX changes isolated when both are needed.
4. **Follow-up Plan B — Performance:** Tasks 6–7. Separate approval and release.
5. **Follow-up Plan C — Cleanup/telemetry:** Tasks 8–10. Optional, separate approval and release.

Any release failure rolls back only that release. Later releases remain blocked until root cause is fixed and full checkpoint returns green.
