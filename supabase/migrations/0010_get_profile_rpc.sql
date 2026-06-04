-- RPC to fetch a user's own profile, bypassing PostgREST schema cache issues.
-- SECURITY DEFINER with RLS bypass — caller can only fetch their own row.

create or replace function public.get_profile()
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
  return query
    select u.id, u.email, u.name, u.role::text, u.nim, u.is_active
    from public.users u
    where u.id = auth.uid();
end;
$$;
