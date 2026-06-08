-- 0015_get_laporan_presensi.sql
-- Returns attendance report data for a date range and optional TPA filter.
-- One row per teacher per session in their assigned TPA.
-- Accessible to: pengurus only

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
  late_minutes int,
  is_izin bool
)
language plpgsql
security definer
set search_path = public
stable
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
      a.late_minutes,
      (ir.id is not null) as is_izin
    from public.sessions s
    join public.tpas t on t.id = s.tpa_id
    join public.pengajar_tpa pt on pt.tpa_id = s.tpa_id
    join public.users u on u.id = pt.user_id and u.role = 'pengajar'
    left join public.attendances a
      on a.session_id = s.id and a.user_id = u.id
    left join public.izin_requests ir
      on ir.user_id = u.id
      and ir.status = 'approved'
      and s.date_opened::date between ir.start_date and ir.end_date
    where s.date_opened::date between p_dari and p_sampai
      and (p_tpa_ids is null or array_length(p_tpa_ids, 1) is null or s.tpa_id = any(p_tpa_ids))
    order by s.tpa_id, u.name, s.date_opened;
end;
$$;
