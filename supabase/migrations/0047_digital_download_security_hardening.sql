-- Secure digital download access and reliable download allowance handling.
-- Apply after the matching application deployment is live.

update storage.buckets
set public = false,
    file_size_limit = 52428800
where id = 'product-downloads';

create or replace function public.consume_download_entitlement(p_entitlement_id uuid)
returns table(storage_path text, file_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_path text;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'Please sign in to download this file.';
  end if;

  update public.download_entitlements de
  set download_count = de.download_count + 1
  from public.product_files pf,
       public.order_items oi,
       public.orders o
  where de.id = p_entitlement_id
    and de.product_file_id = pf.id
    and de.order_item_id = oi.id
    and oi.order_id = o.id
    and o.payment_status = 'paid'
    and oi.product_type = 'digital'
    and de.customer_id = v_user_id
    and de.revoked_at is null
    and (de.expires_at is null or de.expires_at > now())
    and (de.max_downloads is null or de.download_count < de.max_downloads)
  returning pf.storage_path, pf.file_name into v_path, v_name;

  if not found then
    raise exception 'This download is unavailable, the order is not paid, or its download limit has been reached.';
  end if;

  return query select v_path, v_name;
end;
$$;

revoke all on function public.consume_download_entitlement(uuid) from public, anon;
grant execute on function public.consume_download_entitlement(uuid) to authenticated;

create or replace function public.restore_download_entitlement(p_entitlement_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.download_entitlements
  set download_count = greatest(download_count - 1, 0)
  where id = p_entitlement_id
    and download_count > 0;
$$;

revoke all on function public.restore_download_entitlement(uuid) from public, anon, authenticated;
grant execute on function public.restore_download_entitlement(uuid) to service_role;

comment on function public.consume_download_entitlement(uuid) is
  'Consumes one download only for the authenticated purchaser of a currently paid digital order.';
comment on function public.restore_download_entitlement(uuid) is
  'Service-role-only compensation when signed URL creation fails after a download allowance was consumed.';
