-- Guard for must_change_password in operations RPC

-- 1. Helper check function
create or replace function public.assert_password_changed()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_must boolean;
begin
    select must_change_password into v_must from public.users where id = auth.uid();
    if coalesce(v_must, false) then
        raise exception 'Anda wajib mengganti password default terlebih dahulu';
    end if;
end;
$$;

-- 2. Wrap open_session
create or replace function public.open_session(p_tpa_id text, p_location jsonb)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
    v_session public.sessions;
    v_tpa public.tpas;
    v_token text := encode(extensions.gen_random_bytes(16), 'hex');
    v_expiry timestamptz := now() + interval '20 seconds';
begin
    perform public.assert_password_changed();
    if v_user is null then raise exception 'not authenticated'; end if;

    select * into v_tpa from public.tpas where id = p_tpa_id for update;
    if not found then raise exception 'TPA tidak ditemukan'; end if;

    if exists (select 1 from public.sessions where tpa_id = p_tpa_id and is_active) then
        raise exception 'TPA ini sudah memiliki sesi aktif';
    end if;

    if public.haversine_m(p_location, v_tpa.location) > (v_tpa.location->>'radius')::float then
        raise exception 'Anda berada di luar radius TPA';
    end if;

    insert into public.sessions (tpa_id, first_teacher_id, qr_dynamic_in_token, qr_dynamic_in_expiry)
    values (p_tpa_id, v_user, v_token, v_expiry)
    returning * into v_session;

    insert into public.attendances (session_id, user_id, scan_in_time, scan_in_location, is_late, late_minutes)
    values (v_session.id, v_user, now(), p_location, false, 0);

    return v_session;
end;
$$;

-- 3. Wrap open_session_with_expected
create or replace function public.open_session_with_expected(
    p_tpa_id text,
    p_location jsonb,
    p_expected_user_ids uuid[]
)
returns public.sessions
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
    perform public.assert_password_changed();
    if v_user is null then raise exception 'not authenticated'; end if;

    select * into v_tpa from public.tpas where id = p_tpa_id for update;
    if not found then raise exception 'TPA tidak ditemukan'; end if;

    if exists (select 1 from public.sessions where tpa_id = p_tpa_id and is_active) then
        raise exception 'TPA ini sudah memiliki sesi aktif';
    end if;

    if public.haversine_m(p_location, v_tpa.location) > (v_tpa.location->>'radius')::float then
        raise exception 'Anda berada di luar radius TPA';
    end if;

    if array_length(p_expected_user_ids, 1) is null or array_length(p_expected_user_ids, 1) = 0 then
        raise exception 'Minimal satu pengajar wajib dipilih';
    end if;

    if exists (
        select 1
        from unnest(p_expected_user_ids) as selected(user_id)
        left join public.users u on u.id = selected.user_id
        left join public.pengajar_tpa pt on pt.user_id = selected.user_id and pt.tpa_id = p_tpa_id
        where u.id is null or u.role <> 'pengajar' or coalesce(u.is_active, false) = false or pt.user_id is null
    ) then
        raise exception 'Expected teacher tidak aktif atau tidak terdaftar di TPA ini';
    end if;

    if (select count(*) from unnest(p_expected_user_ids)) <>
       (select count(distinct user_id) from unnest(p_expected_user_ids) as ids(user_id)) then
        raise exception 'Expected teacher duplikat';
    end if;

    insert into public.sessions (tpa_id, first_teacher_id, qr_dynamic_in_token, qr_dynamic_in_expiry)
    values (p_tpa_id, v_user, v_token, v_expiry)
    returning * into v_session;

    insert into public.session_expected_teachers (session_id, user_id)
    select v_session.id, unnest(p_expected_user_ids);

    insert into public.attendances (session_id, user_id, scan_in_time, scan_in_location, is_late, late_minutes)
    values (v_session.id, v_user, now(), p_location, false, 0);

    return v_session;
end;
$$;

-- 4. Wrap check_in
create or replace function public.check_in(
  p_session_id uuid, p_token text, p_location jsonb
) returns public.check_in_result 
language plpgsql 
security definer 
set search_path = public 
as $$
declare
  v_user uuid := auth.uid();
  v_session public.sessions;
  v_tpa public.tpas;
  v_att public.attendances;
  v_late boolean;
  v_minutes int;
  v_threshold timestamptz;
  v_result public.check_in_result;
begin
  perform public.assert_password_changed();
  select * into v_session from public.sessions where id = p_session_id;
  if not found then raise exception 'Sesi tidak ditemukan'; end if;
  if not v_session.is_active then raise exception 'Sesi sudah ditutup'; end if;

  if v_session.qr_dynamic_in_token is null
     or v_session.qr_dynamic_in_token <> p_token
     or v_session.qr_dynamic_in_expiry < now() then
    raise exception 'QR code tidak valid atau sudah kadaluarsa';
  end if;

  if v_session.first_teacher_id = v_user then
    select * into v_att from public.attendances
    where session_id = p_session_id and user_id = v_user;
    v_result.attendance := v_att;
    v_result.reason := 'FIRST_TEACHER_AUTO';
    return v_result;
  end if;

  if exists (select 1 from public.used_tokens
             where user_id = v_user and session_id = p_session_id and token = p_token) then
    raise exception 'Token sudah pernah digunakan';
  end if;

  v_threshold := v_session.date_opened + interval '15 minutes';
  v_late := now() > v_threshold;
  v_minutes := case when v_late
                    then extract(epoch from (now() - v_threshold))::int / 60
                    else 0 end;

  select * into v_tpa from public.tpas where id = v_session.tpa_id;
  if public.haversine_m(p_location, v_tpa.location) > (v_tpa.location->>'radius')::float then
    raise exception 'Anda berada di luar radius TPA';
  end if;

  insert into public.used_tokens(user_id, session_id, token)
  values (v_user, p_session_id, p_token);

  insert into public.attendances (session_id, user_id, scan_in_time, scan_in_location, is_late, late_minutes)
  values (p_session_id, v_user, now(), p_location, v_late, v_minutes)
  returning * into v_att;

  v_result.attendance := v_att;
  v_result.reason := null;
  return v_result;
end;
$$;

-- 5. Wrap check_out
create or replace function public.check_out(
  p_session_id uuid, p_token text, p_location jsonb
) returns public.attendances 
language plpgsql 
security definer 
set search_path = public 
as $$
declare
  v_user uuid := auth.uid();
  v_session public.sessions;
  v_tpa public.tpas;
  v_att public.attendances;
begin
  perform public.assert_password_changed();
  select * into v_session from public.sessions where id = p_session_id;
  if not found then raise exception 'Sesi tidak ditemukan'; end if;

  if v_session.qr_dynamic_out_token is null
     or v_session.qr_dynamic_out_token <> p_token
     or v_session.qr_dynamic_out_expiry < now() then
    raise exception 'QR code tidak valid atau sudah kadaluarsa';
  end if;

  if exists (select 1 from public.used_tokens
             where user_id = v_user and session_id = p_session_id and token = p_token) then
    raise exception 'Token sudah pernah digunakan';
  end if;

  select * into v_tpa from public.tpas where id = v_session.tpa_id;
  if public.haversine_m(p_location, v_tpa.location) > (v_tpa.location->>'radius')::float then
    raise exception 'Anda berada di luar radius TPA';
  end if;

  select * into v_att from public.attendances
  where session_id = p_session_id and user_id = v_user;
  if not found then raise exception 'Anda belum melakukan presensi masuk'; end if;
  if v_att.scan_out_time is not null then raise exception 'Anda sudah melakukan presensi keluar'; end if;

  insert into public.used_tokens(user_id, session_id, token)
  values (v_user, p_session_id, p_token);

  update public.attendances
  set scan_out_time = now(), scan_out_location = p_location
  where id = v_att.id
  returning * into v_att;
  return v_att;
end;
$$;
