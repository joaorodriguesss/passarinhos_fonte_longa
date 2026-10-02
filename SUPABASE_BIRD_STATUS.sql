alter table public.birds
  add column if not exists status text not null default 'available';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.birds'::regclass
      and conname = 'birds_status_check'
  ) then
    alter table public.birds
      add constraint birds_status_check
      check (status in ('available', 'reserved', 'sold'));
  end if;
end;
$$;
