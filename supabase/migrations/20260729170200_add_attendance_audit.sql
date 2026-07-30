-- 20260729170200_add_attendance_audit.sql
-- Additive: server-side append-only audit log.
-- Client roles cannot INSERT/UPDATE/DELETE.
-- No raw tokens, passwords, or location payloads stored.

create table if not exists public.attendance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id),
  action text not null,
  session_id uuid references public.sessions(id) on delete set null,
  attendance_id uuid references public.attendances(id) on delete set null,
  accepted boolean not null default true,
  reason_code text,
  distance_m double precision,
  configured_radius_m double precision,
  location_accuracy_m double precision,
  recorded_at timestamptz not null default now()
);

alter table public.attendance_audit_logs enable row level security;

-- No client access. Audit logs are written by SECURITY DEFINER RPCs only.
revoke all on public.attendance_audit_logs from anon, authenticated;
