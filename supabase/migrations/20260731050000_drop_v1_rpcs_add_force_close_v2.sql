-- 20260731050000_drop_v1_rpcs_add_force_close_v2.sql
-- Drop 4 dead v1 RPCs that read/write columns dropped in Release E
-- + create force_close_session_v2 (pengurus-only, no GPS check, no notes required)

-- ============================================================================
-- 1. Drop dead v1 RPCs — all reference qr_dynamic_* columns (dropped)
-- ============================================================================
drop function if exists public.admin_force_close(uuid);
drop function if exists public.rotate_qr_token(uuid, public.qr_direction);
drop function if exists public.check_in(uuid, text, jsonb);
drop function if exists public.check_out(uuid, text, jsonb);

-- ============================================================================
-- 2. force_close_session_v2 — pengurus-only emergency close
-- Mirrors close_session_v2 auto-checkout + audit, but:
--   - No first-teacher guard (admins override)
--   - No GPS check (admin may not be at TPA)
--   - No notes required (admin wasn't teaching)
-- ============================================================================
create or replace function public.force_close_session_v2(
    p_session_id uuid
)
returns public.sessions
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_user uuid := auth.uid();
    v_session public.sessions;
begin
    if v_user is null then raise exception 'not authenticated'; end if;
    if not public.is_pengurus() then raise exception 'Only administrators can force-close sessions'; end if;

    select * into v_session from public.sessions where id = p_session_id for update;
    if not found then raise exception 'Sesi tidak ditemukan'; end if;
    if not v_session.is_active then raise exception 'Sesi sudah ditutup'; end if;

    -- Close session
    update public.sessions
    set is_active = false,
        date_closed = now(),
        close_notes = '[Admin force-close]'
    where id = p_session_id
    returning * into v_session;

    -- Auto-checkout all attendees
    update public.attendances
    set scan_out_time = v_session.date_closed,
        checkout_method = 'admin_force_close'
    where session_id = p_session_id and scan_out_time is null;

    -- Audit log for admin force close
    insert into public.attendance_audit_logs (
        actor_id, action, session_id,
        accepted, reason_code,
        distance_m, configured_radius_m,
        location_accuracy_m
    ) values (
        v_user, 'admin_force_close', p_session_id,
        true, null,
        null, null, null
    );

    return v_session;
end;
$$;
