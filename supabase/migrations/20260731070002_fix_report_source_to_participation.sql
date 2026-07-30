-- ============================================================================
-- Fix: find sessions from attendances + session_expected_teachers, NOT pengajar_tpa.
-- Previous approach: filtered by pengajar_tpa → empty if teacher not in pengajar_tpa
-- (e.g. production where Nawal has attendances/expected but no pengajar_tpa row).
-- New approach: UNION of session IDs from attendances and session_expected_teachers.
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
    with relevant_sessions as (
      -- sessions where pengajar was marked expected
      select setx.session_id
      from public.session_expected_teachers setx
      where setx.user_id = p_user_id
      union
      -- sessions where pengajar actually scanned in
      select a.session_id
      from public.attendances a
      where a.user_id = p_user_id and a.scan_in_time is not null
    ),
    month_sessions as (
      select s.id, s.tpa_id as ms_tpa_id, s.date_opened::date as tgl
      from public.sessions s
      join relevant_sessions rs on rs.session_id = s.id
      where extract(year from s.date_opened) = p_year
        and extract(month from s.date_opened) = p_month
    )
    select
      ms.tgl,
      ms.ms_tpa_id,
      t.name as tpa_name,
      case
        when exists (
          select 1 from public.attendances a
          where a.session_id = ms.id and a.user_id = p_user_id
            and a.scan_in_time is not null
        ) then 'hadir'
        when exists (
          select 1 from public.izin_requests ir
          where ir.user_id = p_user_id and ir.status = 'approved'
            and ms.tgl between ir.start_date and ir.end_date
        ) then 'izin'
        else 'tidak_masuk'
      end as status,
      exists (
        select 1 from public.session_expected_teachers setx
        where setx.session_id = ms.id and setx.user_id = p_user_id
      ) as is_expected
    from month_sessions ms
    join public.tpas t on t.id = ms.ms_tpa_id
    order by ms.tgl;
end; $$;
