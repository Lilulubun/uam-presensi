-- ============================================================================
-- Add is_expected boolean to get_teacher_monthly_report.
-- Enables correct wajibHadir calculation: ceil(totalExpected * 0.75).
-- ============================================================================

drop function if exists public.get_teacher_monthly_report(uuid, int, int);

create or replace function public.get_teacher_monthly_report(
  p_user_id uuid,
  p_year int,
  p_month int
)
returns table (
  tgl date,
  tpa_id text,
  tpa_name text,
  status text,
  is_expected boolean
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
      select pt.tpa_id from public.pengajar_tpa pt where pt.user_id = p_user_id
    ),
    month_sessions as (
      select s.id, s.tpa_id as ms_tpa_id, s.date_opened::date as tgl
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
    ),
    expected as (
      select ms.tgl
      from month_sessions ms
      join public.session_expected_teachers setx on setx.session_id = ms.id
        and setx.user_id = p_user_id
    )
    select
      ms.tgl,
      ms.ms_tpa_id,
      t.name as tpa_name,
      case
        when sc.tgl is not null then 'hadir'
        when ex.tgl is not null then 'izin'
        else 'tidak_masuk'
      end as status,
      exp.tgl is not null as is_expected
    from month_sessions ms
    left join scanned sc on sc.tgl = ms.tgl
    left join excused ex on ex.tgl = ms.tgl
    left join expected exp on exp.tgl = ms.tgl
    join public.tpas t on t.id = ms.ms_tpa_id
    order by ms.tgl;
end; $$;
