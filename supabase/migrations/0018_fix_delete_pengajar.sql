-- 0018_fix_delete_pengajar.sql
-- Fix #1: delete_pengajar was cascading session deletes to ALL attendances
--   of every teacher in those sessions (not just the deleted teacher).
--   Fix: SET first_teacher_id = NULL instead of deleting the session.
-- Fix #2: delete_pengajar had no role guard on the target user.
--   Fix: add WHERE role = 'pengajar' check.

-- =========================================================================
-- 1. Allow first_teacher_id to be NULL and set ON DELETE SET NULL
-- =========================================================================
alter table public.sessions
  alter column first_teacher_id drop not null;

alter table public.sessions
  drop constraint if exists sessions_first_teacher_id_fkey,
  add constraint sessions_first_teacher_id_fkey
    foreign key (first_teacher_id)
    references public.users(id)
    on delete set null;

-- =========================================================================
-- 2. Rewrite delete_pengajar with role guard + safe cleanup
-- =========================================================================
create or replace function public.delete_pengajar(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role public.user_role;
begin
  -- Caller must be pengurus
  if not exists (select 1 from public.users where id = auth.uid() and role = 'pengurus') then
    raise exception 'forbidden';
  end if;

  -- Target must be pengajar
  select role into v_target_role from public.users where id = p_user_id;
  if v_target_role is distinct from 'pengajar'::public.user_role then
    raise exception 'Hanya pengajar yang dapat dihapus';
  end if;

  -- Safe cleanup: nullify first_teacher_id instead of deleting sessions
  -- (preserves other teachers' attendance records via ON DELETE SET NULL)
  update public.sessions set first_teacher_id = null where first_teacher_id = p_user_id;

  -- Remove the teacher's own records
  delete from public.interaction_logs where user_id = p_user_id;
  delete from public.used_tokens where user_id = p_user_id;
  delete from public.attendances where user_id = p_user_id;
  delete from public.pengajar_tpa where user_id = p_user_id;
  delete from public.izin_requests where user_id = p_user_id;

  -- Delete the auth user (cascades to public.users via FK)
  delete from auth.users where id = p_user_id;
end;
$$;
