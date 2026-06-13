-- 0020_get_email_by_nim.sql
-- Adds an RPC to resolve a user's email from their NIM.
-- This is required to support NIM-based login since Supabase Auth uses email.
-- Returns all matching emails since multiple accounts may share a NIM.

create or replace function public.get_emails_by_nim(p_nim text)
returns table(email text)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return query select u.email from public.users u where u.nim = p_nim;
end;
$$;

-- Explicitly grant execute to anon so it can be called before login
grant execute on function public.get_emails_by_nim(text) to anon;
grant execute on function public.get_emails_by_nim(text) to authenticated;

-- Drop old single-result function if it exists
drop function if exists public.get_email_by_nim(text);
