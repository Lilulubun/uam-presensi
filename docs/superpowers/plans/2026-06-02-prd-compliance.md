# PRD Compliance Implementation Plan

**Date:** 2026-06-02
**Version:** 1.2 (refined — 6 review fixes applied to v1.1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Goal:** Bring the prototype into compliance with PRD v1.0 across all 14 missing/partial items, by migrating state to Supabase and adding the missing UX/logic.
>
> **Architecture:** Supabase (Auth + Postgres + Realtime) replaces localStorage. Server-side RPCs enforce `close_session` ownership, single-use token consumption, and GPS radius. Client stores keep optimistic UI but persist via Supabase. Realtime subscriptions power the pengurus dashboard.
>
> **Tech Stack:** React 18, Vite, TypeScript, Zustand, Supabase JS v2, vitest, @testing-library/react, date-fns

---

## Resolved Issues (v1.0 → v1.1)

| # | Issue | Resolution |
|---|-------|------------|
| 1 | Demo seed used known passwords in production Supabase Auth | Seed users via env-gated SQL only; passwords read from `.env.local` at seed time, never hardcoded |
| 2 | `check_in` RPC silently overwrote first-teacher auto-attendance; Task 1.7 and Task 3.2 were inconsistent | RPC now detects first-teacher re-scan, returns early with a `reason` field; no `on conflict do update` for first teacher |
| 3 | No `rotate_qr_token` RPC — token refresh was a no-op; client had no way to get a fresh token | Added Task 1.11 `rotate_qr_token` RPC + Task 2.2 now includes a `refreshQRToken` action that calls it |
| 4 | `useRealtimeSessions` had no cleanup / `channel.unsubscribe()` | Task 2.5 now explicitly requires `useEffect` cleanup returning `() => supabase.removeChannel(channel)` |
| 5 | Phase 5 had no interaction logging for TAM evaluation | Added Task 5.4: lightweight `interaction_logs` table + client logger |

## Refinements applied in v1.2 (from code review)

| # | Issue | Where | Fix |
|---|-------|-------|-----|
| R1 | Seed SQL had `<auth-uuid-*>` placeholders to copy-paste after `supabase auth admin create-user` — fragile, non-idempotent, breaks `supabase db push` | Task 1.9 | Replaced with `supabase/seed.ts` script using admin client |
| R2 | `check_in_result` composite return type referenced in 3 tasks but TS binding never specified | Task 1.7 | Add explicit `CheckInResult` TS type |
| R3 | `rotate_qr_token` RPC authz may look over-tight without context | Task 1.10 | Add inline comment explaining *why* first-teacher-only for `in` rotation |
| R4 | Task 3.5 (Detail Pengajar) would be built with the old (broken) early-exit formula, then Task 4.1 would re-commit the same line | Tasks 3.5 + 4.1 | Reorder: Task 4.1 first, Task 3.5 second |
| R5 | Task 4.5 packs a migration + client logger + 6 call-site wirings in one task | Task 4.5 | Split: 4.5a = migration, 4.5b = client logger + wirings |
| R6 | `DashboardPengurus.tsx:198, 201` still imports `MOCK_TPAS` after Task 2.6 removal | Task 2.6 | Add explicit file change to update DashboardPengurus |
| R7 | `EvaluasiPage` is post-PRD thesis work, not a PRD requirement | Task 5.4 | Mark as `## Post-PRD` so the compliance claim stays honest |
| R8 | Locked tradeoffs missing: Konfirmasi dialog UX, MOCK_TPAS consumer update, EvaluasiPage scope | Top | Add 5b/5c/5d |
| R9 | NFR-SEC-04 (HTTPS) had no doc task | Task 5.3 | Add one-liner |

---

## Phases Overview

| Phase | Name | Tasks | Effort |
|-------|------|-------|--------|
| 0 | Supabase bootstrap | 2 | 0.5 day |
| 1 | DB schema + RLS + RPCs | 11 | 1.5 days |
| 2 | Client integration | 6 | 2 days |
| 3 | UX gaps | 5 | 1 day |
| 4 | Logic & hygiene | 6 | 0.5 day |
| 5 | Final verification | 5 | 0.5 day |

**Total: ~31 tasks, ~6 working days (single developer)**

---

## Phase 0 — Supabase Bootstrap

### Task 0.1: Project + env

**Files:**
- Create: `.env.example`
- Modify: `package.json`
- Verify: `.gitignore` contains `.env.local` and `.worktrees` (already done)

- [ ] Install: `npm i @supabase/supabase-js`
- [ ] `.env.example` content:
  ```
  VITE_SUPABASE_URL=https://<project>.supabase.co
  VITE_SUPABASE_ANON_KEY=<anon>
  VITE_GPS_DEBUG=false
  VITE_DEMO_MODE=false

  # Seed-only — never used in runtime app code
  SEED_PENGAJAR_PASSWORD=<password>
  SEED_PENGURUS_PASSWORD=<password>
  ```
- [ ] Note in plan: migrations are pasted into Supabase SQL editor. `supabase db push` is optional.
- [ ] **Commit** `chore: env setup`

### Task 0.2: Supabase client singleton

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/lib/__tests__/supabase.test.ts`

- [ ] **Test** — when env vars are missing, `supabase.ts` throws `Error('Supabase env not configured')`. When present, exports a non-null client.
- [ ] **Implementation:**
  ```ts
  import { createClient } from '@supabase/supabase-js';

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env not configured');

  export const supabase = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  ```
- [ ] **Commit** `chore: supabase client singleton`

---

## Phase 1 — Database, RLS, RPCs

All SQL lives in `supabase/migrations/`. Run via Supabase SQL editor or `supabase db push`.

### Task 1.1: Schema

**File:** `supabase/migrations/0001_init.sql`

```sql
create type user_role as enum ('pengajar','pengurus');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role user_role not null,
  nim text
);

create table public.tpas (
  id text primary key,
  name text not null,
  location jsonb not null,           -- {lat, lng, radius}
  static_qr_code text not null unique
);

create table public.sessions (
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
create index on public.sessions (tpa_id) where is_active;
create index on public.sessions (date_opened desc);

create table public.attendances (
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

create table public.used_tokens (
  user_id uuid not null references public.users(id),
  session_id uuid not null references public.sessions(id) on delete cascade,
  token text not null,
  used_at timestamptz not null default now(),
  primary key (user_id, session_id, token)
);
```

- [ ] **Commit** `db: schema — users, tpas, sessions, attendances, used_tokens`

### Task 1.2: RLS policies

**File:** same migration

```sql
alter table public.users enable row level security;
alter table public.tpas enable row level security;
alter table public.sessions enable row level security;
alter table public.attendances enable row level security;
alter table public.used_tokens enable row level security;

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
-- All writes go through SECURITY DEFINER RPCs — no direct insert/update from client.
```

### Task 1.3: Helper functions

```sql
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
```

### Task 1.4: RPC `open_session`

```sql
create or replace function public.open_session(p_tpa_id text, p_location jsonb)
returns public.sessions language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_session public.sessions;
  v_token text := encode(gen_random_bytes(16), 'hex');
  v_expiry timestamptz := now() + interval '20 seconds';
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  if exists (select 1 from public.sessions where tpa_id = p_tpa_id and is_active) then
    raise exception 'TPA ini sudah memiliki sesi aktif';
  end if;

  insert into public.sessions (tpa_id, first_teacher_id, qr_dynamic_in_token, qr_dynamic_in_expiry)
  values (p_tpa_id, v_user, v_token, v_expiry)
  returning * into v_session;

  insert into public.attendances (session_id, user_id, scan_in_time, scan_in_location, is_late, late_minutes)
  values (v_session.id, v_user, now(), p_location, false, 0);

  return v_session;
end; $$;
```

- [ ] **Commit** `db: open_session rpc — auto-records first teacher`

### Task 1.5: RPC `close_session`

```sql
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
```

### Task 1.6: RPC `admin_force_close`

```sql
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
```

### Task 1.7: RPC `check_in` (with first-teacher guard + TS type binding)

> **Issue 2 fix** + **Refinement R2**: First-teacher re-scan returns early with a structured `reason` field. The composite return type is bound in TypeScript below so client code can import it.

```sql
create type check_in_result as (
  attendance public.attendances,
  reason text   -- null = normal scan; 'FIRST_TEACHER_AUTO' = already recorded
);

create or replace function public.check_in(
  p_session_id uuid, p_token text, p_location jsonb
) returns check_in_result language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_session public.sessions;
  v_tpa public.tpas;
  v_att public.attendances;
  v_late boolean;
  v_minutes int;
  v_threshold timestamptz;
  v_result check_in_result;
begin
  select * into v_session from public.sessions where id = p_session_id;
  if not found then raise exception 'Sesi tidak ditemukan'; end if;
  if not v_session.is_active then raise exception 'Sesi sudah ditutup'; end if;

  if v_session.qr_dynamic_in_token is null
     or v_session.qr_dynamic_in_token <> p_token
     or v_session.qr_dynamic_in_expiry < now() then
    raise exception 'QR code tidak valid atau sudah kadaluarsa';
  end if;

  -- First-teacher guard: return existing row, do not write used_token
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
```

**TypeScript binding** (add to `src/types/index.ts`):

```ts
export type CheckInReason = 'FIRST_TEACHER_AUTO' | null;
export interface CheckInResult {
  attendance: Attendance;
  reason: CheckInReason;
}
```

- [ ] **Commit** `db: check_in rpc + ts binding — first-teacher guard, single-use, GPS`

### Task 1.8: RPC `check_out`

```sql
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
```

### Task 1.9: Seed — TPAs + demo users (TS script, not SQL)

> **Issue 1 fix + Refinement R1**: Replaced fragile SQL with placeholders by a re-runnable TS script using the Supabase admin client. Passwords come from `SEED_*_PASSWORD` env vars, never hardcoded.

**Files:**
- Create: `supabase/seed.ts`
- Create: `supabase/migrations/0002_tpas.sql` (TPA data only — no auth/users)
- Modify: `package.json` (add `seed` script)
- Add: `tsx` dev dep

- [ ] Install: `npm i -D tsx`
- [ ] `package.json` add to scripts:
  ```json
  "seed": "tsx supabase/seed.ts"
  ```
- [ ] `supabase/migrations/0002_tpas.sql`:
  ```sql
  insert into public.tpas (id, name, location, static_qr_code) values
    ('tpa-001', 'TPA Al-Fath',     '{"lat":-7.6864394412020145,"lng":110.4183135208608,"radius":100}', 'TPA-001'),
    ('tpa-002', 'TPA Adz-Dzikro',  '{"lat":-7.744803275758542,"lng":110.41414103514991,"radius":100}',  'TPA-002'),
    ('tpa-003', 'TPA Al-Hidayah Besirejo',     '{"lat":-7.69690001497496,"lng":110.41985753233598,"radius":100}', 'TPA-003'),
    ('tpa-004', 'TPA Al-Hidayah Tanjungsari',  '{"lat":-7.692058086494675,"lng":110.44915826476229,"radius":100}', 'TPA-004'),
    ('tpa-005', 'TPA Al-Iman',     '{"lat":-7.697983633584647,"lng":110.40599807240116,"radius":100}', 'TPA-005'),
    ('tpa-006', 'TPA Ananda',      '{"lat":-7.699886036726615,"lng":110.40676711984223,"radius":100}', 'TPA-006'),
    ('tpa-007', 'TPA Az-Zahra',    '{"lat":-7.672930214991263,"lng":110.40046648044921,"radius":100}', 'TPA-007'),
    ('tpa-008', 'TPA Al-Muhtadin', '{"lat":-7.7012103705816655,"lng":110.4062802454369,"radius":100}', 'TPA-008'),
    ('tpa-009', 'TPA Al-Jami''',    '{"lat":-7.687739641892811,"lng":110.40873308217957,"radius":100}', 'TPA-009'),
    ('tpa-010', 'TPA Ulil Albab',  '{"lat":-7.701725012893864,"lng":110.41550971507898,"radius":100}', 'TPA-010'),
    ('tpa-011', 'TPA Sholihin',    '{"lat":-7.695346961575441,"lng":110.41336418264429,"radius":100}', 'TPA-011')
  on conflict (id) do nothing;
  ```
- [ ] `supabase/seed.ts`:
  ```ts
  import { createClient } from '@supabase/supabase-js';
  import 'dotenv/config';

  // Uses SERVICE_ROLE key, not anon. Never bundle this in client code.
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const DEMO_USERS = [
    { email: 'budi@uii.ac.id',  name: 'Budi Santoso', role: 'pengajar', nim: '20521001', password: process.env.SEED_PENGAJAR_PASSWORD },
    { email: 'siti@uii.ac.id',  name: 'Siti Rahayu',  role: 'pengajar', nim: '20521002', password: process.env.SEED_PENGAJAR_PASSWORD },
    { email: 'ahmad@uii.ac.id', name: 'Ahmad Fauzi',  role: 'pengajar', nim: '20521003', password: process.env.SEED_PENGAJAR_PASSWORD },
    { email: 'admin@uam.id',    name: 'Admin UAM',    role: 'pengurus', nim: null,      password: process.env.SEED_PENGURUS_PASSWORD },
  ] as const;

  for (const u of DEMO_USERS) {
    if (!u.password) { console.error(`skip ${u.email}: SEED_*_PASSWORD not set`); continue; }
    // Idempotent: listUsers by email, create only if missing
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing?.users.find(x => x.email === u.email);
    let userId: string;
    if (found) {
      userId = found.id;
      console.log(`exists: ${u.email}`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email, password: u.password, email_confirm: true,
      });
      if (error) { console.error(`create ${u.email} failed:`, error.message); continue; }
      userId = data.user.id;
      console.log(`created: ${u.email}`);
    }
    const { error: profileErr } = await supabase.from('users')
      .upsert({ id: userId, email: u.email, name: u.name, role: u.role, nim: u.nim },
              { onConflict: 'id' });
    if (profileErr) console.error(`profile ${u.email} failed:`, profileErr.message);
  }
  console.log('seed complete');
  ```
- [ ] `.env.example` add (these are *server-side* seed-only, not `VITE_`):
  ```
  # Seed script only — not exposed to client
  SUPABASE_URL=https://<project>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=<service-role>
  ```
- [ ] Run `npm run seed` after applying `0001_init.sql` and `0002_tpas.sql`.
- [ ] **Commit** `db+script: seed tpas (sql) + demo users (ts)`

### Task 1.10: RPC `rotate_qr_token`

> **Issue 3 fix + Refinement R3**: Server-side token rotation. The first-teacher-only authz on `in` rotation is intentional — the first teacher is the only one who displays the QR, so only they need to rotate it. Other pengajars scan from the first teacher's screen.

```sql
create type qr_direction as enum ('in', 'out');

create or replace function public.rotate_qr_token(p_session_id uuid, p_direction qr_direction)
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

  -- Authz: only the first teacher rotates the in-token because only their device
  -- displays the QR. The out-token can also be rotated by pengurus (so the
  -- admin can refresh their own view of the out-QR while the session is closed).
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
```

- [ ] **Commit** `db: rotate_qr_token rpc`

### Task 1.11: Verify migrations + RPCs

- [ ] Apply `0001_init.sql` then `0002_tpas.sql` against the Supabase project.
- [ ] Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `SEED_*_PASSWORD` in `.env.local` (or shell env) and run `npm run seed`.
- [ ] Confirm 11 TPAs in `public.tpas`, 4 users in `auth.users` + `public.users`.
- [ ] Sanity-check RLS: `select * from sessions` as anonymous → empty result, no error.
- [ ] Test `rotate_qr_token` via SQL editor: call as first teacher → returns `{token, expiry}`; as non-first-teacher → exception.

---

## Phase 2 — Client Integration

### Task 2.1: Replace `useAuthStore` with Supabase Auth

**Files:**
- Modify: `src/store/authStore.ts`
- Create: `src/store/__tests__/authStore.test.ts`

- [ ] **Test** — sign in with valid email/password returns user with profile; sign out clears state; stale session on reload restores user without extra login.
- [ ] **Implementation outline:**
  ```ts
  export const useAuthStore = create<AuthState>((set) => ({
    user: null, isAuthenticated: false, loading: true,
    init: async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const { data: profile } = await supabase
          .from('users').select('*').eq('id', data.session.user.id).single();
        set({ user: profile, isAuthenticated: true, loading: false });
      } else set({ loading: false });
    },
    login: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // fetch profile then set
    },
    logout: async () => {
      await supabase.auth.signOut();
      set({ user: null, isAuthenticated: false });
    },
  }));
  ```
- [ ] Update `LoginPage` to call new `login` and surface Supabase error messages in Indonesian.
- [ ] Update `App.tsx` to call `useAuthStore.getState().init()` once at mount.
- [ ] Run all existing tests; update mocks for new store signature.
- [ ] **Commit** `feat(auth): supabase auth`

### Task 2.2: Replace `useSessionStore` with RPC-backed actions

**Files:**
- Modify: `src/store/sessionStore.ts`
- Create: `src/store/__tests__/sessionStore.test.ts`

- [ ] **Test** `openSession` calls `supabase.rpc('open_session', { p_tpa_id, p_location })`; updates local cache; on RPC error returns `ValidationResult` with Indonesian error message.
- [ ] **Test** `closeSession` calls RPC; non-first-teacher receives the correct error string.
- [ ] **Test** `refreshQRToken`:
  - While `qr_dynamic_in_expiry > now()`, returns cached token (no network call).
  - After expiry, calls `supabase.rpc('rotate_qr_token', { p_session_id, p_direction: 'in' })` and updates local state with new token + expiry. *(Issue 3 fix)*
- [ ] **Commit** `feat(session): rpc-backed session store`

### Task 2.3: Replace `useAttendanceStore` with RPC-backed actions

**Files:**
- Modify: `src/store/attendanceStore.ts`
- Create: `src/store/__tests__/attendanceStore.test.ts`

- [ ] **Test** `checkIn` calls `supabase.rpc('check_in', ...)`, parses the `check_in_result` composite into `CheckInResult`, and returns a `ValidationResult` whose `data` carries the `reason` field for `FIRST_TEACHER_AUTO`. *(Issue 2 fix + R2 type binding)*
- [ ] **Test** `checkOut` calls `supabase.rpc('check_out', ...)`; on GPS error surfaces correct message.
- [ ] **Test** first teacher: after opening a session, `getAttendanceBySession` shows their row immediately (from `open_session` auto-record).
- [ ] **Commit** `feat(attendance): rpc-backed attendance store`

### Task 2.4: Replace `useTpaStore` with table fetch

**Files:**
- Modify: `src/store/tpaStore.ts`
- Create: `src/store/__tests__/tpaStore.test.ts`

- [ ] **Test** store fetches `tpas` on init; `getTPAById` and `getTPAByStaticQR` work after fetch.
- [ ] Implementation: `supabase.from('tpas').select('*')` on init; expose helpers.
- [ ] **Commit** `feat(tpa): supabase tpas fetch`

### Task 2.5: Realtime for pengurus dashboard

**Files:**
- Create: `src/app/hooks/useRealtimeSessions.ts`
- Modify: `src/pages/pengurus/DashboardPengurus.tsx` (drop 10s polling interval, use hook)

- [ ] **Test** hook subscribes to `sessions` and `attendances` postgres_changes; merges INSERT/UPDATE/DELETE into local state; cleanup function unsubscribes; two parallel hook instances do not double-subscribe.
- [ ] **Implementation** — must include cleanup *(Issue 4 fix)*:
  ```ts
  useEffect(() => {
    const channel = supabase
      .channel('uam-changes')
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'sessions' },
          payload => { /* merge insert/update/delete into local state */ })
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'attendances' },
          payload => { /* merge */ })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  ```
- [ ] **Commit** `feat(realtime): pengurus live updates with cleanup`

### Task 2.6: Drop localStorage persistence + mock tpas array

- [ ] Remove `persist(...)` middleware from all 4 stores.
- [ ] Remove `src/lib/seed-data.ts` and `useSeedData` hook.
- [ ] Remove `MOCK_TPAS` array from `src/lib/mock-data.ts`; helpers read from the TPA store.
- [ ] **Update `src/pages/pengurus/DashboardPengurus.tsx`** lines 198, 201 to read from `useTpaStore` instead of importing `MOCK_TPAS`. *(Refinement R6)*
- [ ] *Ordering note: do this after Task 2.4 is green, to avoid import errors mid-phase.*
- [ ] **Commit** `refactor: drop localStorage persistence, seed data, and mock tpas array`

---

## Phase 3 — UX Gaps

### Task 3.1: Konfirmasi Penutupan dialog

**Files:**
- Modify: `src/pages/pengajar/SessionActivePage.tsx`

- [ ] **Test** clicking "Tutup Sesi" opens an `AlertDialog`; confirming calls `closeSession`; cancelling closes without calling.
- [ ] Implementation outline:
  ```tsx
  <AlertDialog open={open} onOpenChange={setOpen}>
    <AlertDialogTrigger asChild>
      <Button variant="destructive" disabled={closing}>Tutup Sesi</Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Tutup sesi?</AlertDialogTitle>
        <AlertDialogDescription>QR presensi keluar akan diaktifkan dan sesi tidak dapat dibuka kembali.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Batal</AlertDialogCancel>
        <AlertDialogAction onClick={handleCloseSession}>Tutup</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  ```
- [ ] **Commit** `feat(session): confirm dialog before close`

### Task 3.2: First-teacher tailored message on scan

**Files:**
- Modify: `src/pages/pengajar/ScanPage.tsx`
- Modify: `src/pages/pengajar/KonfirmasiPresensi.tsx`

> Depends on Tasks 1.7 and 2.3. The `reason = 'FIRST_TEACHER_AUTO'` field from the RPC flows through the store's `ValidationResult` to here.

- [ ] **Test** when the store returns `reason = 'FIRST_TEACHER_AUTO'`, the page shows an info (not error) banner: "Presensi masuk Anda sudah otomatis tercatat saat membuka sesi. Scan diabaikan."
- [ ] Implementation: add an `InfoBanner` variant alongside the existing error path in `KonfirmasiPresensi`.
- [ ] **Commit** `feat(presensi): info banner for first-teacher auto-scan`

### Task 3.3: Admin force-close UI

**Files:**
- Modify: `src/pages/pengurus/TPADetailPage.tsx`
- Modify: `src/store/sessionStore.ts` (add `forceCloseSession`)

- [ ] **Test** `forceCloseSession` calls `supabase.rpc('admin_force_close')`; on success session becomes inactive.
- [ ] **Test** `TPADetailPage` shows "Tutup Sesi (Admin)" button only for `pengurus` when active session exists; button opens `AlertDialog` before calling.
- [ ] **Commit** `feat(admin): force-close session`

### Task 3.4: GPS proactive permission UI

**Files:**
- Create: `src/app/components/gps/PermissionPrompt.tsx`
- Modify: `src/pages/pengajar/ScanPage.tsx`

- [ ] **Test** `<QRScanner>` is gated behind `PermissionPrompt`; on `PERMISSION_DENIED`, recovery banner appears with instructions; on success, scanner activates.
- [ ] Implementation: show "Izinkan Akses Lokasi" CTA first. On `GeolocationPositionError.PERMISSION_DENIED`, show: "Buka pengaturan browser → izinkan lokasi untuk situs ini."
- [ ] **Commit** `feat(gps): explicit permission prompt`

### Task 3.5: Detail Pengajar page

> **Refinement R4:** Build this AFTER Task 4.1 (early-exit fix) so the page inherits the corrected formula in a single commit.

**Files:**
- Create: `src/pages/pengurus/DetailPengajar.tsx`
- Create: `src/pages/pengurus/__tests__/DetailPengajar.test.tsx`
- Modify: `src/app/App.tsx` (add route `/pengurus/pengajar/:userId`)
- Modify: `src/pages/pengurus/TPADetailPage.tsx` (link attendee names)
- Modify: `src/pages/pengurus/DashboardPengurus.tsx` (link teacher stats rows)

- [ ] **Test** page loads user profile + filtered attendances; renders summary cards (total sesi, tepat waktu, terlambat, keluar awal); list grouped by session with late and early-exit flags using the **fixed** predicate from Task 4.1.
- [ ] **Test** clicking an attendee name in `TPADetailPage` navigates to `/pengurus/pengajar/<userId>`.
- [ ] **Implementation outline** (uses `useUser`/`useAttendancesByUser` hooks created here):
  ```tsx
  export default function DetailPengajar() {
    const { userId } = useParams();
    const { data: user } = useUser(userId);
    const { data: attendances } = useAttendancesByUser(userId);
    // earlyExit per Task 4.1 formula (already fixed)
  }
  ```
- [ ] **Commit** `feat(pengurus): detail pengajar page`

---

## Phase 4 — Logic & Hygiene

> **Refinement R4:** Reordered. 4.1 first, then 3.5 (Detail Pengajar) inherits the fix in a single commit. 4.5a (migration) and 4.5b (client logger) split for incremental verification.

### Task 4.1: Early-exit fix (per PRD §6)

**Files to modify:**
- `src/pages/pengajar/RiwayatPage.tsx` (line ~70)
- `src/pages/pengurus/LaporanPage.tsx` (line ~53)
- `src/pages/pengurus/TPADetailPage.tsx` (line ~154)
- `src/lib/attendance-utils.ts` (new — extracted helper)

- [ ] **Test** (in `attendance-utils.test.ts`): `isEarlyExit(attendance, session)` returns `false` for the first teacher even when `scanInTime` is set, `scanOutTime` is null, and the session is closed. Returns `true` for other teachers in that state. Returns `false` for any user with `scanOutTime` set or with an active session.
- [ ] **Implementation** — extract the predicate:
  ```ts
  // src/lib/attendance-utils.ts
  import type { Attendance, Session } from '../types';

  export function isEarlyExit(a: Attendance, session: Session): boolean {
    return (
      !!a.scanInTime &&
      !a.scanOutTime &&
      !session.isActive &&
      a.userId !== session.firstTeacherId
    );
  }
  ```
- [ ] Replace the duplicated predicate in `RiwayatPage.tsx:70`, `LaporanPage.tsx:53`, `TPADetailPage.tsx:154` with `isEarlyExit(a, session)`.
- [ ] **Commit** `fix(early-exit): exclude first teacher per PRD §6 + extract helper`

### Task 4.2: HTML escape in print

**Files:**
- Modify: `src/pages/pengurus/PengaturanPage.tsx` (lines ~34–63)

- [ ] **Test** with a TPA name containing `<script>alert(1)</script>`, the print window renders the literal text, not a script.
- [ ] Implementation: replace `document.write` string interpolation with DOM API:
  ```ts
  const win = window.open('', '_blank');
  if (!win) return;
  const doc = win.document;
  doc.body.style.cssText = '...';
  const card = doc.createElement('div');
  const h1 = doc.createElement('h1');
  h1.textContent = tpa.name;
  const img = doc.createElement('img');
  img.src = tpa.qrDataUrl;
  // ... append
  win.print();
  win.close();
  ```
- [ ] **Commit** `fix(print): escape tpa fields in print window`

### Task 4.3: GPS_DEBUG_MODE default off

**Files:**
- Modify: `src/config.ts` (line ~13)
- Modify: `src/lib/gps-utils.ts` (lines ~46–49)

- [ ] **Test** with `VITE_GPS_DEBUG` unset or `'false'`, `isWithinRadius` enforces the real radius check. With `VITE_GPS_DEBUG='true'` (set in test env), it bypasses.
- [ ] Implementation:
  ```ts
  export const GPS_DEBUG_MODE = import.meta.env.VITE_GPS_DEBUG === 'true';
  ```
- [ ] **Commit** `fix(gps): debug mode env-gated, default off`

### Task 4.4: Mark mock credentials prototype-only

**Files:**
- Modify: `src/lib/mock-data.ts`
- Modify: `src/pages/LoginPage.tsx`

- [ ] **Test** `MOCK_USERS` is not imported by any production code path (only tests and the seed script).
- [ ] Add banner comment at top of `mock-data.ts`:
  ```ts
  // PROTOTYPE / DEMO ONLY — used by supabase/seed.ts and tests.
  // Remove or gate behind VITE_DEMO_MODE=true for any real deployment.
  ```
- [ ] In `LoginPage`, gate the demo-credentials block:
  ```tsx
  {import.meta.env.VITE_DEMO_MODE === 'true' && <DemoCredentialsBanner />}
  ```
- [ ] **Commit** `chore(auth): mark mock credentials prototype-only`

### Task 4.5a: `interaction_logs` migration

> **Refinement R5 + Issue 5 (split):** Just the SQL. The client logger and wirings are in 4.5b.

**File:** `supabase/migrations/0003_interaction_logs.sql`

```sql
create table public.interaction_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  event_type text not null,
  session_id uuid references public.sessions(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index on public.interaction_logs (user_id, created_at desc);
create index on public.interaction_logs (event_type, created_at desc);

alter table public.interaction_logs enable row level security;
create policy "logs pengurus read" on public.interaction_logs for select
  using (public.is_pengurus());
```

- [ ] Apply migration.
- [ ] **Commit** `db: interaction_logs table for TAM evaluation`

### Task 4.5b: Client logger + wirings

**Files:**
- Create: `src/lib/log-event.ts`
- Modify: `src/store/sessionStore.ts` (log session_opened, session_closed)
- Modify: `src/store/attendanceStore.ts` (log scan_in_success, scan_in_gps_denied, qr_expired)
- Modify: `src/pages/pengurus/TPADetailPage.tsx` (log admin_force_close)

- [ ] **Test** `logEvent('test_event', sessionId, { foo: 'bar' })` calls `supabase.from('interaction_logs').insert(...)` and swallows errors. Does not throw.
- [ ] Implementation:
  ```ts
  export async function logEvent(
    eventType: string,
    sessionId?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await supabase.from('interaction_logs').insert({
        event_type: eventType, session_id: sessionId, metadata,
      });
    } catch {
      // Fire-and-forget; never block UX
    }
  }
  ```
- [ ] Wire at the 6 touchpoints above; for errors (gps_denied, qr_expired), pass the error message in `metadata`.
- [ ] **Commit** `feat(logging): client logger for TAM eval`

---

## Phase 5 — Final Verification

### Task 5.1: Full test pass + typecheck

- [ ] `npm test` → all green. Update mocks for store signature changes; pay attention to the `CheckInResult` type binding.
- [ ] `npm run typecheck` → clean.

### Task 5.2: E2E happy path (manual or Playwright)

**Scenario:**
1. `budi@uii.ac.id` scans static QR for TPA-001 → opens session → in-QR shown.
2. Budi scans own in-QR → info banner "sudah otomatis tercatat".
3. `siti@uii.ac.id` scans in-QR at TPA-001 location → konfirmasi masuk success.
4. Budi clicks "Tutup Sesi" → `AlertDialog` confirms → out-QR displayed.
5. Siti scans out-QR → konfirmasi keluar success.
6. Pengurus dashboard shows realtime update; `/pengurus/pengajar/<siti-id>` shows 1 session, no early-exit.
7. CSV export from `/pengurus/laporan` includes the session.

- [ ] Run scenario; capture screenshots for thesis appendix.

### Task 5.3: SECURITY.md + updated README

- [ ] `SECURITY.md`:
  - All auth/QR/GPS validation is server-side; the client is untrusted.
  - Token rotation is the only QR refresh mechanism.
  - HTTPS is required for production (Vercel provides this; locally use `vercel dev`). *(Refinement R9)*
  - Demo credentials in `mock-data.ts` are env-gated (`VITE_DEMO_MODE=true`) and must never be enabled in production.
- [ ] `README.md` updates:
  - Env setup (`.env.local` vars, `SEED_*` vars, `SUPABASE_SERVICE_ROLE_KEY`)
  - Seeding steps: `supabase db push` (or paste SQL into editor) + `npm run seed`
  - Login instructions for demo accounts
  - Early-exit formula reference (§6)
  - TAM evaluation: how to read `interaction_logs` via `/pengurus/evaluasi`
- [ ] **Commit** `docs: security + readme update`

### Task 5.4: EvaluasiPage (TAM)

> **Refinement R7:** Not a PRD requirement. This is post-PRD thesis-evaluation work. Marked as such so the "PRD compliance" claim stays honest.

**Files:**
- Create: `src/pages/pengurus/EvaluasiPage.tsx`
- Create: `src/pages/pengurus/__tests__/EvaluasiPage.test.tsx`
- Modify: `src/app/App.tsx` (add route `/pengurus/evaluasi`, behind `ProtectedRoute allowedRoles={['pengurus']}`)
- Modify: `src/pages/pengurus/DashboardPengurus.tsx` (nav link)

- [ ] **Test** page lists rows from `interaction_logs`; CSV export works; only pengurus can access (route guard test).
- [ ] Implementation: simple table + CSV export grouped by `event_type` and `user_id`.
- [ ] **Commit** `feat(evaluasi): TAM interaction log viewer (post-PRD)`

### Task 5.5: Final plan self-review

- [ ] Re-run the writing-plans self-review checklist: spec coverage, placeholder scan, type consistency. The `CheckInResult` type is now declared in Task 1.7 and used in 2.3, 3.2, 5.1 — consistent.
- [ ] Verify the 4 final-tradeoff items are honored (no localStorage in production, etc.).

---

## Locked Tradeoffs

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Supabase Auth replaces mock auth entirely | Aligns with NFR-SEC-03/05; `MOCK_USERS` kept only for seed |
| 2 | All state on server — no localStorage fallback | Source of truth is Supabase; localStorage was prototype-only |
| 3 | Konfirmasi Penutupan = in-place `AlertDialog` on `SessionActivePage` | Smallest change; dedicated route not needed |
| 4 | Early exit excludes first teacher (per PRD §6) | §5.3 prose treated as editorial error |
| 5 | No Supabase CLI required | SQL editor is sufficient; CLI is optional |
| 6 | Seed passwords env-gated, never hardcoded | Prevents known-credential exposure even in dev |
| 7 (5b) | Konfirmasi dialog wraps the existing close button; the same page transitions in-place to display the out-QR after confirm | PRD §8 leaves this ambiguous; in-place is the smaller change |
| 8 (5c) | MOCK_TPAS removal must also update `DashboardPengurus.tsx:198, 201` | The TPA grid imports `MOCK_TPAS` directly today; flagged in Task 2.6 |
| 9 (5d) | EvaluasiPage is post-PRD thesis work, not a PRD requirement | Marked separately in Task 5.4 so the compliance claim stays honest |

---

## Post-PRD (not part of "PRD compliance")

- Task 5.4 `EvaluasiPage` — TAM evaluation only, thesis-specific.
- Any UI polish beyond what the PRD requires.
- Internationalization (PRD UI is Indonesian-only).
- Accessibility audit (PRD does not specify).
- Performance tuning beyond NFR-PERF targets.

---

*End of plan.*
