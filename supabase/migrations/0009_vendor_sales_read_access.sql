-- NBJCreative Hub: vendors can view only sales for their own products.
-- No customer email or personal details are exposed by the vendor dashboard.

drop policy if exists "Order items: vendors read own sales" on public.order_items;
create policy "Order items: vendors read own sales"
on public.order_items for select to authenticated
using (
  exists (
    select 1
    from public.products p
    join public.vendor_profiles v on v.id = p.vendor_id
    where p.id = product_id
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
);

drop policy if exists "Orders: vendors read own sales" on public.orders;
create policy "Orders: vendors read own sales"
on public.orders for select to authenticated
using (
  exists (
    select 1
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    join public.vendor_profiles v on v.id = p.vendor_id
    where oi.order_id = id
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
);
