-- Run ONLY in a disposable local database: psql -v ON_ERROR_STOP=1 -f supabase/tests/attempt_logs.sql
-- Minimal Supabase auth fixture; domain tables/helpers copied from repository migrations.
do $$ begin
 if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
 if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
create schema auth;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create table public.users (id uuid primary key, role text, is_active boolean, must_change_password boolean);
create table public.tpas (id text primary key, location jsonb);
create table public.pengajar_tpa (user_id uuid references users, tpa_id text references tpas);
create table public.sessions (
  id uuid primary key default gen_random_uuid(), tpa_id text references tpas,
  first_teacher_id uuid references users, date_opened timestamptz default now(),
  is_active boolean default true, expected_at_open timestamptz
);
create table public.attendances (
  id uuid primary key default gen_random_uuid(), session_id uuid references sessions,
  user_id uuid references users, scan_in_time timestamptz, scan_in_location jsonb,
  is_late boolean, late_minutes integer, unique(session_id, user_id)
);
create table public.session_qr_tokens (session_id uuid primary key references sessions, token_hash text, expires_at timestamptz, rotated_at timestamptz);
create table public.session_expected_teachers (session_id uuid references sessions, user_id uuid references users);
create table public.used_tokens (session_id uuid references sessions, user_id uuid references users, token text, primary key(user_id, session_id));
create function public.haversine_m(a jsonb, b jsonb) returns double precision language sql immutable as $$
 select 6371000 * 2 * asin(sqrt(
    power(sin(radians(((a->>'lat')::float - (b->>'lat')::float) / 2)), 2) +
    cos(radians((a->>'lat')::float)) * cos(radians((b->>'lat')::float)) *
    power(sin(radians(((a->>'lng')::float - (b->>'lng')::float) / 2)), 2)
  ));
$$;
\ir ../migrations/20260731020000_add_authorization_guard.sql
\ir ../migrations/20260731080001_add_opener_guard.sql
\ir ../migrations/20261029000000_add_attempt_logs.sql

insert into users values
 ('00000000-0000-0000-0000-000000000001', 'pengajar', true, false),
 ('00000000-0000-0000-0000-000000000002', 'pengajar', true, false),
 ('00000000-0000-0000-0000-000000000003', 'pengajar', false, false);
insert into tpas values ('test', '{"lat":0,"lng":0,"radius":100}');
insert into pengajar_tpa select id, 'test' from users;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);

-- Committed rejection remains visible in a subsequent transaction.
begin;
select open_session_with_expected_v2('test','{"lat":1,"lng":1}',array['00000000-0000-0000-0000-000000000002']::uuid[], '10000000-0000-0000-0000-000000000001');
commit;
do $$ begin
 assert (select count(*) = 1 from attempt_logs where outcome = 'OUTSIDE_RADIUS' and not accepted);
 assert (select count(*) = 0 from sessions);
end $$;

-- Force error AFTER session, token, expected rows written. All domain writes roll back.
create function fail_attendance() returns trigger language plpgsql as $$ begin raise exception 'forced test failure'; end $$;
create trigger fail_attendance before insert on attendances for each row execute function fail_attendance();
select open_session_with_expected_v2('test','{"lat":0,"lng":0}',array['00000000-0000-0000-0000-000000000002']::uuid[]);
do $$ begin
 assert (select count(*) = 2 from attempt_logs);
 assert (select count(*) = 0 from sessions);
 assert (select count(*) = 0 from session_qr_tokens);
 assert (select count(*) = 0 from session_expected_teachers);
end $$;
drop trigger fail_attendance on attendances;

-- Successful opening; retry does not write another log or create another session.
select open_session_with_expected_v2('test','{"lat":0,"lng":0}',array['00000000-0000-0000-0000-000000000002']::uuid[], '10000000-0000-0000-0000-000000000003');
select open_session_with_expected_v2('test','{"lat":0,"lng":0}',array['00000000-0000-0000-0000-000000000002']::uuid[], '10000000-0000-0000-0000-000000000003');
do $$ begin
 assert (select count(*) = 3 from attempt_logs);
 assert (select count(*) = 1 from sessions);
 assert (select count(*) = 1 from attendances);
end $$;

-- Set known token; never appears in telemetry. First teacher scan creates no attendance.
update session_qr_tokens set token_hash = encode(extensions.digest('secret', 'sha256'),'hex');
select check_in_v2((select id from sessions), 'secret','{"lat":0,"lng":0}');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select check_in_v2((select id from sessions), 'wrong','{"lat":0,"lng":0}');
select check_in_v2((select id from sessions), null,'{"lat":0,"lng":0}');
select check_in_v2((select id from sessions), 'secret','{}');
select check_in_v2((select id from sessions), 'secret','{"lat":1,"lng":1}');

-- Failed attendance insert rolls back used_tokens too.
create trigger fail_attendance before insert on attendances for each row execute function fail_attendance();
select check_in_v2((select id from sessions), 'secret','{"lat":0,"lng":0}');
do $$ begin assert (select count(*) = 0 from used_tokens); end $$;
drop trigger fail_attendance on attendances;
select check_in_v2((select id from sessions), 'secret','{"lat":0,"lng":0}', '10000000-0000-0000-0000-000000000004');
select check_in_v2((select id from sessions), 'secret','{"lat":0,"lng":0}', '10000000-0000-0000-0000-000000000004');
select check_in_v2((select id from sessions), 'secret','{"lat":0,"lng":0}');
update session_qr_tokens set expires_at = now() - interval '1 second';
select check_in_v2((select id from sessions), 'secret','{"lat":0,"lng":0}');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select check_in_v2((select id from sessions), 'secret','{"lat":0,"lng":0}');
update sessions set is_active = false;
select check_in_v2((select id from sessions), 'secret','{"lat":0,"lng":0}');
select check_in_v2('20000000-0000-0000-0000-000000000000', 'secret','{"lat":0,"lng":0}');
select set_config('request.jwt.claim.sub','',false);
set role anon;
select check_in_v2(null, null, null);
reset role;

-- RLS/privileges: clients cannot forge, read, alter, or delete evidence.
do $$ begin
 assert not has_table_privilege('anon','attempt_logs','SELECT,INSERT,UPDATE,DELETE');
 assert not has_table_privilege('authenticated','attempt_logs','SELECT,INSERT,UPDATE,DELETE');
 assert (select relrowsecurity from pg_class where oid='attempt_logs'::regclass);
 assert (select count(*) = 16 from attempt_logs);
 assert (select count(*) = 3 from attempt_logs where accepted);
 assert (select count(*) = 1 from attempt_logs where outcome = 'FIRST_TEACHER_AUTO');
 assert (select count(*) = 1 from attempt_logs where action = 'check_in' and outcome = 'ACCEPTED');
 assert (select count(*) = 1 from attempt_logs where outcome = 'TOKEN_REUSED');
 assert (select count(*) = 2 from attendances);
 assert (select count(*) = 1 from used_tokens where token = encode(extensions.digest('secret','sha256'),'hex'));
 assert not exists(select 1 from attempt_logs l where row_to_json(l)::text like '%secret%' or row_to_json(l)::text like '%lat%');
end $$;
select action, outcome, accepted, count(*) from attempt_logs group by 1,2,3 order by 1,2;
