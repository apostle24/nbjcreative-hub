-- Harden online-service fulfilment transitions.
-- Sellers must start work before submitting, and revisions must be addressed before resubmission.

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
  if v_owner is null then
    raise exception 'Sign in to manage service orders.';
  end if;

  if p_status not in ('in_progress','submitted') then
    raise exception 'Choose a valid service update.';
  end if;

  select oi.* into v_item
  from public.order_items oi
  join public.vendor_profiles v on v.id = oi.vendor_id
  where oi.id = p_order_item_id
    and oi.product_type = 'online_service'
    and v.owner_id = v_owner
    and v.status = 'approved'
  for update of oi;

  if not found then
    raise exception 'This service order does not belong to your approved store.';
  end if;

  select o.* into v_order
  from public.orders o
  where o.id = v_item.order_id
  for update;

  if v_order.payment_status <> 'paid' then
    raise exception 'Only paid service orders can be worked on.';
  end if;

  if v_item.service_status = 'completed' then
    raise exception 'This service order is already completed.';
  end if;

  if p_status = 'in_progress'
     and v_item.service_status not in ('not_started','revision_requested') then
    raise exception 'Work can only be started when the service is not started or a revision has been requested.';
  end if;

  if p_status = 'submitted' and v_item.service_status <> 'in_progress' then
    raise exception 'Start or resume the work before submitting it to the customer.';
  end if;

  if p_status = 'submitted'
     and nullif(trim(coalesce(p_note,'')), '') is null
     and nullif(trim(coalesce(v_item.service_seller_note,'')), '') is null then
    raise exception 'Add a delivery message describing the completed work before submitting it.';
  end if;

  update public.order_items
  set service_status = p_status,
      service_seller_note = coalesce(nullif(trim(p_note),''), service_seller_note),
      service_started_at = case
        when p_status = 'in_progress' then coalesce(service_started_at, now())
        else service_started_at
      end,
      service_submitted_at = case
        when p_status = 'submitted' then now()
        else null
      end,
      service_completed_at = null
  where id = p_order_item_id;

  return query select v_order.reference, p_status;
end;
$$;

revoke all on function public.update_vendor_service_fulfillment(uuid,text,text) from public, anon;
grant execute on function public.update_vendor_service_fulfillment(uuid,text,text) to authenticated;
