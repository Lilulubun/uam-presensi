-- 0012_delete_pengajar.sql
-- Safe delete RPC that handles all foreign key relationships.

create or replace function public.delete_pengajar(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.users where id = auth.uid() and role = 'pengurus') then
    raise exception 'forbidden';
  end if;

  delete from public.used_tokens where user_id = p_user_id;
  delete from public.attendances where user_id = p_user_id;
  delete from public.interaction_logs where user_id = p_user_id;
  update public.sessions set first_teacher_id = null where first_teacher_id = p_user_id;

  delete from auth.users where id = p_user_id;
end;
$$;
