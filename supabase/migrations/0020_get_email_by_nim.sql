-- 0020_get_email_by_nim.sql
-- Adds an RPC to resolve a user's email from their NIM.
-- This is required to support NIM-based login since Supabase Auth uses email.

create or replace function public.get_email_by_nim(p_nim text)
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return (select email from public.users where nim = p_nim limit 1);
end;
$$;

-- Explicitly grant execute to anon so it can be called before login
grant execute on function public.get_email_by_nim(text) to anon;
grant execute on function public.get_email_by_nim(text) to authenticated;
