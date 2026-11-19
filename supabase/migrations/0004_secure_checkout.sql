-- Secure pending-order creation for authenticated customers.
-- Prices are read from the database, never trusted from the browser.

create or replace function public.create_pending_order(p_items jsonb)
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
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'You must sign in before placing an order.';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 20 then
    raise exception 'Your cart is empty or contains too many different products.';
  end if;

  select p.email into v_email
  from public.profiles p
  where p.id = v_user_id;

  if v_email is null or length(trim(v_email)) = 0 then
    raise exception 'Your customer profile needs a valid email address.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if not (v_item ? 'productId') or not (v_item ? 'quantity') then
      raise exception 'Invalid cart item.';
    end if;

    v_product_id := (v_item->>'productId')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    if v_quantity < 1 or v_quantity > 10 then
      raise exception 'Each product quantity must be between 1 and 10.';
    end if;

    if exists (
      select 1 from jsonb_array_elements(p_items) x
      where x.value->>'productId' = v_product_id::text
      group by x.value->>'productId'
      having count(*) > 1
    ) then
      raise exception 'Duplicate products were found in the cart. Please refresh it.';
    end if;

    select pr.id, pr.title, pr.price, pr.currency
      into v_product
    from public.products pr
    where pr.id = v_product_id and pr.status = 'published'
    for share;

    if not found then
      raise exception 'A product in your cart is no longer available.';
    end if;

    if v_currency is null then
      v_currency := v_product.currency;
    elsif v_currency <> v_product.currency then
      raise exception 'Please place separate orders for products with different currencies.';
    end if;

    v_total := v_total + (v_product.price * v_quantity);
    v_count := v_count + 1;
  end loop;

  insert into public.orders (
    customer_id, customer_email, reference, amount, currency,
    payment_status, fulfillment_status, provider
  )
  values (
    v_user_id, v_email, v_reference, v_total, v_currency,
    'pending', 'unfulfilled', 'paystack'
  )
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'productId')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    select pr.title, pr.price, pr.currency
      into v_product
    from public.products pr
    where pr.id = v_product_id and pr.status = 'published';

    insert into public.order_items (
      order_id, product_id, product_title, quantity, unit_price, currency
    )
    values (
      v_order_id, v_product_id, v_product.title, v_quantity,
      v_product.price, v_product.currency
    );
  end loop;

  return query select v_order_id, v_reference, v_total, v_currency;
end;
$$;

revoke all on function public.create_pending_order(jsonb) from public;
revoke all on function public.create_pending_order(jsonb) from anon;
grant execute on function public.create_pending_order(jsonb) to authenticated;
