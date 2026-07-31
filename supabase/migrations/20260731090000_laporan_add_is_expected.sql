-- 20260731090000_laporan_add_is_expected.sql
-- Add is_expected column to get_laporan_presensi return type
-- Required for LaporanPage to track expectedCount per teacher (isAman formula)

drop function if exists public.get_laporan_presensi(date, date, text[]);

create or replace function public.get_laporan_presensi(
    p_dari date,
    p_sampai date,
    p_tpa_ids text[] default null
)
returns table (
    tpa_id text,
    tpa_name text,
    teacher_id uuid,
    teacher_name text,
    tgl date,
    session_is_active bool,
    first_teacher_id uuid,
    scan_in_time timestamptz,
    scan_out_time timestamptz,
    is_late bool,
    late_minutes int,
    is_izin bool,
    is_expected bool
)
language plpgsql
security definer
set search_path = public
volatile
as $$
begin
    set timezone = 'Asia/Jakarta';

    if not exists (
        select 1 from public.users where id = auth.uid() and role = 'pengurus'
    ) then
        raise exception 'forbidden';
    end if;

    return query
    -- Part A: Expected teachers (is_expected = true)
    select
        s.tpa_id, t.name, u.id, u.name,
        s.date_opened::date, s.is_active, s.first_teacher_id,
        a.scan_in_time, a.scan_out_time,
        coalesce(a.is_late, false), a.late_minutes,
        exists (
            select 1 from public.izin_requests ir
            where ir.user_id = u.id and ir.status = 'approved'
            and s.date_opened::date between ir.start_date and ir.end_date
        ) as is_izin,
        true as is_expected
    from public.sessions s
    join public.tpas t on t.id = s.tpa_id
    join public.session_expected_teachers se on se.session_id = s.id
    join public.users u on u.id = se.user_id
    left join public.attendances a on a.session_id = s.id and a.user_id = u.id
    where s.date_opened::date between p_dari and p_sampai
        and (p_tpa_ids is null or array_length(p_tpa_ids, 1) is null or s.tpa_id = any(p_tpa_ids))

    union all

    -- Part B: Non-expected teachers who actually attended (is_expected = false)
    select
        s.tpa_id, t.name, u.id, u.name,
        s.date_opened::date, s.is_active, s.first_teacher_id,
        a.scan_in_time, a.scan_out_time,
        coalesce(a.is_late, false), a.late_minutes,
        exists (
            select 1 from public.izin_requests ir
            where ir.user_id = u.id and ir.status = 'approved'
            and s.date_opened::date between ir.start_date and ir.end_date
        ) as is_izin,
        false as is_expected
    from public.sessions s
    join public.tpas t on t.id = s.tpa_id
    join public.attendances a on a.session_id = s.id
    join public.users u on u.id = a.user_id
    left join public.session_expected_teachers se
        on se.session_id = s.id and se.user_id = a.user_id
    where s.date_opened::date between p_dari and p_sampai
        and (p_tpa_ids is null or array_length(p_tpa_ids, 1) is null or s.tpa_id = any(p_tpa_ids))
        and se.id is null

    order by tpa_id, teacher_name, tgl;
end;
$$;
