-- 0009_user_management.sql
-- Adds is_active column, pengajar_tpa junction table, and management RPCs.
-- Idempotent: uses IF NOT EXISTS and CREATE OR REPLACE.

-- =========================================================================
-- 1. is_active column on public.users
-- =========================================================================
alter table public.users add column if not exists is_active boolean not null default true;

-- Update existing RLS: pengajar hanya lihat user aktif (selain diri sendiri & pengurus)
drop policy if exists "users self-read" on public.users;
create policy "users self-read" on public.users
  for select using (
    id = auth.uid()
    or is_active = true
    or exists (
      select 1 from public.users u where u.id = auth.uid() and u.role = 'pengurus'
    )
  );

-- =========================================================================
-- 2. pengajar_tpa junction table
-- =========================================================================
create table if not exists public.pengajar_tpa (
  user_id uuid not null references public.users(id) on delete cascade,
  tpa_id text not null references public.tpas(id) on delete cascade,
  primary key (user_id, tpa_id)
);

alter table public.pengajar_tpa enable row level security;

-- Read: own + pengurus
drop policy if exists "pengajar_tpa read" on public.pengajar_tpa;
create policy "pengajar_tpa read" on public.pengajar_tpa
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.users u where u.id = auth.uid() and u.role = 'pengurus'
    )
  );

-- =========================================================================
-- 3. Management RPCs (all SECURITY DEFINER, pengurus only)
-- =========================================================================

-- Assign a teacher to a TPA
create or replace function public.assign_pengajar_to_tpa(p_user_id uuid, p_tpa_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.users where id = auth.uid() and role = 'pengurus') then
    raise exception 'forbidden';
  end if;
  insert into public.pengajar_tpa (user_id, tpa_id) values (p_user_id, p_tpa_id)
  on conflict (user_id, tpa_id) do nothing;
end;
$$;

-- Unassign a teacher from a TPA
create or replace function public.unassign_pengajar_from_tpa(p_user_id uuid, p_tpa_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.users where id = auth.uid() and role = 'pengurus') then
    raise exception 'forbidden';
  end if;
  delete from public.pengajar_tpa where user_id = p_user_id and tpa_id = p_tpa_id;
end;
$$;

-- Get all TPAs assigned to a teacher
create or replace function public.get_pengajar_tpas(p_user_id uuid)
returns table (tpa_id text, tpa_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() <> p_user_id
     and not exists (select 1 from public.users where id = auth.uid() and role = 'pengurus') then
    raise exception 'forbidden';
  end if;
  return query
    select pt.tpa_id, t.name as tpa_name
    from public.pengajar_tpa pt
    join public.tpas t on t.id = pt.tpa_id
    where pt.user_id = p_user_id;
end;
$$;

-- Toggle is_active for a user (pengurus only)
create or replace function public.toggle_user_active(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current boolean;
begin
  if not exists (select 1 from public.users where id = auth.uid() and role = 'pengurus') then
    raise exception 'forbidden';
  end if;
  select is_active into v_current from public.users where id = p_user_id;
  if not found then raise exception 'Pengguna tidak ditemukan'; end if;
  update public.users set is_active = not v_current where id = p_user_id;
  return not v_current;
end;
$$;
