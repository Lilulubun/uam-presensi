-- 0017_fix_laporan_is_late.sql
-- Fix: return a.is_late from get_laporan_presensi so the client uses the
-- server-computed flag instead of a broken `late_minutes > 15` heuristic.
-- Also fix submit_izin overlap check to include approved izin (#2).

-- =========================================================================
-- 1. Fix get_laporan_presensi — add is_late column
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
    join public.pengajar_tpa pt on pt.tpa_id = s.tpa_id
    join public.users u on u.id = pt.user_id and u.role = 'pengajar'
    left join public.attendances a
      on a.session_id = s.id and a.user_id = u.id
    where s.date_opened::date between p_dari and p_sampai
      and (p_tpa_ids is null or array_length(p_tpa_ids, 1) is null or s.tpa_id = any(p_tpa_ids))
    order by s.tpa_id, u.name, s.date_opened;
end;
$$;

-- =========================================================================
-- 2. Fix submit_izin — check overlap against pending AND approved
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
      and status in ('pending', 'approved')
      and (p_start_date, p_end_date) overlaps (start_date, end_date)
  ) then
    raise exception 'Sudah ada pengajuan izin untuk rentang tanggal tersebut';
  end if;

  insert into public.izin_requests (user_id, start_date, end_date, alasan)
  values (v_user, p_start_date, p_end_date, p_alasan)
  returning * into v_row;

  return v_row;
end; $$;
