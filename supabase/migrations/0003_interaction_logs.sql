-- 0003_interaction_logs.sql — client logger sink (Phase 4.5a)
-- Schema-only; rows are inserted via supabase.from('interaction_logs').insert(...) from the browser.
-- Keeps thesis evaluation out of the PRD-compliance surface.
create table if not exists public.interaction_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  event text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists interaction_logs_user_idx on public.interaction_logs (user_id, created_at desc);
create index if not exists interaction_logs_event_idx on public.interaction_logs (event);

alter table public.interaction_logs enable row level security;

drop policy if exists "interaction log insert" on public.interaction_logs;
drop policy if exists "interaction log read" on public.interaction_logs;

create policy "interaction log insert" on public.interaction_logs
  for insert with check (auth.uid() = user_id or user_id is null);

create policy "interaction log read" on public.interaction_logs
  for select using (public.is_pengurus());
