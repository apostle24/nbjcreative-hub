-- NBJCreative Hub: safe vendor order management view
-- Exposes only order-line information belonging to the authenticated approved vendor.
create or replace function public.get_vendor_orders()
returns table (
  order_reference text,
  product_title text,
  quantity integer,
  unit_price numeric,
  currency text,
  payment_status public.order_payment_status,
  fulfillment_status public.order_fulfillment_status,
  order_created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.reference,
    oi.product_title,
    oi.quantity,
    oi.unit_price,
    oi.currency,
    o.payment_status,
    o.fulfillment_status,
    o.created_at
  from public.vendor_profiles v
  join public.products p on p.vendor_id = v.id
  join public.order_items oi on oi.product_id = p.id
  join public.orders o on o.id = oi.order_id
  where v.owner_id = (select auth.uid())
    and v.status = 'approved'
  order by o.created_at desc
  limit 500;
$$;

revoke all on function public.get_vendor_orders() from public;
revoke all on function public.get_vendor_orders() from anon;
grant execute on function public.get_vendor_orders() to authenticated;

comment on function public.get_vendor_orders() is
  'Returns up to 500 non-identifying order lines for the authenticated approved vendor. Customer contact and personal data are never exposed.';
