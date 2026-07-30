-- 20260730170000_add_close_session_v2.sql
-- Additive: v2 close_session that sets checkout_method, stops copying closer location,
-- and writes accepted audit rows. Legacy close_session untouched.

create or replace function public.close_session_v2(
    p_session_id uuid,
    p_location jsonb default null,
    p_notes text default null
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
    v_dist double precision;
    v_radius double precision;
begin
    perform public.assert_password_changed();
    if v_user is null then raise exception 'not authenticated'; end if;

    select * into v_session from public.sessions where id = p_session_id for update;
    if not found then raise exception 'Sesi tidak ditemukan'; end if;
    if v_session.first_teacher_id <> v_user then
        raise exception 'Hanya Pengajar Pertama yang dapat menutup sesi';
    end if;
    if not v_session.is_active then raise exception 'Sesi sudah ditutup'; end if;

    if p_notes is null or trim(p_notes) = '' then
        raise exception 'Materi TPA wajib diisi untuk menutup sesi';
    end if;

    -- GPS validation for closer
    v_dist := 0;
    v_radius := 100;
    if p_location is not null then
        select * into v_tpa from public.tpas where id = v_session.tpa_id;
        v_radius := (v_tpa.location->>'radius')::float;
        v_dist := public.haversine_m(p_location, v_tpa.location);
        if v_dist > v_radius then
            raise exception 'Anda berada di luar radius TPA';
        end if;
    end if;

    -- Close session
    update public.sessions
    set is_active = false,
        date_closed = now(),
        close_notes = p_notes
    where id = p_session_id
    returning * into v_session;

    -- Auto-checkout: set scan_out_time but NOT location (provenance fix)
    update public.attendances
    set scan_out_time = v_session.date_closed,
        checkout_method = 'session_auto_close'
    where session_id = p_session_id and scan_out_time is null;

    -- Update closer's own checkout: full evidence
    update public.attendances
    set scan_out_time = v_session.date_closed,
        scan_out_location = p_location,
        checkout_method = 'manual'
    where session_id = p_session_id and user_id = v_user;

    -- Write audit log for session close
    insert into public.attendance_audit_logs (
        actor_id, action, session_id,
        accepted, reason_code,
        distance_m, configured_radius_m,
        location_accuracy_m
    ) values (
        v_user, 'close_session', p_session_id,
        true, null,
        v_dist, v_radius,
        case when p_location is not null then (p_location->>'accuracy')::double precision else null end
    );

    return v_session;
end;
$$;
