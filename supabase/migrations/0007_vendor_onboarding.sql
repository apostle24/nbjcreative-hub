-- NBJCreative Hub: vendor onboarding foundation
create type public.vendor_application_status as enum ('pending', 'approved', 'rejected', 'suspended');

create table public.vendor_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  store_name text not null check (char_length(trim(store_name)) between 2 and 80),
  store_slug text not null unique check (store_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  contact_email text not null,
  website_url text,
  status public.vendor_application_status not null default 'pending',
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vendor_profiles_status_created_idx
  on public.vendor_profiles(status, created_at desc);

create trigger vendor_profiles_updated_at
before update on public.vendor_profiles
for each row execute function public.set_updated_at();

alter table public.vendor_profiles enable row level security;

create policy "Vendors: read own application or admin"
on public.vendor_profiles for select to authenticated
using (owner_id = (select auth.uid()) or public.is_admin());

create policy "Vendors: submit own application"
on public.vendor_profiles for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and status = 'pending'
  and reviewed_at is null
);

create policy "Vendors: edit pending application"
on public.vendor_profiles for update to authenticated
using (owner_id = (select auth.uid()) and status = 'pending')
with check (owner_id = (select auth.uid()) and status = 'pending' and reviewed_at is null);

create policy "Vendors: admin manages applications"
on public.vendor_profiles for all to authenticated
using (public.is_admin())
with check (public.is_admin());

comment on table public.vendor_profiles is
  'Vendor store applications and seller account status. Approval is performed by an administrator.';
