-- Allow any authenticated user to look up other users' names for display
-- in attendance lists (e.g., "Daftar Kehadiran" on SessionActivePage).
-- SECURITY DEFINER bypasses row-level security on public.users.
-- Pengajar only sees active users; pengurus sees all (including inactive).

drop function if exists get_all_users();

create or replace function get_all_users()
returns table (
  id uuid,
  email text,
  name text,
  role text,
  nim text,
  is_active bool
)
language plpgsql
security definer
stable
as $$
begin
  if exists (select 1 from public.users where id = auth.uid() and role = 'pengurus') then
    return query
      select u.id, u.email, u.name, u.role::text, u.nim, u.is_active
      from public.users u
      order by u.name;
  else
    return query
      select u.id, u.email, u.name, u.role::text, u.nim, u.is_active
      from public.users u
      where u.is_active = true
      order by u.name;
  end if;
end;
$$;
