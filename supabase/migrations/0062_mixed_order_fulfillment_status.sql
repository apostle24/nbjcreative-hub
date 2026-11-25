-- Keep order-level fulfilment accurate when physical products and online services
-- are purchased together. A physical shipment must not complete an order while
-- any online-service item is still awaiting delivery or customer acceptance.

create or replace function public.update_vendor_order_fulfillment(
  p_order_item_id uuid,
  p_status text,
  p_carrier text default null,
  p_tracking_number text default null,
  p_tracking_url text default null,
  p_note text default null
)
returns table(order_reference text, item_fulfillment_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.order_items%rowtype;
  v_order public.orders%rowtype;
  v_owner uuid := auth.uid();
  v_current_rank integer;
  v_new_rank integer;
begin
  if v_owner is null then
    raise exception 'Sign in to manage seller fulfilment.';
  end if;

  if p_status not in ('processing', 'shipped', 'delivered') then
    raise exception 'Choose a valid fulfilment status.';
  end if;

  select oi.* into v_item
  from public.order_items oi
  join public.vendor_profiles v on v.id = oi.vendor_id
  where oi.id = p_order_item_id
    and v.owner_id = v_owner
    and v.status = 'approved'
  for update of oi;

  if not found then
    raise exception 'This order item is not assigned to your approved store.';
  end if;

  select o.* into v_order
  from public.orders o
  where o.id = v_item.order_id
  for update;

  if v_order.payment_status <> 'paid' then
    raise exception 'Only paid orders can be fulfilled.';
  end if;
  if v_item.product_type <> 'physical' then
    raise exception 'Seller shipment updates are available only for physical products.';
  end if;

  v_current_rank := case v_item.item_fulfillment_status
    when 'processing' then 1 when 'shipped' then 2 when 'delivered' then 3
    else 0 end;
  v_new_rank := case p_status when 'processing' then 1 when 'shipped' then 2 when 'delivered' then 3 else -1 end;
  if v_new_rank < v_current_rank then
    raise exception 'Fulfilment cannot move backwards.';
  end if;

  if p_status = 'shipped'
     and nullif(trim(coalesce(p_tracking_number, '')), '') is null
     and nullif(trim(coalesce(p_tracking_url, '')), '') is null then
    raise exception 'Add a tracking number or tracking link before marking this item as shipped.';
  end if;

  if p_tracking_url is not null
     and trim(p_tracking_url) !~* '^https?://' then
    raise exception 'Tracking link must begin with http:// or https://.';
  end if;

  update public.order_items
  set item_fulfillment_status = p_status,
      shipping_carrier = coalesce(nullif(trim(p_carrier), ''), shipping_carrier),
      tracking_number = coalesce(nullif(trim(p_tracking_number), ''), tracking_number),
      tracking_url = coalesce(nullif(trim(p_tracking_url), ''), tracking_url),
      seller_fulfillment_note = coalesce(nullif(trim(p_note), ''), seller_fulfillment_note),
      shipped_at = case when p_status in ('shipped','delivered') then coalesce(shipped_at, now()) else shipped_at end,
      delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end
  where id = p_order_item_id;

  if exists (
    select 1 from public.order_items oi
    where oi.order_id = v_order.id and oi.product_type = 'physical'
  ) then
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
  end if;

  return query select v_order.reference, p_status;
end;
$$;

revoke all on function public.update_vendor_order_fulfillment(uuid, text, text, text, text, text)
  from public, anon;
grant execute on function public.update_vendor_order_fulfillment(uuid, text, text, text, text, text)
  to authenticated;
