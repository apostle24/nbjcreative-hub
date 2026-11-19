-- NBJCreative Hub: safe vendor sales reporting
-- Vendors must never gain direct SELECT access to customer order records.
drop policy if exists "Orders: vendors read own sales" on public.orders;

create or replace function public.get_vendor_sales()
returns table (
  order_reference text,
  product_title text,
  quantity integer,
  unit_price numeric,
  currency character,
  payment_status public.order_payment_status,
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

revoke all on function public.get_vendor_sales() from public;
revoke all on function public.get_vendor_sales() from anon;
grant execute on function public.get_vendor_sales() to authenticated;

comment on function public.get_vendor_sales() is
  'Returns limited, non-identifying sales rows for the authenticated approved vendor. Does not expose customer email or personal details.';
