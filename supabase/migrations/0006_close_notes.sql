-- 0006_close_notes.sql
-- Merges auto-checkout (from 0006_auto_checkout_on_close) with close_notes.
-- Adds optional close_notes + p_location auto-checkout + GPS validation.
-- Idempotent: ALTER TABLE ... IF NOT EXISTS, CREATE OR REPLACE.

alter table public.sessions add column if not exists close_notes text;

-- Drop old single-param overload from 0001_init / 0005 so PostgREST
-- can resolve calls with only p_session_id against this 3-param version.
drop function if exists public.close_session(p_session_id uuid);

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
  v_tpa public.tpas;
  v_token text := encode(extensions.gen_random_bytes(16), 'hex');
  v_expiry timestamptz := now() + interval '20 seconds';
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'Sesi tidak ditemukan'; end if;
  if v_session.first_teacher_id <> v_user then
    raise exception 'Hanya Pengajar Pertama yang dapat menutup sesi';
  end if;
  if not v_session.is_active then raise exception 'Sesi sudah ditutup'; end if;

  if p_location is not null then
    select * into v_tpa from public.tpas where id = v_session.tpa_id;
    if public.haversine_m(p_location, v_tpa.location) > (v_tpa.location->>'radius')::float then
      raise exception 'Anda berada di luar radius TPA';
    end if;
  end if;

  update public.sessions
  set is_active = false,
      date_closed = now(),
      qr_dynamic_out_token = v_token,
      qr_dynamic_out_expiry = v_expiry,
      close_notes = coalesce(p_notes, close_notes)
  where id = p_session_id
  returning * into v_session;

  if p_location is not null then
    update public.attendances
    set scan_out_time = now(), scan_out_location = p_location
    where session_id = p_session_id and user_id = v_user;
  end if;

  return v_session;
end;
$$;
