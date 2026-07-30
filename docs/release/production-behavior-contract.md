# Production Behavior Contract

**Scope:** UAM Presensi security/correctness remediation  
**Baseline date:** 29 July 2026  
**Purpose:** Preserve current user experience while backend security changes use expand–migrate–contract releases.

## Teacher experience

1. Login, mandatory password change, role routing, and navigation remain unchanged.
2. First-teacher flow remains:

```text
scan static TPA QR
→ allow GPS
→ select at least one expected teacher
→ open session
→ dynamic QR immediately visible
```

3. Dynamic QR lifetime and rotation remain 20 seconds.
4. QR countdown, loading state, dimensions, labels, and interaction flow remain unchanged.
5. Other-teacher flow remains:

```text
scan dynamic QR
→ GPS validation
→ confirmation
→ existing Indonesian success/error feedback
```

6. Session close still requires teaching-material notes.
7. Successful session open feedback remains:

```text
Sesi berhasil dibuka dan presensi Anda telah dicatat
```

8. Successful session close feedback remains:

```text
Sesi berhasil ditutup
```

## Reporting behavior

- Dashboard, monthly report, filters, charts, Excel, and PDF retain current values and layout.
- Required attendance remains:

```text
ceil((expected sessions - approved leave) × 75%)
```

- Only approved leave reduces adjusted expected sessions.
- Tally target values remain unused.
- Late threshold remains 15 minutes.
- Non-scheduled attendance retains current production behavior during remediation.
- Absence and inactive/holiday sessions remain distinct.

## Security changes allowed behind this contract

- Add private hashed QR-token storage.
- Add compatible v2 RPCs.
- Add server-authored accepted-event audit records.
- Add nullable checkout provenance.
- Add optional GPS accuracy evidence.
- Harden RPC authorization after staging assignment verification.

These changes must not add visible steps, extra permission prompts, report-policy changes, or new user-facing features.

## Release gates

A release fails this contract if it changes visible copy, routes, main DOM structure, report fixtures, export rows, QR timing, or happy-path request count without explicit approval.

Required checks:

```bash
npm run typecheck
npm test -- --run
npm test -- --run
npm run build
```

Baseline verification on 29 July 2026:

- TypeScript typecheck: passed.
- Vitest run 1: 27 files passed; 162 tests passed.
- Vitest run 2: 27 files passed; 162 tests passed.
- Production build: passed.

Known non-blocking baseline warnings include React test `act(...)` warnings, Radix ref warnings, Recharts zero-size warnings under JSDOM, and large Vite chunks. They are not part of this remediation unless they become functional failures.

## Production protection

- Production Supabase ref: `aagmvgljdcrjtvhokhgm`.
- Staging Supabase ref: `cyxfbpwqmyijohcgbymp`.
- Production remains read-only until staging parity and all release gates pass.
- No seed, reset, auth-matrix mutation, or experimental migration runs against production.
- Production migration requires explicit approval and a no-active-session window.
