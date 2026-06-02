create table if not exists public.interaction_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  event_type text not null,
  session_id uuid references public.sessions(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists interaction_logs_user_idx on public.interaction_logs (user_id, created_at desc);
create index if not exists interaction_logs_event_type_idx on public.interaction_logs (event_type, created_at desc);

alter table public.interaction_logs enable row level security;

create policy "interaction log insert" on public.interaction_logs
  for insert with check (auth.uid() = user_id or user_id is null);

create policy "interaction log read" on public.interaction_logs
  for select using (public.is_pengurus());
