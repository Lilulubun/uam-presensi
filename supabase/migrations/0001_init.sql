-- 0001_init.sql — schema, RLS, helpers, 7 RPCs (PRD v1.0 compliance)
-- Apply via Supabase SQL editor. Idempotent: uses `if not exists` and `or replace` where possible.

-- =========================================================================
-- Schema (Task 1.1)
-- =========================================================================
do $$ begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('pengajar','pengurus');
  end if;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role public.user_role not null,
  nim text
);

create table if not exists public.tpas (
  id text primary key,
  name text not null,
  location jsonb not null,
  static_qr_code text not null unique
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  tpa_id text not null references public.tpas(id),
  first_teacher_id uuid not null references public.users(id),
  date_opened timestamptz not null default now(),
  date_closed timestamptz,
  is_active boolean not null default true,
  qr_dynamic_in_token text,
  qr_dynamic_in_expiry timestamptz,
  qr_dynamic_out_token text,
  qr_dynamic_out_expiry timestamptz
);
create index if not exists sessions_tpa_active_idx on public.sessions (tpa_id) where is_active;
create index if not exists sessions_date_opened_idx on public.sessions (date_opened desc);

create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.users(id),
  scan_in_time timestamptz,
  scan_out_time timestamptz,
  is_late boolean not null default false,
  late_minutes int not null default 0,
  scan_in_location jsonb,
  scan_out_location jsonb,
  unique (session_id, user_id)
);

create table if not exists public.used_tokens (
  user_id uuid not null references public.users(id),
  session_id uuid not null references public.sessions(id) on delete cascade,
  token text not null,
  used_at timestamptz not null default now(),
  primary key (user_id, session_id, token)
);

-- =========================================================================
-- RLS (Task 1.2) — all writes go through SECURITY DEFINER RPCs
-- =========================================================================
alter table public.users enable row level security;
alter table public.tpas enable row level security;
alter table public.sessions enable row level security;
alter table public.attendances enable row level security;
alter table public.used_tokens enable row level security;

drop policy if exists "tpa read" on public.tpas;
drop policy if exists "session read" on public.sessions;
drop policy if exists "users self-read" on public.users;
drop policy if exists "att read" on public.attendances;

create policy "tpa read" on public.tpas for select using (auth.role() = 'authenticated');
create policy "session read" on public.sessions for select using (auth.role() = 'authenticated');

create policy "users self-read" on public.users for select using (
  id = auth.uid() OR exists (
    select 1 from public.users u where u.id = auth.uid() and u.role = 'pengurus'
  )
);

create policy "att read" on public.attendances for select using (
  user_id = auth.uid() OR exists (
    select 1 from public.users u where u.id = auth.uid() and u.role = 'pengurus'
  )
);

-- =========================================================================
-- Helper functions (Task 1.3)
-- =========================================================================
create or replace function public.is_pengurus() returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'pengurus');
$$;

create or replace function public.haversine_m(a jsonb, b jsonb) returns double precision
language sql immutable as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(((a->>'lat')::float - (b->>'lat')::float) / 2)), 2) +
    cos(radians((a->>'lat')::float)) * cos(radians((b->>'lat')::float)) *
    power(sin(radians(((a->>'lng')::float - (b->>'lng')::float) / 2)), 2)
  ));
$$;

-- =========================================================================
-- Composite return type for check_in (Task 1.7 / R2)
-- =========================================================================
do $$ begin
  if not exists (select 1 from pg_type where typname = 'check_in_result') then
    create type public.check_in_result as (
      attendance public.attendances,
      reason text
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'qr_direction') then
    create type public.qr_direction as enum ('in', 'out');
  end if;
end $$;

-- =========================================================================
-- RPC: open_session (Task 1.4)
-- =========================================================================
create or replace function public.open_session(p_tpa_id text, p_location jsonb)
returns public.sessions language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_session public.sessions;
  v_tpa public.tpas;
  v_token text := encode(gen_random_bytes(16), 'hex');
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

  insert into public.sessions (tpa_id, first_teacher_id, qr_dynamic_in_token, qr_dynamic_in_expiry)
  values (p_tpa_id, v_user, v_token, v_expiry)
  returning * into v_session;

  insert into public.attendances (session_id, user_id, scan_in_time, scan_in_location, is_late, late_minutes)
  values (v_session.id, v_user, now(), p_location, false, 0);

  return v_session;
end; $$;

-- =========================================================================
-- RPC: close_session (Task 1.5) — first-teacher only
-- =========================================================================
create or replace function public.close_session(p_session_id uuid)
returns public.sessions language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_session public.sessions;
  v_token text := encode(gen_random_bytes(16), 'hex');
  v_expiry timestamptz := now() + interval '20 seconds';
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'Sesi tidak ditemukan'; end if;
  if v_session.first_teacher_id <> v_user then
    raise exception 'Hanya Pengajar Pertama yang dapat menutup sesi';
  end if;
  if not v_session.is_active then raise exception 'Sesi sudah ditutup'; end if;

  update public.sessions
  set is_active = false,
      date_closed = now(),
      qr_dynamic_out_token = v_token,
      qr_dynamic_out_expiry = v_expiry
  where id = p_session_id
  returning * into v_session;
  return v_session;
end; $$;

-- =========================================================================
-- RPC: admin_force_close (Task 1.6) — pengurus only
-- =========================================================================
create or replace function public.admin_force_close(p_session_id uuid)
returns public.sessions language plpgsql security definer set search_path = public as $$
declare v_session public.sessions;
begin
  if not public.is_pengurus() then raise exception 'forbidden'; end if;

  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'Sesi tidak ditemukan'; end if;
  if not v_session.is_active then raise exception 'Sesi sudah ditutup'; end if;

  update public.sessions
  set is_active = false, date_closed = now(),
      qr_dynamic_out_token = encode(gen_random_bytes(16), 'hex'),
      qr_dynamic_out_expiry = now() + interval '20 seconds'
  where id = p_session_id
  returning * into v_session;
  return v_session;
end; $$;

-- =========================================================================
-- RPC: check_in (Task 1.7) — first-teacher guard + single-use + GPS
-- =========================================================================
create or replace function public.check_in(
  p_session_id uuid, p_token text, p_location jsonb
) returns public.check_in_result language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_session public.sessions;
  v_tpa public.tpas;
  v_att public.attendances;
  v_late boolean;
  v_minutes int;
  v_threshold timestamptz;
  v_result public.check_in_result;
begin
  select * into v_session from public.sessions where id = p_session_id;
  if not found then raise exception 'Sesi tidak ditemukan'; end if;
  if not v_session.is_active then raise exception 'Sesi sudah ditutup'; end if;

  if v_session.qr_dynamic_in_token is null
     or v_session.qr_dynamic_in_token <> p_token
     or v_session.qr_dynamic_in_expiry < now() then
    raise exception 'QR code tidak valid atau sudah kadaluarsa';
  end if;

  -- First-teacher guard: return existing auto-recorded row, no write to used_tokens
  if v_session.first_teacher_id = v_user then
    select * into v_att from public.attendances
    where session_id = p_session_id and user_id = v_user;
    v_result.attendance := v_att;
    v_result.reason := 'FIRST_TEACHER_AUTO';
    return v_result;
  end if;

  if exists (select 1 from public.used_tokens
             where user_id = v_user and session_id = p_session_id and token = p_token) then
    raise exception 'Token sudah pernah digunakan';
  end if;

  v_threshold := v_session.date_opened + interval '15 minutes';
  v_late := now() > v_threshold;
  v_minutes := case when v_late
                    then extract(epoch from (now() - v_threshold))::int / 60
                    else 0 end;

  select * into v_tpa from public.tpas where id = v_session.tpa_id;
  if public.haversine_m(p_location, v_tpa.location) > (v_tpa.location->>'radius')::float then
    raise exception 'Anda berada di luar radius TPA';
  end if;

  insert into public.used_tokens(user_id, session_id, token)
  values (v_user, p_session_id, p_token);

  insert into public.attendances (session_id, user_id, scan_in_time, scan_in_location, is_late, late_minutes)
  values (p_session_id, v_user, now(), p_location, v_late, v_minutes)
  returning * into v_att;

  v_result.attendance := v_att;
  v_result.reason := null;
  return v_result;
end; $$;

-- =========================================================================
-- RPC: check_out (Task 1.8)
-- =========================================================================
create or replace function public.check_out(
  p_session_id uuid, p_token text, p_location jsonb
) returns public.attendances language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_session public.sessions;
  v_tpa public.tpas;
  v_att public.attendances;
begin
  select * into v_session from public.sessions where id = p_session_id;
  if not found then raise exception 'Sesi tidak ditemukan'; end if;

  if v_session.qr_dynamic_out_token is null
     or v_session.qr_dynamic_out_token <> p_token
     or v_session.qr_dynamic_out_expiry < now() then
    raise exception 'QR code tidak valid atau sudah kadaluarsa';
  end if;

  if exists (select 1 from public.used_tokens
             where user_id = v_user and session_id = p_session_id and token = p_token) then
    raise exception 'Token sudah pernah digunakan';
  end if;

  select * into v_tpa from public.tpas where id = v_session.tpa_id;
  if public.haversine_m(p_location, v_tpa.location) > (v_tpa.location->>'radius')::float then
    raise exception 'Anda berada di luar radius TPA';
  end if;

  select * into v_att from public.attendances
  where session_id = p_session_id and user_id = v_user;
  if not found then raise exception 'Anda belum melakukan presensi masuk'; end if;
  if v_att.scan_out_time is not null then raise exception 'Anda sudah melakukan presensi keluar'; end if;

  insert into public.used_tokens(user_id, session_id, token)
  values (v_user, p_session_id, p_token);

  update public.attendances
  set scan_out_time = now(), scan_out_location = p_location
  where id = v_att.id
  returning * into v_att;
  return v_att;
end; $$;

-- =========================================================================
-- RPC: rotate_qr_token (Task 1.10 / R3)
-- First-teacher-only for 'in' rotation: only the first teacher's device
-- displays the QR, so only they have a reason to rotate it.
-- For 'out' rotation, pengurus can also rotate (admin view of out-QR).
-- =========================================================================
create or replace function public.rotate_qr_token(p_session_id uuid, p_direction public.qr_direction)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_session public.sessions;
  v_token text := encode(gen_random_bytes(16), 'hex');
  v_expiry timestamptz := now() + interval '20 seconds';
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'Sesi tidak ditemukan'; end if;
  if not v_session.is_active then raise exception 'Sesi sudah ditutup'; end if;

  if p_direction = 'in' and v_session.first_teacher_id <> v_user then
    raise exception 'Hanya Pengajar Pertama yang dapat merotasi QR masuk';
  end if;
  if p_direction = 'out' and v_session.first_teacher_id <> v_user and not public.is_pengurus() then
    raise exception 'Tidak diizinkan merotasi QR keluar';
  end if;

  if p_direction = 'in' then
    update public.sessions
    set qr_dynamic_in_token = v_token, qr_dynamic_in_expiry = v_expiry
    where id = p_session_id;
  else
    update public.sessions
    set qr_dynamic_out_token = v_token, qr_dynamic_out_expiry = v_expiry
    where id = p_session_id;
  end if;

  return jsonb_build_object('token', v_token, 'expiry', v_expiry);
end; $$;

-- =========================================================================
-- RPC: get_session_report (used by LaporanPage and DetailPengajar)
-- =========================================================================
create or replace function public.get_session_report(p_session_id uuid)
returns table (
  user_id uuid,
  user_name text,
  user_nim text,
  scan_in_time timestamptz,
  scan_out_time timestamptz,
  is_late boolean,
  late_minutes int
) language sql security definer set search_path = public as $$
  select
    u.id, u.name, u.nim,
    a.scan_in_time, a.scan_out_time,
    a.is_late, a.late_minutes
  from public.attendances a
  join public.users u on u.id = a.user_id
  where a.session_id = p_session_id
  order by a.scan_in_time nulls last;
$$;

-- =========================================================================
-- RPC: list_my_attendances (used by RiwayatPage)
-- =========================================================================
create or replace function public.list_my_attendances()
returns table (
  attendance_id uuid,
  session_id uuid,
  tpa_id text,
  tpa_name text,
  date_opened timestamptz,
  date_closed timestamptz,
  is_session_active boolean,
  scan_in_time timestamptz,
  scan_out_time timestamptz,
  is_late boolean,
  late_minutes int
) language sql security definer set search_path = public as $$
  select
    a.id, s.id, s.tpa_id, t.name,
    s.date_opened, s.date_closed, s.is_active,
    a.scan_in_time, a.scan_out_time, a.is_late, a.late_minutes
  from public.attendances a
  join public.sessions s on s.id = a.session_id
  join public.tpas t on t.id = s.tpa_id
  where a.user_id = auth.uid()
  order by s.date_opened desc;
$$;

-- =========================================================================
-- Realtime publication (Phase 2 hook consumers)
-- =========================================================================
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'sessions'
  ) then
    alter publication supabase_realtime add table public.sessions;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'attendances'
  ) then
    alter publication supabase_realtime add table public.attendances;
  end if;
end $$;
