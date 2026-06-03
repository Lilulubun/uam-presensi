-- Allow any authenticated user to look up other users' names for display
-- in attendance lists (e.g., "Daftar Kehadiran" on SessionActivePage).
-- SECURITY DEFINER bypasses row-level security on public.users.

create or replace function get_all_users()
returns table (
  id uuid,
  email text,
  name text,
  role text,
  nim text
)
language sql
security definer
stable
as $$
  select id, email, name, role, nim
  from public.users
  order by name;
$$;
