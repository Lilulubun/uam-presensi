create or replace function public.change_password_flag()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.users
  set must_change_password = false
  where id = auth.uid();
end;
$$;
