-- NBJCreative Hub: safe public marketplace directory
-- Returns approved stores only and exposes no seller contact or account data.
create or replace function public.get_public_marketplace_stores()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'store_name', v.store_name,
      'store_slug', v.store_slug,
      'description', v.description,
      'website_url', v.website_url,
      'product_count', (
        select count(*)::integer
        from public.products p
        where p.vendor_id = v.id
          and p.status = 'published'
      )
    )
    order by v.created_at desc
  ), '[]'::jsonb)
  from public.vendor_profiles v
  where v.status = 'approved';
$$;

revoke all on function public.get_public_marketplace_stores() from public;
grant execute on function public.get_public_marketplace_stores() to anon, authenticated;

comment on function public.get_public_marketplace_stores() is
  'Returns approved public vendor store listings and published product counts only.';
