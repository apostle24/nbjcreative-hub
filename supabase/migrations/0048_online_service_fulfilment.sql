-- Online-service fulfilment on the shared marketplace order_items records.
alter table public.order_items
  add column if not exists service_status text not null default 'not_started',
  add column if not exists service_seller_note text,
  add column if not exists service_customer_note text,
  add column if not exists service_started_at timestamptz,
  add column if not exists service_submitted_at timestamptz,
  add column if not exists service_completed_at timestamptz,
  add column if not exists service_revision_count integer not null default 0;

alter table public.order_items
  drop constraint if exists order_items_service_status_check;
alter table public.order_items
  add constraint order_items_service_status_check
  check (service_status in ('not_started','in_progress','submitted','revision_requested','completed'));

create index if not exists order_items_vendor_service_status_idx
  on public.order_items(vendor_id, service_status)
  where product_type = 'online_service';

-- Seller order listing remains on the shared order_items/orders tables.
drop function if exists public.get_vendor_orders();
create function public.get_vendor_orders()
returns table(
  order_item_id uuid,
  order_reference text,
  product_title text,
  quantity integer,
  unit_price numeric,
  currency text,
  product_type text,
  payment_status public.order_payment_status,
  fulfillment_status public.order_fulfillment_status,
  item_fulfillment_status text,
  order_created_at timestamptz,
  shipping_full_name text,
  shipping_phone text,
  shipping_address_line1 text,
  shipping_address_line2 text,
  shipping_city text,
  shipping_region text,
  shipping_postal_code text,
  shipping_country text,
  shipping_carrier text,
  tracking_number text,
  tracking_url text,
  seller_fulfillment_note text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  service_status text,
  service_seller_note text,
  service_customer_note text,
  service_started_at timestamptz,
  service_submitted_at timestamptz,
  service_completed_at timestamptz,
  service_revision_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    oi.id, o.reference, oi.product_title, oi.quantity, oi.unit_price, oi.currency,
    oi.product_type, o.payment_status, o.fulfillment_status, oi.item_fulfillment_status,
    o.created_at, o.shipping_full_name, o.shipping_phone, o.shipping_address_line1,
    o.shipping_address_line2, o.shipping_city, o.shipping_region, o.shipping_postal_code,
    o.shipping_country, oi.shipping_carrier, oi.tracking_number, oi.tracking_url,
    oi.seller_fulfillment_note, oi.shipped_at, oi.delivered_at,
    oi.service_status, oi.service_seller_note, oi.service_customer_note,
    oi.service_started_at, oi.service_submitted_at, oi.service_completed_at,
    oi.service_revision_count
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.vendor_profiles v on v.id = oi.vendor_id
  where v.owner_id = (select auth.uid())
    and v.status = 'approved'
  order by o.created_at desc
  limit 500;
$$;
revoke all on function public.get_vendor_orders() from public, anon;
grant execute on function public.get_vendor_orders() to authenticated;

-- Approved seller can progress only their own paid online-service order items.
create or replace function public.update_vendor_service_fulfillment(
  p_order_item_id uuid,
  p_status text,
  p_note text default null
)
returns table(order_reference text, service_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.order_items%rowtype;
  v_order public.orders%rowtype;
  v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'Sign in to manage service orders.'; end if;
  if p_status not in ('in_progress','submitted') then
    raise exception 'Choose a valid service update.';
  end if;

  select oi.* into v_item
  from public.order_items oi
  join public.vendor_profiles v on v.id = oi.vendor_id
  where oi.id = p_order_item_id and oi.product_type = 'online_service'
    and v.owner_id = v_owner and v.status = 'approved'
  for update of oi;
  if not found then raise exception 'This service order does not belong to your approved store.'; end if;

  select o.* into v_order from public.orders o
  where o.id = v_item.order_id for update;
  if v_order.payment_status <> 'paid' then raise exception 'Only paid service orders can be worked on.'; end if;
  if v_item.service_status = 'completed' then raise exception 'This service order is already completed.'; end if;
  if p_status = 'submitted' and nullif(trim(coalesce(p_note,'')), '') is null then
    raise exception 'Add a delivery message describing the completed work before submitting it.';
  end if;

  update public.order_items
  set service_status = p_status,
      service_seller_note = coalesce(nullif(trim(p_note),''), service_seller_note),
      service_started_at = case when p_status in ('in_progress','submitted') then coalesce(service_started_at, now()) else service_started_at end,
      service_submitted_at = case when p_status = 'submitted' then now() else service_submitted_at end
  where id = p_order_item_id;

  return query select v_order.reference, p_status;
end;
$$;
revoke all on function public.update_vendor_service_fulfillment(uuid,text,text) from public, anon;
grant execute on function public.update_vendor_service_fulfillment(uuid,text,text) to authenticated;

-- Customer may request a revision or accept the submitted work for their own paid order.
create or replace function public.respond_to_service_delivery(
  p_order_item_id uuid,
  p_action text,
  p_note text default null
)
returns table(service_status text, service_revision_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.order_items%rowtype;
  v_order public.orders%rowtype;
  v_customer uuid := auth.uid();
begin
  if v_customer is null then raise exception 'Sign in to respond to this service delivery.'; end if;
  if p_action not in ('revision_requested','completed') then
    raise exception 'Choose request revision or accept completed work.';
  end if;

  select oi.* into v_item
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.id = p_order_item_id and oi.product_type = 'online_service'
    and o.customer_id = v_customer
  for update of oi;
  if not found then raise exception 'This service order was not found in your account.'; end if;

  select o.* into v_order from public.orders o where o.id = v_item.order_id for update;
  if v_order.payment_status <> 'paid' then raise exception 'Only paid service orders can be reviewed.'; end if;
  if v_item.service_status <> 'submitted' then raise exception 'The seller must submit the work before you can review it.'; end if;

  if p_action = 'revision_requested' then
    if nullif(trim(coalesce(p_note,'')), '') is null then
      raise exception 'Describe the change you need before requesting a revision.';
    end if;
    update public.order_items
    set service_status = 'revision_requested',
        service_customer_note = trim(p_note),
        service_revision_count = service_revision_count + 1
    where id = p_order_item_id;
    return query select 'revision_requested'::text, v_item.service_revision_count + 1;
  else
    update public.order_items
    set service_status = 'completed',
        service_customer_note = nullif(trim(coalesce(p_note,'')), ''),
        service_completed_at = now()
    where id = p_order_item_id;
    update public.orders o
    set fulfillment_status = case
      when not exists (
        select 1 from public.order_items oi
        where oi.order_id = v_order.id
          and oi.product_type <> 'digital'
          and not (
            (oi.product_type = 'physical' and oi.item_fulfillment_status = 'delivered')
            or (oi.product_type = 'online_service' and oi.service_status = 'completed')
          )
      ) then 'fulfilled'::public.order_fulfillment_status
      when exists (
        select 1 from public.order_items oi
        where oi.order_id = v_order.id
          and oi.product_type <> 'digital'
          and (
            (oi.product_type = 'physical' and oi.item_fulfillment_status <> 'unfulfilled')
            or (oi.product_type = 'online_service' and oi.service_status <> 'not_started')
          )
      ) then 'partially_fulfilled'::public.order_fulfillment_status
      else 'unfulfilled'::public.order_fulfillment_status
    end
    where o.id = v_order.id;
    return query select 'completed'::text, v_item.service_revision_count;
  end if;
end;
$$;
revoke all on function public.respond_to_service_delivery(uuid,text,text) from public, anon;
grant execute on function public.respond_to_service_delivery(uuid,text,text) to authenticated;
