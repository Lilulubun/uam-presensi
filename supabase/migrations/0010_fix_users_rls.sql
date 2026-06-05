-- 0010_fix_users_rls.sql
-- Fixes infinite recursion in users RLS policy and implements role-based visibility.

-- 1. Create helper function to check if user is pengajar (bypasses RLS)
create or replace function public.is_pengajar() returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'pengajar');
$$;

-- 2. Update users RLS policy to use helper functions and avoid recursion
drop policy if exists "users self-read" on public.users;

create policy "users self-read" on public.users
  for select using (
    -- Users can always see their own profile
    id = auth.uid()
    -- Pengurus can see all profiles
    or public.is_pengurus()
    -- Pengajar can see other active pengajars
    or (
      public.is_pengajar() 
      and is_active = true 
      and role = 'pengajar' 
      and id <> auth.uid()
    )
  );
