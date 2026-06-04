-- 0006_close_notes.sql
-- Adds optional close_notes field to sessions and updates close_session RPC.
-- Idempotent: ALTER TABLE ... IF NOT EXISTS, CREATE OR REPLACE.

alter table public.sessions add column if not exists close_notes text;

create or replace function public.close_session(
  p_session_id uuid,
  p_location jsonb default null,
  p_notes text default null
) returns public.sessions
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_session public.sessions;
  v_token text := encode(extensions.gen_random_bytes(16), 'hex');
  v_expiry timestamptz := now() + interval '20 seconds';
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'Sesi tidak ditemukan'; end if;
  if v_session.first_teacher_id <> v_user then
    raise exception 'Hanya Pengajar Pertama yang dapat menutup sesi';
  end if;
  if not v_session.is_active then raise exception 'Sesi sudah ditutup'; end if;

  update public.sessions
  set is_active = false,
      date_closed = now(),
      qr_dynamic_out_token = v_token,
      qr_dynamic_out_expiry = v_expiry,
      close_notes = coalesce(p_notes, close_notes)
  where id = p_session_id
  returning * into v_session;
  return v_session;
end;
$$;
