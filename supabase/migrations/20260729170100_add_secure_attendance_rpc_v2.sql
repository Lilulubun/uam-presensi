-- 20260729170100_add_secure_attendance_rpc_v2.sql
-- Additive: v2 opener + rotation that store token digest in private table.
-- Legacy RPCs and legacy token columns are untouched.
-- Old frontend keeps working; v2 is a new parallel contract.

-- 1. Secure v2 opener — returns session + initial QR in one round trip

create or replace function public.open_session_with_expected_v2(
    p_tpa_id text,
    p_location jsonb,
    p_expected_user_ids uuid[]
)
returns jsonb
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
    v_rows integer;
begin
    perform public.assert_password_changed();
    if v_user is null then raise exception 'not authenticated'; end if;

    select * into v_tpa from public.tpas where id = p_tpa_id for update;
    if not found then raise exception 'TPA tidak ditemukan'; end if;

    if exists (select 1 from public.sessions where tpa_id = p_tpa_id and is_active) then
        raise exception 'SESSION_ALREADY_ACTIVE';
    end if;

    if public.haversine_m(p_location, v_tpa.location) > (v_tpa.location->>'radius')::float then
        raise exception 'Anda berada di luar radius TPA';
    end if;

    if array_length(p_expected_user_ids, 1) is null or array_length(p_expected_user_ids, 1) = 0 then
        raise exception 'Minimal satu pengajar wajib dipilih';
    end if;

    if exists (
        select 1 from unnest(p_expected_user_ids) as selected(user_id)
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

    -- Insert session WITHOUT writing to legacy token columns
    insert into public.sessions (tpa_id, first_teacher_id, expected_at_open)
    values (p_tpa_id, v_user, now())
    returning * into v_session;

    -- Store token digest in private table
    insert into public.session_qr_tokens (session_id, token_hash, expires_at)
    values (v_session.id, extensions.digest(v_token, 'sha256'), v_expiry);

    -- Expected teachers
    insert into public.session_expected_teachers (session_id, user_id)
    select v_session.id, unnest(p_expected_user_ids);

    -- Auto-attendance for first teacher
    insert into public.attendances (session_id, user_id, scan_in_time, scan_in_location, is_late, late_minutes)
    values (v_session.id, v_user, now(), p_location, false, 0);

    return jsonb_build_object(
        'session', jsonb_build_object(
            'id', v_session.id,
            'tpa_id', v_session.tpa_id,
            'first_teacher_id', v_session.first_teacher_id,
            'date_opened', v_session.date_opened,
            'is_active', v_session.is_active,
            'expected_at_open', v_session.expected_at_open
        ),
        'qr', jsonb_build_object(
            'token', v_token,
            'expiry', v_expiry
        )
    );
end;
$$;

-- 2. Secure v2 rotation — first-teacher only, updates private table

create or replace function public.rotate_qr_token_v2(p_session_id uuid)
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
    if v_session.first_teacher_id <> v_user then
        raise exception 'Hanya Pengajar Pertama yang dapat merotasi QR masuk';
    end if;

    -- Update private token table
    update public.session_qr_tokens
    set token_hash = extensions.digest(v_token, 'sha256'),
        expires_at = v_expiry,
        rotated_at = now()
    where session_id = p_session_id;

    return jsonb_build_object('token', v_token, 'expiry', v_expiry);
end;
$$;

-- 3. V2 check-in — validates against private token table

create or replace function public.check_in_v2(
    p_session_id uuid,
    p_token text,
    p_location jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_user uuid := auth.uid();
    v_session public.sessions;
    v_tpa public.tpas;
    v_att public.attendances;
    v_token_row public.session_qr_tokens;
    v_late boolean;
    v_minutes int;
    v_threshold timestamptz;
begin
    perform public.assert_password_changed();
    if v_user is null then raise exception 'not authenticated'; end if;

    select * into v_session from public.sessions where id = p_session_id;
    if not found then raise exception 'Sesi tidak ditemukan'; end if;
    if not v_session.is_active then raise exception 'Sesi sudah ditutup'; end if;

    -- Validate token against private table instead of legacy column
    select * into v_token_row from public.session_qr_tokens where session_id = p_session_id;
    if not found or v_token_row.expires_at < now()
       or v_token_row.token_hash <> extensions.digest(p_token, 'sha256') then
        raise exception 'QR code tidak valid atau sudah kadaluarsa';
    end if;

    -- First-teacher guard
    if v_session.first_teacher_id = v_user then
        select * into v_att from public.attendances
        where session_id = p_session_id and user_id = v_user;
        return jsonb_build_object(
            'attendance', row_to_json(v_att)::jsonb,
            'reason', 'FIRST_TEACHER_AUTO'
        );
    end if;

    -- Duplicate token check
    if exists (select 1 from public.used_tokens
               where user_id = v_user and session_id = p_session_id and token = p_token) then
        raise exception 'Token sudah pernah digunakan';
    end if;

    -- Late calculation
    v_threshold := v_session.date_opened + interval '15 minutes';
    v_late := now() > v_threshold;
    v_minutes := case when v_late
                      then extract(epoch from (now() - v_threshold))::int / 60
                      else 0 end;

    -- GPS validation
    select * into v_tpa from public.tpas where id = v_session.tpa_id;
    if public.haversine_m(p_location, v_tpa.location) > (v_tpa.location->>'radius')::float then
        raise exception 'Anda berada di luar radius TPA';
    end if;

    -- Record token use
    insert into public.used_tokens(user_id, session_id, token)
    values (v_user, p_session_id, p_token);

    -- Insert attendance
    insert into public.attendances (session_id, user_id, scan_in_time, scan_in_location, is_late, late_minutes)
    values (p_session_id, v_user, now(), p_location, v_late, v_minutes)
    returning * into v_att;

    return jsonb_build_object(
        'attendance', row_to_json(v_att)::jsonb,
        'reason', null
    );
end;
$$;
