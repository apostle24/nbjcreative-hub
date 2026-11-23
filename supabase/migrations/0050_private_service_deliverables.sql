-- Private files delivered by sellers for paid online-service orders.
create table if not exists public.service_deliverables (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  vendor_id uuid not null references public.vendor_profiles(id) on delete restrict,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  file_name text not null,
  storage_path text not null unique,
  content_type text,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  created_at timestamptz not null default now()
);

create index if not exists service_deliverables_order_item_created_idx
  on public.service_deliverables(order_item_id, created_at);

create index if not exists service_deliverables_vendor_created_idx
  on public.service_deliverables(vendor_id, created_at);

alter table public.service_deliverables enable row level security;
revoke all on public.service_deliverables from public, anon, authenticated;
grant all on public.service_deliverables to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'service-deliverables',
  'service-deliverables',
  false,
  52428800,
  array[
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

comment on table public.service_deliverables is
  'Private seller deliverables for paid online-service order items. Access is mediated by authenticated server routes.';
