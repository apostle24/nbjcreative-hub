-- Secure, atomic download allowance consumption for signed private-bucket URLs.
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
  from public.product_files pf
  where de.id = p_entitlement_id
    and de.product_file_id = pf.id
    and de.customer_id = v_user_id
    and de.revoked_at is null
    and (de.expires_at is null or de.expires_at > now())
    and (de.max_downloads is null or de.download_count < de.max_downloads)
  returning pf.storage_path, pf.file_name into v_path, v_name;

  if not found then
    raise exception 'This download is unavailable, expired, or its download limit has been reached.';
  end if;

  return query select v_path, v_name;
end;
$$;

revoke all on function public.consume_download_entitlement(uuid) from public;
revoke all on function public.consume_download_entitlement(uuid) from anon;
grant execute on function public.consume_download_entitlement(uuid) to authenticated;
