-- Rejections must RETURN normally: raising after logging would roll back the log.
-- No raw tokens, coordinates, exception details, or response bodies in telemetry.
create table public.attempt_logs (
    request_id uuid not null,
    actor_id uuid,
    action text not null check (action in ('open_session', 'check_in')),
    accepted boolean not null,
    outcome text not null,
    session_id uuid,
    tpa_id text,
    attendance_id uuid,
    recorded_at timestamptz not null default clock_timestamp()
);
-- No FKs: invalid targets and later deletions must not erase evidence.
create unique index attempt_logs_request on public.attempt_logs
    (coalesce(actor_id, '00000000-0000-0000-0000-000000000000'::uuid), action, request_id);
alter table public.attempt_logs enable row level security;
revoke all on public.attempt_logs from public, anon, authenticated;

-- Replace signatures, not overloads: default request IDs keep old callers logged.
drop function public.open_session_with_expected_v2(text, jsonb, uuid[]);
drop function public.check_in_v2(uuid, text, jsonb);

create or replace function public.open_session_with_expected_v2(
    p_tpa_id text,
    p_location jsonb,
    p_expected_user_ids uuid[],
    p_request_id uuid default gen_random_uuid()
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
    v_request uuid := coalesce(p_request_id, gen_random_uuid());
    v_result jsonb;
    v_code text := 'INTERNAL_ERROR';
    v_message text;
    v_accepted boolean := false;
begin
    -- Serialize retries before domain writes; no credentials cached in logs.
    perform pg_advisory_xact_lock(hashtextextended(
        coalesce(v_user::text, 'anonymous') || ':' || 'open_session' || ':' || v_request::text, 0));
    if exists (select 1 from public.attempt_logs
               where actor_id is not distinct from v_user
                 and action = 'open_session' and request_id = v_request) then
        return jsonb_build_object('accepted', false, 'code', 'REQUEST_ALREADY_PROCESSED',
            'message', 'Permintaan sudah diproses. Muat ulang data sesi.', 'request_id', v_request);
    end if;
    begin
    if v_user is null then v_code := 'UNAUTHENTICATED'; raise exception 'Silakan masuk terlebih dahulu'; end if;

    -- Caller must be active pengajar assigned to this TPA
    v_code := 'NOT_ELIGIBLE';
    perform public.assert_active_teacher_for_tpa(p_tpa_id);
    v_code := 'INTERNAL_ERROR';

    select * into v_tpa from public.tpas where id = p_tpa_id for update;
    if not found then v_code := 'TPA_NOT_FOUND'; raise exception 'TPA tidak ditemukan'; end if;

    if exists (select 1 from public.sessions where tpa_id = p_tpa_id and is_active) then
        v_code := 'SESSION_ALREADY_ACTIVE'; raise exception 'Sesi masih aktif';
    end if;

    if p_location is null or jsonb_typeof(p_location->'lat') is distinct from 'number'
       or jsonb_typeof(p_location->'lng') is distinct from 'number'
       or (p_location->>'lat')::double precision not between -90 and 90
       or (p_location->>'lng')::double precision not between -180 and 180 then
        v_code := 'LOCATION_INVALID'; raise exception 'Lokasi tidak valid';
    end if;

    if public.haversine_m(p_location, v_tpa.location) > (v_tpa.location->>'radius')::float then
        v_code := 'OUTSIDE_RADIUS'; raise exception 'Anda berada di luar radius TPA';
    end if;

    if array_length(p_expected_user_ids, 1) is null or array_length(p_expected_user_ids, 1) = 0 then
        v_code := 'EXPECTED_REQUIRED'; raise exception 'Minimal satu pengajar wajib dipilih';
    end if;

    if exists (
        select 1 from unnest(p_expected_user_ids) as selected(user_id)
        left join public.users u on u.id = selected.user_id
        left join public.pengajar_tpa pt on pt.user_id = selected.user_id and pt.tpa_id = p_tpa_id
        where u.id is null or u.role <> 'pengajar' or coalesce(u.is_active, false) = false or pt.user_id is null
    ) then
        v_code := 'EXPECTED_INVALID'; raise exception 'Expected teacher tidak aktif atau tidak terdaftar di TPA ini';
    end if;

    if (select count(*) from unnest(p_expected_user_ids)) <>
       (select count(distinct user_id) from unnest(p_expected_user_ids) as ids(user_id)) then
        v_code := 'EXPECTED_DUPLICATE'; raise exception 'Expected teacher duplikat';
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

    v_result := jsonb_build_object(
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
    v_accepted := true;
    v_code := case when v_result->>'reason' = 'FIRST_TEACHER_AUTO'
                   then 'FIRST_TEACHER_AUTO' else 'ACCEPTED' end;
    exception when others then
        -- Inner subtransaction rolls back sessions, tokens, and attendance only.
        v_message := case when sqlstate = 'P0001' and v_code <> 'INTERNAL_ERROR' then sqlerrm
                          else 'Gagal memproses permintaan' end;
        if sqlstate <> 'P0001' then v_code := 'INTERNAL_ERROR'; end if;
        v_result := null;
    end;

    -- Outside exception subtransaction. A logging failure fails the whole RPC.
    insert into public.attempt_logs
        (request_id, actor_id, action, accepted, outcome, session_id, tpa_id, attendance_id)
    values (v_request, v_user, 'open_session', v_accepted, v_code,
            case when v_accepted then v_session.id end, p_tpa_id,
            null);
    return jsonb_build_object('accepted', v_accepted, 'code', v_code,
        'message', v_message, 'request_id', v_request, 'data', v_result);
end;
$$;

create or replace function public.check_in_v2(
    p_session_id uuid,
    p_token text,
    p_location jsonb,
    p_request_id uuid default gen_random_uuid()
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
    v_request uuid := coalesce(p_request_id, gen_random_uuid());
    v_result jsonb;
    v_code text := 'INTERNAL_ERROR';
    v_message text;
    v_accepted boolean := false;
begin
    -- Serialize retries before domain writes; no credentials cached in logs.
    perform pg_advisory_xact_lock(hashtextextended(
        coalesce(v_user::text, 'anonymous') || ':' || 'check_in' || ':' || v_request::text, 0));
    if exists (select 1 from public.attempt_logs
               where actor_id is not distinct from v_user
                 and action = 'check_in' and request_id = v_request) then
        return jsonb_build_object('accepted', false, 'code', 'REQUEST_ALREADY_PROCESSED',
            'message', 'Permintaan sudah diproses. Muat ulang data sesi.', 'request_id', v_request);
    end if;
    begin
    if v_user is null then v_code := 'UNAUTHENTICATED'; raise exception 'Silakan masuk terlebih dahulu'; end if;

    select * into v_session from public.sessions where id = p_session_id for update;
    if not found then v_code := 'SESSION_NOT_FOUND'; raise exception 'Sesi tidak ditemukan'; end if;
    if not v_session.is_active then v_code := 'SESSION_CLOSED'; raise exception 'Sesi sudah ditutup'; end if;

    v_code := 'NOT_ELIGIBLE';
    perform public.assert_active_teacher_for_tpa(v_session.tpa_id);
    v_code := 'INTERNAL_ERROR';

    select * into v_token_row from public.session_qr_tokens where session_id = p_session_id;
    if p_token is null or not found or v_token_row.expires_at <= now()
       or v_token_row.token_hash <> encode(extensions.digest(p_token, 'sha256'), 'hex') then
        v_code := 'QR_INVALID_OR_EXPIRED'; raise exception 'QR code tidak valid atau sudah kadaluarsa';
    end if;

    select * into v_tpa from public.tpas where id = v_session.tpa_id;
    if p_location is null or jsonb_typeof(p_location->'lat') is distinct from 'number'
       or jsonb_typeof(p_location->'lng') is distinct from 'number'
       or (p_location->>'lat')::double precision not between -90 and 90
       or (p_location->>'lng')::double precision not between -180 and 180 then
        v_code := 'LOCATION_INVALID'; raise exception 'Lokasi tidak valid';
    end if;

    if public.haversine_m(p_location, v_tpa.location) > (v_tpa.location->>'radius')::float then
        v_code := 'OUTSIDE_RADIUS'; raise exception 'Anda berada di luar radius TPA';
    end if;

    if v_session.first_teacher_id = v_user then
        select * into v_att from public.attendances
        where session_id = p_session_id and user_id = v_user;
        v_result := jsonb_build_object(
            'attendance', row_to_json(v_att)::jsonb,
            'reason', 'FIRST_TEACHER_AUTO'
        );
    else

    if exists (select 1 from public.used_tokens
               where user_id = v_user and session_id = p_session_id ) then
        v_code := 'TOKEN_REUSED'; raise exception 'Token sudah pernah digunakan';
    end if;

    if exists (select 1 from public.attendances
               where session_id = p_session_id and user_id = v_user) then
        v_code := 'ALREADY_CHECKED_IN'; raise exception 'Presensi masuk sudah tercatat';
    end if;

    v_threshold := v_session.date_opened + interval '15 minutes';
    v_late := now() > v_threshold;
    v_minutes := case when v_late
                      then extract(epoch from (now() - v_threshold))::int / 60
                      else 0 end;

    insert into public.used_tokens(user_id, session_id, token)
    values (v_user, p_session_id, encode(extensions.digest(p_token, 'sha256'), 'hex'));

    insert into public.attendances (session_id, user_id, scan_in_time, scan_in_location, is_late, late_minutes)
    values (p_session_id, v_user, now(), p_location, v_late, v_minutes)
    returning * into v_att;

    v_result := jsonb_build_object(
        'attendance', row_to_json(v_att)::jsonb,
        'reason', null
    );
    end if;
    v_accepted := true;
    v_code := case when v_result->>'reason' = 'FIRST_TEACHER_AUTO'
                   then 'FIRST_TEACHER_AUTO' else 'ACCEPTED' end;
    exception when others then
        -- Inner subtransaction rolls back sessions, tokens, and attendance only.
        v_message := case when sqlstate = 'P0001' and v_code <> 'INTERNAL_ERROR' then sqlerrm
                          else 'Gagal memproses permintaan' end;
        if sqlstate <> 'P0001' then v_code := 'INTERNAL_ERROR'; end if;
        v_result := null;
    end;

    -- Outside exception subtransaction. A logging failure fails the whole RPC.
    insert into public.attempt_logs
        (request_id, actor_id, action, accepted, outcome, session_id, tpa_id, attendance_id)
    values (v_request, v_user, 'check_in', v_accepted, v_code,
            p_session_id, v_session.tpa_id,
            case when v_accepted then (v_result->'attendance'->>'id')::uuid end);
    return jsonb_build_object('accepted', v_accepted, 'code', v_code,
        'message', v_message, 'request_id', v_request, 'data', v_result);
end;
$$;

revoke all on function public.open_session_with_expected_v2(text, jsonb, uuid[], uuid) from public;
revoke all on function public.check_in_v2(uuid, text, jsonb, uuid) from public;
-- Anonymous requests reaching the RPC are logged as UNAUTHENTICATED, never accepted.
grant execute on function public.open_session_with_expected_v2(text, jsonb, uuid[], uuid) to anon, authenticated;
grant execute on function public.check_in_v2(uuid, text, jsonb, uuid) to anon, authenticated;
