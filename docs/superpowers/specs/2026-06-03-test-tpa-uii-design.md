# Test TPA "uii" — Design

## Goal

Add a test/dump attendance place named "uii" that behaves like a real TPA (appears in the admin "Setup QR Statis" page, scannable via static QR, obeys GPS radius validation) but is only for testing purposes and will be removed later.

## Data

- **id**: `tpa-uii-test`
- **name**: `uii`
- **location**: `{"lat":-7.687445025761007,"lng":110.41569060716313,"radius":5000}`
- **static_qr_code**: `UII-TEST`

5000m radius covers a ~5 km area centered at the UII campus area, making it easy to test from anywhere nearby.

## Implementation

New Supabase migration `supabase/migrations/0008_test_tpa.sql` that inserts into `public.tpas` with `on conflict (id) do nothing` (same pattern as 0002_tpas.sql).

No frontend changes required — the existing `tpaStore` loads all rows from `public.tpas`, and `PengaturanPage` renders QR codes for all of them.

## Removal

Delete the row:
```sql
delete from public.tpas where id = 'tpa-uii-test';
```
Optionally delete the migration file.
