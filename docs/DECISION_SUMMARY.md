# UAM Presensi — Decision Summary

**Status:** Living document  
**Updated:** 29 July 2026

## 1. Scope

UAM Presensi supports attendance and HR monitoring for volunteer teachers across 11 TPA partners. The artifact replaces scattered WhatsApp-to-Excel recap work with server-validated attendance records and structured monthly reports.

## 2. Confirmed attendance flow

1. Teacher signs in with an account. Initial password follows `{NIM}uam` and must be changed before attendance operations.
2. First teacher scans the TPA static QR.
3. Browser obtains the teacher's location.
4. First teacher selects at least one expected teacher for the session.
5. Server validates authentication, TPA, active session, expected-teacher list, and geofence.
6. Session opens and first teacher is checked in automatically.
7. First teacher displays a dynamic QR token that expires after 20 seconds.
8. Other teachers scan the dynamic QR. Server validates active session, token, expiry, location, and duplicate attendance.
9. First teacher enters mandatory teaching-material notes and closes the session.
10. Attendance is finalized and appears in monthly reports.

No separate QR checkout is required.

## 3. Security and validation decisions

- Attendance uses dynamic QR and GPS geofencing as two validation factors.
- QR tokens are short-lived and limited to one use per teacher per token.
- Duplicate attendance is blocked by the database constraint on `(session_id, user_id)`.
- Geofence radius is configured per TPA according to mosque or teaching-site area. Current values are 100 or 150 meters.
- GPS verifies device proximity to the registered TPA area. It does not prove presence inside a specific room.
- IMEI or hardware binding is not used because the artifact is a web application.
- Account authentication, mandatory initial-password change, server-side validation, database constraints, RLS, and audit records replace hardware binding.
- UI restrictions are not treated as security boundaries. Sensitive rules must be enforced in Supabase RPC/RLS.

## 4. Expected teachers and attendance target

Target values entered in the Tally questionnaire are not used.

The implemented rule is:

```text
adjusted expected = expected sessions - approved leave
required attendance = ceil(adjusted expected × 75%)
```

Additional rules:

- At least one expected teacher must be selected before a session opens.
- Only approved leave reduces the denominator.
- Attendance must come from server-validated attendance records.
- Whether non-scheduled attendance contributes to the 75% target remains an explicit policy decision. Preferred thesis-safe treatment: report it separately and count only expected sessions toward compliance.

## 5. Tally questionnaire role

The July 2026 CSV contains six unique internal responses collected from 13–17 July 2026. It is used as evidence of requirement elicitation and design revision, not as post-deployment evaluation or a source for attendance-target values.

Implemented requirements include:

- separate absence from holiday/inactive session;
- leave count and status;
- monthly reporting;
- per-TPA grouping;
- summary metrics;
- teacher/status filters;
- visual attendance states;
- Excel/PDF export;
- reporting charts;
- role-controlled corrections.

The questionnaire supports the chain:

```text
stakeholder responses → requirements → design decisions → artifact implementation
```

Post-implementation evaluation remains separate:

```text
artifact → functional and technical tests → SUS → TAM
```

## 6. Thesis decisions

- Methodology: Design Science Research following Peffers et al.
- Evaluation strategy: FEDS, functional tests, technical metrics, SUS, and TAM.
- Architecture documentation: C4 Model and Echelons in Chapter III.
- Chapter II uses a thematic literature survey and a Citation–Method–Result–Limitation–Relevance comparison.
- Research framing concerns the absence of systematically recorded and verified digital time/location evidence. It does not accuse teachers of false attendance.
- GPS wording must state proximity verification, not absolute physical-presence proof.
- The actual flow for Chapter III is:

```text
static TPA QR
→ opener GPS validation
→ expected-teacher selection
→ session creation
→ 20-second dynamic QR
→ server-side check-in validation
→ mandatory teaching-material notes
→ session finalization
→ monthly report
```

## 7. Improvements still required

### P0 — Before evaluation

1. **Hide QR token from general session reads and Realtime.** Only the first teacher may obtain or rotate it through a dedicated RPC.
2. **Harden RPC authorization.** Verify authenticated user, teacher role, active account, password-change status, and TPA assignment for session operations.
3. **Add server-side attendance audit logs.** Record actor, action, session, result/reason, server timestamp, calculated distance, configured radius, and GPS accuracy. Never log raw QR tokens.
4. **Correct auto-finalization provenance.** Do not copy the closing teacher's location into other attendees' checkout locations. Store an explicit `session_auto_close` method.

### P1 — Correctness

5. Preserve browser GPS `accuracy` and validation distance.
6. Confirm the official late threshold. The implementation currently uses 15 minutes; questionnaire responses did not establish consensus.
7. Decide whether non-scheduled attendance counts toward the 75% target.
8. Populate `interaction_logs.user_id` for TAM telemetry. Keep telemetry separate from security audit records.

### P1 — Verification

9. Fix Supabase test environment imports so all test suites run.
10. Add integration tests for active/expired/reused QR, duplicate attendance, geofence boundaries, inactive users, wrong-TPA access, session-closing authority, required notes, approved leave, and absence versus inactive session.
11. Review vulnerable dependencies (`react-router`, `xlsx`, and `dompurify`) without using an uncontrolled forced upgrade.
12. Remove embedded Git credentials and use a credential manager or SSH.

## 8. Current verification snapshot

Last verified locally:

- `npm run typecheck`: passed.
- `npm run build`: passed.
- Unit run: 162 tests passed, but three suites failed during Supabase module import because test environment variables were missing.
- `npm audit --omit=dev`: one moderate and three high-severity findings.

This snapshot is not a permanent project claim. Re-run all checks before reporting completion or deployment readiness.

## 9. Work order

1. Protect QR token.
2. Harden RPC authorization.
3. Add server audit and correct auto-finalization provenance.
4. Preserve GPS accuracy.
5. Resolve non-scheduled attendance and late-threshold policy.
6. Complete integration tests.
7. Create Chapter III C4 diagrams and validation algorithm.
8. Deploy and run evaluation.
