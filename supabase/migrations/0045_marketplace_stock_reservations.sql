-- Marketplace order lifecycle hardening.
-- Snapshot product type at purchase, prevent unfulfillable digital orders,
-- validate stock at checkout and atomically deduct stock after verified payment.

alter table public.order_items
  add column if not exists product_type text not null default 'digital',
  add column if not exists vendor_id uuid references public.vendor_profiles(id) on delete set null,
  add column if not exists sku text;

alter table public.orders
  add column if not exists shipping_full_name text,
  add column if not exists shipping_phone text,
  add column if not exists shipping_address_line1 text,
  add column if not exists shipping_address_line2 text,
  add column if not exists shipping_city text,
  add column if not exists shipping_region text,
  add column if not exists shipping_postal_code text,
  add column if not exists shipping_country text,
  add column if not exists shipping_instructions text;

alter table public.order_items
  drop constraint if exists order_items_product_type_check;
alter table public.order_items
  add constraint order_items_product_type_check
  check (product_type in ('physical', 'digital', 'online_service'));



-- A reservation temporarily removes units from available inventory until payment
-- is confirmed or the reservation expires.
create table if not exists public.marketplace_stock_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'reserved' check (status in ('reserved','committed','released')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, product_id)
);
create index if not exists marketplace_stock_reservations_expiry_idx
  on public.marketplace_stock_reservations(status, expires_at);
create index if not exists marketplace_stock_reservations_order_idx
  on public.marketplace_stock_reservations(order_id);
alter table public.marketplace_stock_reservations enable row level security;
revoke all on public.marketplace_stock_reservations from anon, authenticated;

drop function if exists public.create_pending_order(jsonb);

create function public.create_pending_order(p_items jsonb, p_shipping jsonb default '{}'::jsonb)
returns table(order_id uuid, order_reference text, order_amount numeric, order_currency char(3))
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product record;
  v_order_id uuid;
  v_reference text := 'NBJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
  v_currency char(3);
  v_total numeric(12,2) := 0;
  v_has_physical boolean := false;
begin
  if v_user_id is null then raise exception 'You must sign in before placing an order.'; end if;
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then
    raise exception 'Your cart is empty or contains too many different products.';
  end if;

  select p.email into v_email from public.profiles p where p.id = v_user_id;
  if v_email is null or length(trim(v_email)) = 0 then
    raise exception 'Your customer profile needs a valid email address.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) order by value->>'productId' loop
    if not (v_item ? 'productId') or not (v_item ? 'quantity') then raise exception 'Invalid cart item.'; end if;
    v_product_id := (v_item->>'productId')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity < 1 or v_quantity > 10 then raise exception 'Each product quantity must be between 1 and 10.'; end if;
    if exists (
      select 1 from jsonb_array_elements(p_items) x
      where x.value->>'productId' = v_product_id::text
      group by x.value->>'productId' having count(*) > 1
    ) then raise exception 'Duplicate products were found in the cart. Please refresh it.'; end if;

    select pr.id, pr.title, pr.price, pr.currency, pr.product_type,
           pr.inventory_quantity, pr.vendor_id, pr.sku
      into v_product
    from public.products pr
    where pr.id = v_product_id and pr.status = 'published'
    for update;
    if not found then raise exception 'A product in your cart is no longer available.'; end if;

    if v_product.product_type = 'physical' then
      v_has_physical := true;
      if v_product.inventory_quantity is null then
        raise exception 'Stock quantity is not configured for %.', v_product.title;
      end if;
      if v_product.inventory_quantity < v_quantity then
        raise exception 'Only % unit(s) of % are currently available.', v_product.inventory_quantity, v_product.title;
      end if;
      -- Reserve units now. The row lock and conditional update prevent overselling.
      update public.products
      set inventory_quantity = inventory_quantity - v_quantity
      where id = v_product_id
        and product_type = 'physical'
        and inventory_quantity >= v_quantity;
      if not found then raise exception 'Stock changed while checking %. Please try again.', v_product.title; end if;
    elsif v_product.product_type = 'digital' and not exists (
      select 1 from public.product_files pf where pf.product_id = v_product_id
    ) then
      raise exception 'The digital product % is not ready for delivery. Please contact the seller.', v_product.title;
    end if;

    if v_currency is null then v_currency := v_product.currency;
    elsif v_currency <> v_product.currency then
      raise exception 'Please place separate orders for products with different currencies.';
    end if;
    v_total := v_total + (v_product.price * v_quantity);
  end loop;

  if v_has_physical and (
    nullif(trim(coalesce(p_shipping->>'full_name','')), '') is null or
    nullif(trim(coalesce(p_shipping->>'phone','')), '') is null or
    nullif(trim(coalesce(p_shipping->>'address_line1','')), '') is null or
    nullif(trim(coalesce(p_shipping->>'city','')), '') is null or
    nullif(trim(coalesce(p_shipping->>'region','')), '') is null or
    nullif(trim(coalesce(p_shipping->>'country','')), '') is null
  ) then raise exception 'Complete the delivery name, phone, street address, city, region and country for physical products.'; end if;

  insert into public.orders (customer_id, customer_email, reference, amount, currency,
    payment_status, fulfillment_status, provider, shipping_full_name, shipping_phone,
    shipping_address_line1, shipping_address_line2, shipping_city, shipping_region,
    shipping_postal_code, shipping_country, shipping_instructions)
  values (v_user_id, v_email, v_reference, v_total, v_currency, 'pending', 'unfulfilled', 'paystack',
    nullif(trim(p_shipping->>'full_name'), ''), nullif(trim(p_shipping->>'phone'), ''),
    nullif(trim(p_shipping->>'address_line1'), ''), nullif(trim(p_shipping->>'address_line2'), ''),
    nullif(trim(p_shipping->>'city'), ''), nullif(trim(p_shipping->>'region'), ''),
    nullif(trim(p_shipping->>'postal_code'), ''), nullif(trim(p_shipping->>'country'), ''),
    nullif(trim(p_shipping->>'instructions'), ''))
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) order by value->>'productId' loop
    v_product_id := (v_item->>'productId')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    select pr.title, pr.price, pr.currency, pr.product_type, pr.vendor_id, pr.sku
      into v_product from public.products pr
      where pr.id = v_product_id and pr.status = 'published';
    insert into public.order_items (order_id, product_id, product_title, quantity,
      unit_price, currency, product_type, vendor_id, sku)
    values (v_order_id, v_product_id, v_product.title, v_quantity,
      v_product.price, v_product.currency, v_product.product_type, v_product.vendor_id, v_product.sku);
  end loop;

  insert into public.marketplace_stock_reservations (order_id, product_id, quantity, expires_at)
  select oi.order_id, oi.product_id, oi.quantity, now() + interval '30 minutes'
  from public.order_items oi
  where oi.order_id = v_order_id and oi.product_type = 'physical'
    and oi.product_id is not null;

  return query select v_order_id, v_reference, v_total, v_currency;
end;
$$;

revoke all on function public.create_pending_order(jsonb, jsonb) from public, anon;
grant execute on function public.create_pending_order(jsonb, jsonb) to authenticated;

create or replace function public.fulfill_paystack_payment(
  p_order_reference text,
  p_transaction_id text,
  p_event_id text,
  p_amount_subunits bigint,
  p_currency text,
  p_safe_metadata jsonb default '{}'::jsonb
)
returns table(order_id uuid, order_reference text, already_paid boolean, entitlement_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_entitlements integer := 0;
  v_already_paid boolean := false;
  v_item record;
  v_existing_event public.payment_events%rowtype;
begin
  if p_order_reference is null or length(trim(p_order_reference)) = 0
     or p_transaction_id is null or length(trim(p_transaction_id)) = 0
     or p_event_id is null or length(trim(p_event_id)) = 0
     or p_amount_subunits is null or p_amount_subunits < 1
     or p_currency is null or length(trim(p_currency)) <> 3 then
    raise exception 'Invalid verified payment details.';
  end if;

  select * into v_order from public.orders
  where reference = trim(p_order_reference) and provider = 'paystack'
  for update;
  if not found then raise exception 'Matching order was not found.'; end if;

  if round(v_order.amount * 100)::bigint <> p_amount_subunits
     or upper(trim(v_order.currency)) <> upper(trim(p_currency)) then
    raise exception 'Verified payment amount or currency does not match the order.';
  end if;

  v_already_paid := v_order.payment_status = 'paid';
  if v_order.payment_status = 'refunded' then raise exception 'This order has been refunded.'; end if;
  if v_order.payment_status = 'failed' then raise exception 'This order is no longer payable.'; end if;

  select * into v_existing_event from public.payment_events
  where provider = 'paystack' and provider_event_id = trim(p_event_id);
  if found and (v_existing_event.reference <> trim(p_order_reference)
      or coalesce(v_existing_event.safe_metadata->>'transaction_id','') <> trim(p_transaction_id)) then
    raise exception 'This payment event has already been used for a different transaction.';
  end if;

  if not v_already_paid then
    for v_item in
      select oi.product_id, oi.quantity, oi.product_title, oi.product_type
      from public.order_items oi where oi.order_id = v_order.id
      order by oi.product_id
    loop
      if v_item.product_type = 'physical' then
        -- New orders must have a live reservation. Legacy pre-migration orders
        -- without a reservation use a one-time atomic stock deduction.
        update public.marketplace_stock_reservations
        set status = 'committed', updated_at = now()
        where order_id = v_order.id and product_id = v_item.product_id
          and status = 'reserved' and expires_at > now();
        if not found and not exists (
          select 1 from public.marketplace_stock_reservations r
          where r.order_id = v_order.id and r.product_id = v_item.product_id
        ) then
          update public.products
          set inventory_quantity = inventory_quantity - v_item.quantity
          where id = v_item.product_id and product_type = 'physical'
            and inventory_quantity is not null and inventory_quantity >= v_item.quantity;
          if not found then
            raise exception 'Payment received but stock is no longer available for %. Contact support; do not pay again.', v_item.product_title;
          end if;
        elsif not found then
          raise exception 'The stock reservation for % has expired. Contact support before making another payment.', v_item.product_title;
        end if;
      end if;
    end loop;
  end if;

  insert into public.payment_events (provider, provider_event_id, reference, event_type,
    verified, processing_status, safe_metadata, processed_at)
  values ('paystack', trim(p_event_id), trim(p_order_reference), 'charge.success',
    true, 'processed',
    coalesce(p_safe_metadata, '{}'::jsonb) || jsonb_build_object('transaction_id', trim(p_transaction_id)), now())
  on conflict (provider, provider_event_id) do nothing;

  update public.orders
  set payment_status = 'paid',
      paid_at = coalesce(paid_at, now()),
      fulfillment_status = case
        when not exists (
          select 1 from public.order_items oi
          where oi.order_id = v_order.id and oi.product_type <> 'digital'
        ) then 'fulfilled'::public.order_fulfillment_status
        else 'unfulfilled'::public.order_fulfillment_status
      end
  where id = v_order.id and payment_status in ('pending', 'paid');

  insert into public.download_entitlements (order_item_id, customer_id, product_file_id)
  select oi.id, v_order.customer_id, pf.id
  from public.order_items oi
  join public.product_files pf on pf.product_id = oi.product_id
  where oi.order_id = v_order.id
    and oi.product_type = 'digital'
    and v_order.customer_id is not null
  on conflict (order_item_id, product_file_id) do nothing;
  get diagnostics v_entitlements = row_count;

  return query select v_order.id, v_order.reference, v_already_paid, v_entitlements;
end;
$$;

revoke all on function public.fulfill_paystack_payment(text, text, text, bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.fulfill_paystack_payment(text, text, text, bigint, text, jsonb) to service_role;


-- Release expired reservations and fail their unpaid orders. This function is
-- called every five minutes by pg_cron.
create or replace function public.release_expired_marketplace_stock()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation record;
  v_released integer := 0;
begin
  for v_reservation in
    select r.id, r.order_id, r.product_id, r.quantity
    from public.marketplace_stock_reservations r
    join public.orders o on o.id = r.order_id
    where r.status = 'reserved' and r.expires_at <= now()
      and o.payment_status = 'pending'
    order by r.order_id, r.product_id
    for update of o, r skip locked
  loop
    update public.products
    set inventory_quantity = inventory_quantity + v_reservation.quantity
    where id = v_reservation.product_id and product_type = 'physical';

    update public.marketplace_stock_reservations
    set status = 'released', updated_at = now()
    where id = v_reservation.id and status = 'reserved';

    update public.orders
    set payment_status = 'failed'
    where id = v_reservation.order_id and payment_status = 'pending';

    v_released := v_released + 1;
  end loop;
  return v_released;
end;
$$;
revoke all on function public.release_expired_marketplace_stock() from public, anon, authenticated;
grant execute on function public.release_expired_marketplace_stock() to service_role;

-- Supabase supports pg_cron. Replace an earlier job with the same name safely.
create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule(jobid)
from cron.job
where jobname = 'nbj-release-expired-marketplace-stock';
select cron.schedule(
  'nbj-release-expired-marketplace-stock',
  '*/5 * * * *',
  $job$select public.release_expired_marketplace_stock();$job$
);
