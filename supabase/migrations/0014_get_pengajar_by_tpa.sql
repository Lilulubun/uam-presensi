-- 0014_get_pengajar_by_tpa.sql
-- Returns all pengajar assigned to a given TPA.
-- Accessible to:
--   - teachers assigned to the TPA
--   - pengurus (admins)
--   - first teacher of an active session for the TPA
-- Idempotent: CREATE OR REPLACE

create or replace function public.get_pengajar_by_tpa(p_tpa_id text)
returns table (
  user_id uuid,
  name text,
  email text,
  nim text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.pengajar_tpa pt
    where pt.user_id = auth.uid() and pt.tpa_id = p_tpa_id
  ) and not exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'pengurus'
  ) and not exists (
    select 1 from public.sessions s
    where s.tpa_id = p_tpa_id
      and s.first_teacher_id = auth.uid()
      and s.is_active = true
  ) then
    raise exception 'forbidden';
  end if;

  return query
    select u.id, u.name, u.email, u.nim
    from public.pengajar_tpa pt
    join public.users u on u.id = pt.user_id
    where pt.tpa_id = p_tpa_id
    order by u.name;
end;
$$;
