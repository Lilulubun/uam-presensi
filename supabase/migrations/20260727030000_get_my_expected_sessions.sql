-- get_my_expected_sessions
-- Returns session IDs where current user was an expected teacher
-- within the given month range. Used by DashboardPengajar to compute
-- the 75% target formula.
create or replace function public.get_my_expected_sessions(
    p_year int,
    p_month int
)
returns table (
    session_id uuid,
    tpa_id text,
    date_opened timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
    p_start date := make_date(p_year, p_month, 1);
    p_end date := (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date;
begin
    if v_user is null then raise exception 'not authenticated'; end if;

    return query
    select
        se.session_id,
        s.tpa_id,
        s.date_opened
    from public.session_expected_teachers se
    join public.sessions s on s.id = se.session_id
    where se.user_id = v_user
      and s.date_opened::date between p_start and p_end
    order by s.date_opened;
end;
$$;
