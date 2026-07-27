-- DB-owned expected lifecycle cutover.
alter table public.sessions
  add column if not exists expected_at_open timestamptz;

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
    perform public.assert_password_changed();
    if v_user is null then raise exception 'not authenticated'; end if;
    select * into v_tpa from public.tpas where id = p_tpa_id for update;
    if not found then raise exception 'TPA tidak ditemukan'; end if;
    if exists (select 1 from public.sessions where tpa_id = p_tpa_id and is_active) then
        raise exception 'SESSION_ALREADY_ACTIVE';
    end if;
    if public.haversine_m(p_location, v_tpa.location) > (v_tpa.location->>'radius')::float then
        raise exception 'Anda berada di luar radius TPA';
    end if;
    if array_length(p_expected_user_ids, 1) is null or array_length(p_expected_user_ids, 1) = 0 then
        raise exception 'Minimal satu pengajar wajib dipilih';
    end if;
    if exists (
        select 1 from unnest(p_expected_user_ids) as selected(user_id)
        left join public.users u on u.id = selected.user_id
        left join public.pengajar_tpa pt on pt.user_id = selected.user_id and pt.tpa_id = p_tpa_id
        where u.id is null or u.role <> 'pengajar' or coalesce(u.is_active, false) = false or pt.user_id is null
    ) then
        raise exception 'Expected teacher tidak aktif atau tidak terdaftar di TPA ini';
    end if;
    if (select count(*) from unnest(p_expected_user_ids)) <>
       (select count(distinct user_id) from unnest(p_expected_user_ids) as ids(user_id)) then
        raise exception 'Expected teacher duplikat';
    end if;
    insert into public.sessions (tpa_id, first_teacher_id, qr_dynamic_in_token, qr_dynamic_in_expiry, expected_at_open)
    values (p_tpa_id, v_user, v_token, v_expiry, now())
    returning * into v_session;
    insert into public.session_expected_teachers (session_id, user_id)
    select v_session.id, unnest(p_expected_user_ids);
    insert into public.attendances (session_id, user_id, scan_in_time, scan_in_location, is_late, late_minutes)
    values (v_session.id, v_user, now(), p_location, false, 0);
    return v_session;
end;
$$;

create or replace function public.get_my_expected_sessions(p_year int, p_month int)
returns table (session_id uuid, tpa_id text, date_opened timestamptz)
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  p_start date := make_date(p_year, p_month, 1);
  p_end date := (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  return query
  select se.session_id, s.tpa_id, s.date_opened
  from public.session_expected_teachers se
  join public.sessions s on s.id = se.session_id
  where se.user_id = v_user
    and s.expected_at_open is not null
    and s.date_opened::date between p_start and p_end
  order by s.date_opened;
end;
$$;
