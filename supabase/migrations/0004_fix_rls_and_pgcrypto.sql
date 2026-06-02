-- 0004_fix_rls_and_pgcrypto.sql
-- Reconnect-test discovered two bugs in 0001_init.sql:
--   1) 'gen_random_bytes' requires the pgcrypto extension (not enabled by default in new projects)
--   2) The 'users self-read' and 'att read' policies caused infinite recursion because their
--      sub-select against public.users re-triggered the very policy being evaluated.
--      Fix: use the public.is_pengurus() SECURITY DEFINER helper, which bypasses RLS.

create extension if not exists pgcrypto;

drop policy if exists "users self-read" on public.users;
create policy "users self-read" on public.users for select using (
  id = auth.uid() or public.is_pengurus()
);

drop policy if exists "att read" on public.attendances;
create policy "att read" on public.attendances for select using (
  user_id = auth.uid() or public.is_pengurus()
);
