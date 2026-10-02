create table if not exists public.catalog_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists public.birds (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  species text not null,
  sex text not null check (sex in ('Macho', 'Fêmea', 'Indeterminado')),
  age text not null,
  description text not null,
  price numeric(10, 2) not null check (price >= 0),
  image_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.facilities (
  id uuid primary key default gen_random_uuid(),
  caption text not null,
  image_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.site_images (
  id text primary key,
  image_path text not null
);

alter table public.site_images drop constraint if exists site_images_id_check;
alter table public.site_images
  add constraint site_images_id_check
  check (id in ('logo', 'cover') or id ~ '^cover-[0-9]+$');

alter table public.catalog_admins enable row level security;
alter table public.birds enable row level security;
alter table public.facilities enable row level security;
alter table public.site_images enable row level security;

grant select on public.catalog_admins to authenticated;
grant select on public.birds, public.facilities, public.site_images to anon, authenticated;
grant insert, update, delete on public.birds, public.facilities, public.site_images to authenticated;

drop policy if exists "Admins can read their own access" on public.catalog_admins;
create policy "Admins can read their own access"
  on public.catalog_admins for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Public can read birds" on public.birds;
create policy "Public can read birds"
  on public.birds for select to anon, authenticated using (true);
drop policy if exists "Admins can manage birds" on public.birds;
create policy "Admins can manage birds"
  on public.birds for all to authenticated
  using (exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid())));

drop policy if exists "Public can read facilities" on public.facilities;
create policy "Public can read facilities"
  on public.facilities for select to anon, authenticated using (true);
drop policy if exists "Admins can manage facilities" on public.facilities;
create policy "Admins can manage facilities"
  on public.facilities for all to authenticated
  using (exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid())));

drop policy if exists "Public can read site images" on public.site_images;
create policy "Public can read site images"
  on public.site_images for select to anon, authenticated using (true);
drop policy if exists "Admins can manage site images" on public.site_images;
create policy "Admins can manage site images"
  on public.site_images for all to authenticated
  using (exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid())));

insert into storage.buckets (id, name, public)
values ('catalog-images', 'catalog-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can view catalog images" on storage.objects;
create policy "Public can view catalog images"
  on storage.objects for select to public
  using (bucket_id = 'catalog-images');
drop policy if exists "Admins can upload catalog images" on storage.objects;
create policy "Admins can upload catalog images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'catalog-images'
    and exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid()))
  );
drop policy if exists "Admins can update catalog images" on storage.objects;
create policy "Admins can update catalog images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'catalog-images'
    and exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid()))
  )
  with check (
    bucket_id = 'catalog-images'
    and exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid()))
  );
drop policy if exists "Admins can delete catalog images" on storage.objects;
create policy "Admins can delete catalog images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'catalog-images'
    and exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid()))
  );