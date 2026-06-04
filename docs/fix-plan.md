# Fix Plan — Post-Review Issues

## Task 1: Use watched GPS location on scan (ScanPage.tsx)

**Problem:** `ScanPage.tsx` subscribes to `useWatchLocation` (continuous tracking) but calls `getCurrentLocation()` (one-shot) when scanning. GPS permission is requested twice.

**Files:**
- `src/pages/pengajar/ScanPage.tsx`

**Changes:**
- Remove `getCurrentLocation` import
- In `handleScan`, read `locationState.coords` instead of calling `getCurrentLocation()`
- If `locationState` is stale/loading, fall back to `getCurrentLocation()`
- Update `useCallback` deps to include `locationState`

---

## Task 2: Verify edge function exists or fix create-user flow (manage-user.ts)

**Problem:** `src/lib/manage-user.ts` calls `SUPABASE_URL/functions/v1/manage-user` — an edge function not in this repo. If it doesn't exist, the "Kelola Pengajar" create-user feature is broken.

**Files:**
- `src/lib/manage-user.ts`
- Verify with user whether the edge function is deployed externally

**Changes:**
- Either: confirm the edge function exists at the deployed URL (no code change needed)
- Or: replace with direct `supabase.auth.admin` calls (requires service key — can't run from client, needs a backend)
- Or: remove the create-user UI if it's non-functional

---

## Task 3: Consolidate date-parsing patterns (toDate vs date-utils)

**Problem:** `src/lib/toDate.ts` duplicating `src/lib/date-utils.ts` — both parse strings to Date, used inconsistently across compute utils.

**Files:**
- `src/lib/toDate.ts`
- `src/lib/date-utils.ts`
- `src/lib/computeStreak.ts`
- `src/lib/computeMonthlySummary.ts`
- `src/lib/computeInactiveAlert.ts`

**Changes:**
- Add `toDate` export to `date-utils.ts`
- Update `computeStreak.ts`, `computeMonthlySummary.ts`, `computeInactiveAlert.ts` to import `toDate` from `date-utils.ts`
- Delete `toDate.ts`

---

## Task 0 (done): Pre-existing issues from first review round

| # | Fix | Status |
|---|-----|--------|
| 0a | Restore GPS + TPA check in `open_session` RPC (0005 migration) | ✅ Done |
| 0b | Merge conflicting 0006 migrations (auto-checkout + close_notes) | ✅ Done |
| 0c | Exclude `.worktrees` from vitest | ✅ Done |
| 0d | Error logging in store `init()` methods | ✅ Done |
| 0e | Debounce guard in `useDynamicQR` | ✅ Done |
