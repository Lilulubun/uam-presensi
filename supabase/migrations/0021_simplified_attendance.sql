-- 0021_simplified_attendance.sql
-- 1. Updates close_session to mandate notes and auto-checkout all attendees.
-- 2. Deprecates 'out' QR rotation.

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
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'Sesi tidak ditemukan'; end if;
  if v_session.first_teacher_id <> v_user then
    raise exception 'Hanya Pengajar Pertama yang dapat menutup sesi';
  end if;
  if not v_session.is_active then raise exception 'Sesi sudah ditutup'; end if;

  -- Enforce mandatory notes (Materi TPA)
  if p_notes is null or trim(p_notes) = '' then
    raise exception 'Materi TPA wajib diisi untuk menutup sesi';
  end if;

  if p_location is not null then
    select * into v_tpa from public.tpas where id = v_session.tpa_id;
    if public.haversine_m(p_location, v_tpa.location) > (v_tpa.location->>'radius')::float then
      raise exception 'Anda berada di luar radius TPA';
    end if;
  end if;

  update public.sessions
  set is_active = false,
      date_closed = now(),
      close_notes = p_notes
  where id = p_session_id
  returning * into v_session;

  -- Auto-checkout all attendees who haven't checked out yet
  -- Everyone gets the same scan_out_time (session closure time)
  update public.attendances
  set scan_out_time = v_session.date_closed,
      scan_out_location = coalesce(scan_out_location, p_location)
  where session_id = p_session_id and scan_out_time is null;

  return v_session;
end;
$$;

-- Deprecate 'out' token rotation: ignore requests for 'out'
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
  if p_direction = 'out' then
    return jsonb_build_object('token', null, 'expiry', null);
  end if;

  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'Sesi tidak ditemukan'; end if;
  if not v_session.is_active then raise exception 'Sesi sudah ditutup'; end if;

  if v_session.first_teacher_id <> v_user then
    raise exception 'Hanya Pengajar Pertama yang dapat merotasi QR masuk';
  end if;

  update public.sessions
  set qr_dynamic_in_token = v_token,
      qr_dynamic_in_expiry = v_expiry
  where id = p_session_id;

  return jsonb_build_object('token', v_token, 'expiry', v_expiry);
end;
$$;
