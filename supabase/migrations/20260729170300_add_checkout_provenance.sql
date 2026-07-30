-- 20260729170300_add_checkout_provenance.sql
-- Additive: checkout_method column to distinguish session_auto_close from manual checkout.
-- Nullable, no table-wide backfill, no report output change.

alter table public.attendances
  add column if not exists checkout_method text;
