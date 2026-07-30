-- ============================================================================
-- Release F: Authorization hardening — assert_active_teacher_for_tpa
--
-- Every v2 RPC that accepts a scan/check-in must verify:
--   1. Authenticated
--   2. User exists
--   3. Role = 'pengajar'
--   4. Active account (is_active = true)
--   5. Password changed (must_change_password = false)
--   6. Active pengajar_tpa assignment for the session's TPA
--
-- Applied to: check_in_v2, rotate_qr_token_v2
-- Not applied to: open_session_with_expected_v2 (already validates expected
--   teachers + opener is auto-attended; TPA existence checked separately)
-- ============================================================================

-- 1. Reusable guard function
-- ============================================================================

create or replace function public.assert_active_teacher_for_tpa(p_tpa_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
begin
    if v_user is null then
        raise exception 'not authenticated';
    end if;

    if not exists (
        select 1 from public.users
        where id = v_user
          and role = 'pengajar'
          and coalesce(is_active, false) = true
          and coalesce(must_change_password, false) = false
    ) then
        raise exception 'Akun tidak aktif atau belum memenuhi syarat';
    end if;

    if not exists (
        select 1 from public.pengajar_tpa
        where user_id = v_user and tpa_id = p_tpa_id
    ) then
        raise exception 'Anda tidak terdaftar sebagai pengajar di TPA ini';
    end if;
end;
$$;

-- 2. Patch check_in_v2 — add TPA authorization guard
-- ============================================================================

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

    -- Release F: verify caller is active pengajar assigned to this TPA
    perform public.assert_active_teacher_for_tpa(v_session.tpa_id);

    -- Validate token against private table
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

-- 3. Patch rotate_qr_token_v2 — add auth + TPA guard
-- ============================================================================

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
    perform public.assert_password_changed();

    select * into v_session from public.sessions where id = p_session_id for update;
    if not found then raise exception 'Sesi tidak ditemukan'; end if;
    if not v_session.is_active then raise exception 'Sesi sudah ditutup'; end if;
    if v_session.first_teacher_id <> v_user then
        raise exception 'Hanya Pengajar Pertama yang dapat merotasi QR masuk';
    end if;

    -- Release F: verify first teacher is active pengajar assigned to this TPA
    perform public.assert_active_teacher_for_tpa(v_session.tpa_id);

    -- Update private token table
    update public.session_qr_tokens
    set token_hash = extensions.digest(v_token, 'sha256'),
        expires_at = v_expiry,
        rotated_at = now()
    where session_id = p_session_id;

    return jsonb_build_object('token', v_token, 'expiry', v_expiry);
end;
$$;
