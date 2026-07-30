-- 20260729170000_expand_private_qr_storage.sql
-- Additive: private token storage table, no backfill, no legacy column changes.
-- No Realtime publication. No client access.

create table if not exists public.session_qr_tokens (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  rotated_at timestamptz not null default now()
);

alter table public.session_qr_tokens enable row level security;

-- No grants to anon or authenticated. Only SECURITY DEFINER RPCs access this table.
revoke all on public.session_qr_tokens from anon, authenticated;
