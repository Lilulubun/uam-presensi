-- 0013_izin_requests.sql
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE

-- =========================================================================
-- 1. Izin status enum
-- =========================================================================
do $$ begin
  if not exists (select 1 from pg_type where typname = 'izin_status') then
    create type public.izin_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

-- =========================================================================
-- 2. Izin requests table
-- =========================================================================
create table if not exists public.izin_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  alasan text not null,
  status public.izin_status not null default 'pending',
  reviewed_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint izin_dates_check check (end_date >= start_date)
);

create index if not exists idx_izin_requests_user_date
  on public.izin_requests (user_id, start_date, end_date);

-- =========================================================================
-- 3. Enforce one TPA per teacher
-- =========================================================================
create unique index if not exists idx_pengajar_tpa_one_per_user
  on public.pengajar_tpa (user_id);

-- =========================================================================
-- 4. RLS
-- =========================================================================
alter table public.izin_requests enable row level security;

drop policy if exists "izin_requests select" on public.izin_requests;
create policy "izin_requests select" on public.izin_requests
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.users where id = auth.uid() and role = 'pengurus')
  );

drop policy if exists "izin_requests insert" on public.izin_requests;
create policy "izin_requests insert" on public.izin_requests
  for insert with check (user_id = auth.uid());

-- =========================================================================
-- 5. RPC: submit_izin
-- =========================================================================
create or replace function public.submit_izin(p_start_date date, p_end_date date, p_alasan text)
returns public.izin_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.izin_requests;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_end_date < p_start_date then raise exception 'Tanggal akhir harus setelah atau sama dengan tanggal awal'; end if;

  if exists (
    select 1 from public.izin_requests
    where user_id = v_user
      and status = 'pending'
      and (p_start_date, p_end_date) overlaps (start_date, end_date)
  ) then
    raise exception 'Sudah ada pengajuan izin pending untuk rentang tanggal tersebut';
  end if;

  insert into public.izin_requests (user_id, start_date, end_date, alasan)
  values (v_user, p_start_date, p_end_date, p_alasan)
  returning * into v_row;

  return v_row;
end; $$;

-- =========================================================================
-- 6. RPC: approve_izin (pengurus only)
-- =========================================================================
create or replace function public.approve_izin(p_izin_id uuid)
returns public.izin_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.izin_requests;
begin
  if not exists (select 1 from public.users where id = v_user and role = 'pengurus') then
    raise exception 'forbidden';
  end if;

  update public.izin_requests
  set status = 'approved', reviewed_by = v_user, reviewed_at = now()
  where id = p_izin_id and status = 'pending'
  returning * into v_row;

  if not found then raise exception 'Izin tidak ditemukan atau sudah diproses'; end if;
  return v_row;
end; $$;

-- =========================================================================
-- 7. RPC: reject_izin (pengurus only)
-- =========================================================================
create or replace function public.reject_izin(p_izin_id uuid)
returns public.izin_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.izin_requests;
begin
  if not exists (select 1 from public.users where id = v_user and role = 'pengurus') then
    raise exception 'forbidden';
  end if;

  update public.izin_requests
  set status = 'rejected', reviewed_by = v_user, reviewed_at = now()
  where id = p_izin_id and status = 'pending'
  returning * into v_row;

  if not found then raise exception 'Izin tidak ditemukan atau sudah diproses'; end if;
  return v_row;
end; $$;

-- =========================================================================
-- 8. RPC: get_pending_izins (pengurus only)
-- =========================================================================
create or replace function public.get_pending_izins()
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  start_date date,
  end_date date,
  alasan text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'pengurus') then
    raise exception 'forbidden';
  end if;

  return query
    select
      r.id, r.user_id, u.name,
      r.start_date, r.end_date, r.alasan, r.created_at
    from public.izin_requests r
    join public.users u on u.id = r.user_id
    where r.status = 'pending'
    order by r.created_at desc;
end; $$;

-- =========================================================================
-- 9. RPC: get_my_izins
-- =========================================================================
create or replace function public.get_my_izins()
returns table (
  id uuid,
  start_date date,
  end_date date,
  alasan text,
  status text,
  reviewed_by_name text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    r.id, r.start_date, r.end_date, r.alasan,
    r.status::text,
    ru.name as reviewed_by_name,
    r.created_at, r.reviewed_at
  from public.izin_requests r
  left join public.users ru on ru.id = r.reviewed_by
  where r.user_id = auth.uid()
  order by r.created_at desc;
$$;

-- =========================================================================
-- 10. RPC: get_teacher_monthly_report
-- Returns per-day attendance status for a teacher in a given month.
--   - hadir: has scan_in for that day's session
--   - izin: approved izin covers that date
--   - tidak_masuk: session exists but no scan_in and no approved izin
-- =========================================================================
create or replace function public.get_teacher_monthly_report(
  p_user_id uuid,
  p_year int,
  p_month int
)
returns table (
  tgl date,
  tpa_id text,
  tpa_name text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() <> p_user_id
     and not exists (select 1 from public.users where id = auth.uid() and role = 'pengurus') then
    raise exception 'forbidden';
  end if;

  return query
    with teacher_tpa as (
      select tpa_id from public.pengajar_tpa where user_id = p_user_id
    ),
    month_sessions as (
      select s.id, s.tpa_id, s.date_opened::date as tgl
      from public.sessions s
      join teacher_tpa tt on tt.tpa_id = s.tpa_id
      where extract(year from s.date_opened) = p_year
        and extract(month from s.date_opened) = p_month
    ),
    scanned as (
      select ms.tgl
      from month_sessions ms
      join public.attendances a on a.session_id = ms.id and a.user_id = p_user_id
      where a.scan_in_time is not null
    ),
    excused as (
      select ms.tgl
      from month_sessions ms
      join public.izin_requests ir on ir.user_id = p_user_id
        and ir.status = 'approved'
        and ms.tgl between ir.start_date and ir.end_date
    )
    select
      ms.tgl,
      ms.tpa_id,
      t.name as tpa_name,
      case
        when s.tgl is not null then 'hadir'
        when e.tgl is not null then 'izin'
        else 'tidak_masuk'
      end as status
    from month_sessions ms
    left join scanned s on s.tgl = ms.tgl
    left join excused e on e.tgl = ms.tgl
    join public.tpas t on t.id = ms.tpa_id
    order by ms.tgl;
end; $$;

-- =========================================================================
-- 11. Realtime publication for izin_requests (pengurus dashboard)
-- =========================================================================
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'izin_requests'
  ) then
    alter publication supabase_realtime add table public.izin_requests;
  end if;
end $$;
