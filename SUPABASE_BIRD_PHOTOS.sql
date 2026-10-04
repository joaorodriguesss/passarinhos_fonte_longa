create table if not exists public.bird_photos (
  id uuid primary key default gen_random_uuid(),
  bird_id uuid not null references public.birds (id) on delete cascade,
  image_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.bird_photos enable row level security;

grant select on public.bird_photos to anon, authenticated;
grant insert, update, delete on public.bird_photos to authenticated;

drop policy if exists "Public can read bird photos" on public.bird_photos;
create policy "Public can read bird photos"
  on public.bird_photos for select to anon, authenticated
  using (true);

drop policy if exists "Admins can manage bird photos" on public.bird_photos;
create policy "Admins can manage bird photos"
  on public.bird_photos for all to authenticated
  using (exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid())));
