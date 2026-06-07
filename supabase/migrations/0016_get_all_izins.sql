-- 0016_get_all_izins.sql
-- Idempotent: CREATE OR REPLACE

-- =========================================================================
-- RPC: get_all_izins (pengurus only)
-- Returns all izin_requests with user name, reviewer name, and status.
-- Used for pengurus to view izin history (approved/rejected/pending).
-- =========================================================================
create or replace function public.get_all_izins()
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  start_date date,
  end_date date,
  alasan text,
  status text,
  reviewed_by_name text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'pengurus') then
    raise exception 'forbidden';
  end if;

  return query
    select
      r.id, r.user_id, u.name,
      r.start_date, r.end_date, r.alasan,
      r.status::text,
      ru.name as reviewed_by_name,
      r.created_at, r.reviewed_at
    from public.izin_requests r
    join public.users u on u.id = r.user_id
    left join public.users ru on ru.id = r.reviewed_by
    order by r.created_at desc;
end; $$;
