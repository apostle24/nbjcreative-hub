-- Atomic Paystack payment recording and digital-file entitlement creation.
-- Apply this migration in the Supabase SQL Editor before deploying the webhook route.

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
begin
  if p_order_reference is null or length(trim(p_order_reference)) = 0
     or p_transaction_id is null or length(trim(p_transaction_id)) = 0
     or p_event_id is null or length(trim(p_event_id)) = 0
     or p_amount_subunits is null or p_amount_subunits < 1
     or p_currency is null or length(trim(p_currency)) <> 3 then
    raise exception 'Invalid verified payment details.';
  end if;

  select * into v_order
  from public.orders
  where reference = trim(p_order_reference) and provider = 'paystack'
  for update;

  if not found then
    raise exception 'Matching order was not found.';
  end if;

  if round(v_order.amount * 100)::bigint <> p_amount_subunits
     or upper(trim(v_order.currency)) <> upper(trim(p_currency)) then
    raise exception 'Verified payment amount or currency does not match the order.';
  end if;

  v_already_paid := v_order.payment_status = 'paid';

  insert into public.payment_events (
    provider, provider_event_id, reference, event_type,
    verified, processing_status, safe_metadata, processed_at
  )
  values (
    'paystack', trim(p_event_id), trim(p_order_reference), 'charge.success',
    true, 'processed',
    coalesce(p_safe_metadata, '{}'::jsonb) || jsonb_build_object('transaction_id', trim(p_transaction_id)),
    now()
  )
  on conflict (provider, provider_event_id) do update
    set verified = true,
        processing_status = 'processed',
        processed_at = coalesce(public.payment_events.processed_at, now());

  update public.orders
  set payment_status = 'paid',
      paid_at = coalesce(paid_at, now()),
      fulfillment_status = case
        when exists (
          select 1 from public.order_items oi
          join public.product_files pf on pf.product_id = oi.product_id
          where oi.order_id = v_order.id
        ) then 'fulfilled'::public.order_fulfillment_status
        else fulfillment_status
      end
  where id = v_order.id
    and payment_status in ('pending', 'paid');

  insert into public.download_entitlements (
    order_item_id, customer_id, product_file_id
  )
  select oi.id, v_order.customer_id, pf.id
  from public.order_items oi
  join public.product_files pf on pf.product_id = oi.product_id
  where oi.order_id = v_order.id
    and v_order.customer_id is not null
  on conflict (order_item_id, product_file_id) do nothing;

  get diagnostics v_entitlements = row_count;

  return query select v_order.id, v_order.reference, v_already_paid, v_entitlements;
end;
$$;

revoke all on function public.fulfill_paystack_payment(text, text, text, bigint, text, jsonb) from public;
revoke all on function public.fulfill_paystack_payment(text, text, text, bigint, text, jsonb) from anon, authenticated;
grant execute on function public.fulfill_paystack_payment(text, text, text, bigint, text, jsonb) to service_role;
