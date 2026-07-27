# Local quality baseline — 2026-07-27

## Baseline

- TypeScript: 4 errors.
- Unit tests: 27 failures across 4 files; 160/187 passed.
- Production build: passed with 644 kB gzip main-chunk warning.

## Failure classification

### Production regression

- `DashboardPengajar.tsx` read nonexistent `Attendance.isIzin`. Izin belongs to `IzinRequest`, not physical attendance. Local baseline now reads approved overlapping izin records. Full expected-at-open denominator remains deferred to Plan A2 and staging.

### Stale assertion/mock

- `DashboardPengurus.test.tsx`: mocked Zustand hook lacked static `getState`; 19 tests failed before rendering.
- `DashboardPengurus.test.tsx`: duplicate visible metrics made singular text queries ambiguous.
- `LaporanPage.test.tsx`: table headers/cells and multiple metrics legitimately repeated `Izin`/`100%`; removed obsolete `0%` expectation no longer rendered.
- `DashboardPengajar.test.tsx`: canonical text is `Keluar HH:mm`, rendered in two valid locations; old assertion expected `Keluar pukul` and singular match.
- `DetailPengajar.test.tsx`: tests depended on current wall-clock month while fixtures were June 2026; labels changed to `Total Hadir`, `Tepat Waktu`, `Terlambat`, and period-specific empty state.

### Environment/setup

- None after using canonical Vitest command. `--reporter=basic` was an invalid diagnostic invocation, not a project failure.

## Dependency reachability

- No direct source/test/config import from `react-router`; only `react-router-dom` is used. Direct package removal remains deferred to isolated dependency work.
- `xlsx` is export-only in `LaporanPage.tsx`; no `XLSX.read`/`readFile` or user workbook parser path found.

## Fresh verification

- `npm run typecheck`: pass.
- `npm test -- --run --silent`: 26 files, 187 tests passed.
- `npm run build`: pass; main JS 2,155.20 kB / 644.29 kB gzip warning remains.

No migration, Edge Function deployment, production DB mutation, package change, or Playwright E2E performed.
