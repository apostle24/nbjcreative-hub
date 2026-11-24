-- 0056: NBJ Business performance overview.
-- Summarises the workspace owner's existing Marketplace activity without creating
-- a separate product, order, or financial system.

create or replace function public.get_business_workspace_overview(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to view your business overview.';
  end if;

  if not public.can_manage_business_workspace(p_workspace_id) then
    raise exception 'You do not have permission to view this business workspace.';
  end if;

  if not exists (
    select 1
    from public.business_workspaces b
    where b.id = p_workspace_id
      and b.status = 'active'
  ) then
    raise exception 'This business workspace is not active.';
  end if;

  select jsonb_build_object(
    'published_offerings_count', (
      select count(*)::integer
      from public.business_workspaces b
      join public.vendor_profiles v on v.owner_id = b.owner_id
      join public.products p on p.vendor_id = v.id
      where b.id = p_workspace_id
        and v.status = 'approved'
        and p.status = 'published'
    ),
    'total_enquiries', (
      select count(*)::integer
      from public.business_enquiries e
      where e.workspace_id = p_workspace_id
    ),
    'new_enquiries', (
      select count(*)::integer
      from public.business_enquiries e
      where e.workspace_id = p_workspace_id
        and e.status = 'new'
    ),
    'in_progress_enquiries', (
      select count(*)::integer
      from public.business_enquiries e
      where e.workspace_id = p_workspace_id
        and e.status = 'in_progress'
    ),
    'paid_orders_count', (
      select count(distinct o.id)::integer
      from public.business_workspaces b
      join public.vendor_profiles v on v.owner_id = b.owner_id
      join public.order_items oi on oi.vendor_id = v.id
      join public.orders o on o.id = oi.order_id
      where b.id = p_workspace_id
        and v.status = 'approved'
        and o.payment_status = 'paid'
    ),
    'pending_orders_count', (
      select count(distinct o.id)::integer
      from public.business_workspaces b
      join public.vendor_profiles v on v.owner_id = b.owner_id
      join public.order_items oi on oi.vendor_id = v.id
      join public.orders o on o.id = oi.order_id
      where b.id = p_workspace_id
        and v.status = 'approved'
        and o.payment_status = 'pending'
    ),
    'sales_by_currency', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'currency', sales.currency,
          'total', sales.total,
          'items_sold', sales.items_sold
        )
        order by sales.currency
      )
      from (
        select
          oi.currency,
          sum(oi.unit_price * oi.quantity) as total,
          sum(oi.quantity)::integer as items_sold
        from public.business_workspaces b
        join public.vendor_profiles v on v.owner_id = b.owner_id
        join public.order_items oi on oi.vendor_id = v.id
        join public.orders o on o.id = oi.order_id
        where b.id = p_workspace_id
          and v.status = 'approved'
          and o.payment_status = 'paid'
        group by oi.currency
      ) sales
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$function$;

revoke all on function public.get_business_workspace_overview(uuid)
  from public, anon;
grant execute on function public.get_business_workspace_overview(uuid)
  to authenticated;

comment on function public.get_business_workspace_overview(uuid) is
  'Returns owner/manager-scoped counts for published Marketplace offerings, customer enquiries, paid and pending orders, and seller line-item sales grouped by currency.';
