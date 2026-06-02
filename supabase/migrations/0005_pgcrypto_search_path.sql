-- 0005_pgcrypto_search_path.sql
-- reconnect-test (after 0004) showed: 'function gen_random_bytes(integer) does not exist'
-- Cause: Supabase installs pgcrypto into the 'extensions' schema, not 'public'.
-- The 4 RPCs that call gen_random_bytes (open_session, close_session,
-- admin_force_close, rotate_qr_token) have set search_path = public, so the function
-- is not found.
-- Fix: include 'extensions' in the search_path of those 4 functions.
-- Idempotent: CREATE OR REPLACE.

create or replace function public.open_session(p_tpa_id text, p_location jsonb)
returns public.sessions
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
  if v_user is null then raise exception 'not authenticated'; end if;

  if exists (select 1 from public.sessions where tpa_id = p_tpa_id and is_active) then
    raise exception 'TPA ini sudah memiliki sesi aktif';
  end if;

  insert into public.sessions (tpa_id, first_teacher_id, qr_dynamic_in_token, qr_dynamic_in_expiry)
  values (p_tpa_id, v_user, v_token, v_expiry)
  returning * into v_session;

  insert into public.attendances (session_id, user_id, scan_in_time, scan_in_location, is_late, late_minutes)
  values (v_session.id, v_user, now(), p_location, false, 0);

  return v_session;
end;
$$;

create or replace function public.close_session(p_session_id uuid)
returns public.sessions
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
      qr_dynamic_out_expiry = v_expiry
  where id = p_session_id
  returning * into v_session;
  return v_session;
end;
$$;

create or replace function public.admin_force_close(p_session_id uuid)
returns public.sessions
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_session public.sessions;
begin
  if not public.is_pengurus() then raise exception 'forbidden'; end if;

  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'Sesi tidak ditemukan'; end if;
  if not v_session.is_active then raise exception 'Sesi sudah ditutup'; end if;

  update public.sessions
  set is_active = false, date_closed = now(),
      qr_dynamic_out_token = encode(extensions.gen_random_bytes(16), 'hex'),
      qr_dynamic_out_expiry = now() + interval '20 seconds'
  where id = p_session_id
  returning * into v_session;
  return v_session;
end;
$$;

create or replace function public.rotate_qr_token(p_session_id uuid, p_direction public.qr_direction)
returns jsonb
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
  if not v_session.is_active then raise exception 'Sesi sudah ditutup'; end if;

  if p_direction = 'in' and v_session.first_teacher_id <> v_user then
    raise exception 'Hanya Pengajar Pertama yang dapat merotasi QR masuk';
  end if;
  if p_direction = 'out' and v_session.first_teacher_id <> v_user and not public.is_pengurus() then
    raise exception 'Tidak diizinkan merotasi QR keluar';
  end if;

  if p_direction = 'in' then
    update public.sessions
    set qr_dynamic_in_token = v_token, qr_dynamic_in_expiry = v_expiry
    where id = p_session_id;
  else
    update public.sessions
    set qr_dynamic_out_token = v_token, qr_dynamic_out_expiry = v_expiry
    where id = p_session_id;
  end if;

  return jsonb_build_object('token', v_token, 'expiry', v_expiry);
end;
$$;
