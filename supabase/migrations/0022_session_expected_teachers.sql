-- 0022_session_expected_teachers.sql
-- Expected teachers per session — guru pertama memilih siapa yang wajib hadir
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE

-- =========================================================================
-- 1. Table: session_expected_teachers
-- =========================================================================
create table if not exists public.session_expected_teachers (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.sessions(id) on delete cascade,
    user_id uuid not null references public.users(id),
    created_at timestamptz default now(),
    unique(session_id, user_id)
);

create index if not exists idx_expected_session
    on public.session_expected_teachers(session_id);

-- =========================================================================
-- 2. RLS
-- =========================================================================
alter table public.session_expected_teachers enable row level security;

-- SELECT: any authenticated user can read expected teachers list
drop policy if exists "session_expected_teachers select" on public.session_expected_teachers;
create policy "session_expected_teachers select" on public.session_expected_teachers
    for select using (auth.role() = 'authenticated');

-- No direct INSERT/UPDATE/DELETE policies — all writes go through SECURITY DEFINER RPCs

-- =========================================================================
-- 3. RPC: open_session_with_expected
-- Sama persis dengan open_session, tapi menerima daftar expected user IDs.
-- Batch insert ke session_expected_teachers setelah session dibuat.
-- Auto check-in first teacher seperti sebelumnya.
-- =========================================================================
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
    if v_user is null then raise exception 'not authenticated'; end if;

    select * into v_tpa from public.tpas where id = p_tpa_id for update;
    if not found then raise exception 'TPA tidak ditemukan'; end if;

    if exists (select 1 from public.sessions where tpa_id = p_tpa_id and is_active) then
        raise exception 'TPA ini sudah memiliki sesi aktif';
    end if;

    if public.haversine_m(p_location, v_tpa.location) > (v_tpa.location->>'radius')::float then
        raise exception 'Anda berada di luar radius TPA';
    end if;

    -- Ensure array is not empty
    if array_length(p_expected_user_ids, 1) is null or array_length(p_expected_user_ids, 1) = 0 then
        raise exception 'Minimal satu pengajar wajib dipilih';
    end if;

    -- Insert session
    insert into public.sessions (tpa_id, first_teacher_id, qr_dynamic_in_token, qr_dynamic_in_expiry)
    values (p_tpa_id, v_user, v_token, v_expiry)
    returning * into v_session;

    -- Batch insert expected teachers
    insert into public.session_expected_teachers (session_id, user_id)
    select v_session.id, unnest(p_expected_user_ids);

    -- Auto check-in first teacher (same as open_session)
    insert into public.attendances (session_id, user_id, scan_in_time, scan_in_location, is_late, late_minutes)
    values (v_session.id, v_user, now(), p_location, false, 0);

    return v_session;
end;
$$;

-- =========================================================================
-- 4. Update get_laporan_presensi v3
-- Ganti: JOIN pengajar_tpa → JOIN session_expected_teachers
-- Tambah: UNION dengan non-expected attendees (yang scan tapi tidak dijadwalkan)
-- =========================================================================
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
    is_izin bool
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
    -- Part A: Expected teachers (with or without attendance)
    select
        s.tpa_id,
        t.name as tpa_name,
        u.id as teacher_id,
        u.name as teacher_name,
        s.date_opened::date as tgl,
        s.is_active as session_is_active,
        s.first_teacher_id,
        a.scan_in_time,
        a.scan_out_time,
        coalesce(a.is_late, false) as is_late,
        a.late_minutes,
        exists (
            select 1 from public.izin_requests ir
            where ir.user_id = u.id
            and ir.status = 'approved'
            and s.date_opened::date between ir.start_date and ir.end_date
        ) as is_izin
    from public.sessions s
    join public.tpas t on t.id = s.tpa_id
    join public.session_expected_teachers se on se.session_id = s.id
    join public.users u on u.id = se.user_id
    left join public.attendances a
        on a.session_id = s.id and a.user_id = u.id
    where s.date_opened::date between p_dari and p_sampai
        and (p_tpa_ids is null or array_length(p_tpa_ids, 1) is null or s.tpa_id = any(p_tpa_ids))

    union all

    -- Part B: Non-expected teachers who actually attended
    -- (Guru tidak dijadwalkan tapi hadir → tetap muncul di laporan)
    select
        s.tpa_id,
        t.name as tpa_name,
        u.id as teacher_id,
        u.name as teacher_name,
        s.date_opened::date as tgl,
        s.is_active as session_is_active,
        s.first_teacher_id,
        a.scan_in_time,
        a.scan_out_time,
        coalesce(a.is_late, false) as is_late,
        a.late_minutes,
        exists (
            select 1 from public.izin_requests ir
            where ir.user_id = u.id
            and ir.status = 'approved'
            and s.date_opened::date between ir.start_date and ir.end_date
        ) as is_izin
    from public.sessions s
    join public.tpas t on t.id = s.tpa_id
    join public.attendances a on a.session_id = s.id
    join public.users u on u.id = a.user_id
    left join public.session_expected_teachers se
        on se.session_id = s.id and se.user_id = a.user_id
    where s.date_opened::date between p_dari and p_sampai
        and (p_tpa_ids is null or array_length(p_tpa_ids, 1) is null or s.tpa_id = any(p_tpa_ids))
        and se.id is null  -- exclude yang sudah di-cover Part A

    order by tpa_id, teacher_name, tgl;
end;
$$;