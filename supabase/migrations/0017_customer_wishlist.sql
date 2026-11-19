-- NBJCreative Hub: customer wishlist
create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (customer_id, product_id)
);

create index wishlist_items_customer_created_idx
  on public.wishlist_items(customer_id, created_at desc);

alter table public.wishlist_items enable row level security;

create policy "Wishlist: customer reads own items"
on public.wishlist_items for select to authenticated
using (customer_id = (select auth.uid()) or public.is_admin());

create policy "Wishlist: customer adds own items"
on public.wishlist_items for insert to authenticated
with check (customer_id = (select auth.uid()));

create policy "Wishlist: customer removes own items"
on public.wishlist_items for delete to authenticated
using (customer_id = (select auth.uid()));

grant select, insert, delete on public.wishlist_items to authenticated;
revoke all on public.wishlist_items from anon;
