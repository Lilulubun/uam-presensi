-- 20260731080001_add_opener_guard.sql
-- CRITICAL: Add active-teacher-for-TPA authorization to open_session_with_expected_v2

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
begin
    if v_user is null then raise exception 'not authenticated'; end if;

    -- Caller must be active pengajar assigned to this TPA
    perform public.assert_active_teacher_for_tpa(p_tpa_id);

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

    insert into public.sessions (tpa_id, first_teacher_id, expected_at_open)
    values (p_tpa_id, v_user, now())
    returning * into v_session;

    insert into public.session_qr_tokens (session_id, token_hash, expires_at)
    values (v_session.id, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_expiry);

    insert into public.session_expected_teachers (session_id, user_id)
    select v_session.id, unnest(p_expected_user_ids);

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
