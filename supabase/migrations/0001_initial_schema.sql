-- NBJCreative Hub: initial Supabase schema
-- Apply in Supabase SQL Editor. Review before production use.

create extension if not exists pgcrypto;

create type public.app_role as enum ('customer', 'admin');
create type public.product_status as enum ('draft', 'published', 'archived');
create type public.order_payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.order_fulfillment_status as enum ('unfulfilled', 'fulfilled', 'partially_fulfilled', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  slug text not null unique,
  summary text,
  description text,
  price numeric(12,2) not null check (price >= 0),
  currency char(3) not null default 'GHS',
  cover_image_path text,
  status public.product_status not null default 'draft',
  featured boolean not null default false,
  seo_title text,
  seo_description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete set null,
  customer_email text not null,
  reference text not null unique,
  amount numeric(12,2) not null check (amount >= 0),
  currency char(3) not null,
  payment_status public.order_payment_status not null default 'pending',
  fulfillment_status public.order_fulfillment_status not null default 'unfulfilled',
  provider text not null default 'paystack',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_title text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  currency char(3) not null,
  created_at timestamptz not null default now()
);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text,
  reference text not null,
  event_type text not null,
  verified boolean not null default false,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  safe_metadata jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create table public.download_entitlements (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
  product_file_id uuid not null references public.product_files(id) on delete cascade,
  expires_at timestamptz,
  max_downloads integer check (max_downloads is null or max_downloads > 0),
  download_count integer not null default 0 check (download_count >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_item_id, product_file_id)
);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete set null,
  customer_email text not null,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_status_idx on public.products(category_id, status);
create index products_created_at_idx on public.products(created_at desc);
create index orders_customer_created_idx on public.orders(customer_id, created_at desc);
create index order_items_order_idx on public.order_items(order_id);
create index entitlements_customer_idx on public.download_entitlements(customer_id);
create index payment_events_reference_idx on public.payment_events(reference);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories
for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders
for each row execute function public.set_updated_at();
create trigger support_messages_updated_at before update on public.support_messages
for each row execute function public.set_updated_at();

-- Create a customer profile for each new auth user. Never accept a role from signup metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    'customer'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_files enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_events enable row level security;
alter table public.download_entitlements enable row level security;
alter table public.support_messages enable row level security;

create policy "Profiles: read own or admin"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.is_admin());

create policy "Profiles: update own basic profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()) or public.is_admin())
with check (
  public.is_admin()
  or (id = (select auth.uid()) and role = 'customer')
);

create policy "Categories: public reads active"
on public.categories for select to anon, authenticated
using (is_active = true or public.is_admin());
create policy "Categories: admin manages"
on public.categories for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Products: public reads published"
on public.products for select to anon, authenticated
using (status = 'published' or public.is_admin());
create policy "Products: admin manages"
on public.products for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Product files: admin only"
on public.product_files for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Orders: customer reads own or admin"
on public.orders for select to authenticated
using (customer_id = (select auth.uid()) or public.is_admin());
create policy "Orders: admin manages"
on public.orders for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Order items: customer reads own order or admin"
on public.order_items for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.orders o
    where o.id = order_id and o.customer_id = (select auth.uid())
  )
);
create policy "Order items: admin manages"
on public.order_items for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Payment events are written only by trusted server code using the service role.
create policy "Payment events: admin reads"
on public.payment_events for select to authenticated
using (public.is_admin());

create policy "Entitlements: customer reads own or admin"
on public.download_entitlements for select to authenticated
using (customer_id = (select auth.uid()) or public.is_admin());
create policy "Entitlements: admin manages"
on public.download_entitlements for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Support: customer creates own message"
on public.support_messages for insert to authenticated
with check (customer_id = (select auth.uid()));
create policy "Support: customer reads own or admin"
on public.support_messages for select to authenticated
using (customer_id = (select auth.uid()) or public.is_admin());
create policy "Support: admin manages"
on public.support_messages for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Create a private bucket for product downloads. Never make this bucket public.
insert into storage.buckets (id, name, public)
values ('product-downloads', 'product-downloads', false)
on conflict (id) do nothing;

create policy "Product downloads: admins upload and manage"
on storage.objects for all to authenticated
using (bucket_id = 'product-downloads' and public.is_admin())
with check (bucket_id = 'product-downloads' and public.is_admin());

-- Admin promotion must be performed manually by the project owner in SQL Editor
-- after verifying the intended account. Do not expose this as a public API.
-- Example (replace the email):
-- update public.profiles set role = 'admin' where email = 'owner@example.com';
