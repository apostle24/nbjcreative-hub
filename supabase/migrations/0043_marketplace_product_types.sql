-- Product types and fulfilment details for the global marketplace.
alter table public.products
  add column if not exists product_type text not null default 'digital',
  add column if not exists inventory_quantity integer,
  add column if not exists sku text,
  add column if not exists shipping_required boolean not null default false,
  add column if not exists shipping_note text,
  add column if not exists delivery_note text;

alter table public.products
  drop constraint if exists products_product_type_check;
alter table public.products
  add constraint products_product_type_check
  check (product_type in ('physical', 'digital', 'online_service'));

alter table public.products
  drop constraint if exists products_inventory_quantity_check;
alter table public.products
  add constraint products_inventory_quantity_check
  check (inventory_quantity is null or inventory_quantity >= 0);

comment on column public.products.product_type is
  'Marketplace listing type: physical goods, digital downloads, or online services.';
