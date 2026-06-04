-- Fix ambiguous column reference in get_all_users
-- Output parameter names conflicted with table column names

drop function if exists get_all_users();

create or replace function get_all_users()
returns table (
  user_id uuid,
  user_email text,
  user_name text,
  user_role text,
  user_nim text,
  user_is_active bool
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
